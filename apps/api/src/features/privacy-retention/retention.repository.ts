import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { msToDate } from "@soc/shared";
import type { Pool, PoolClient } from "pg";
import { POSTGRES_POOL } from "../../infrastructure/postgres/postgres.provider";
import { feeCoverageEnd, permissionAuditPattern, retentionDeadline, shiftCalendarYears, type FinalizeRetentionInput, type RetentionKind } from "./retention-policy";

type RetentionCase = {
  kind: RetentionKind;
  resource_id: string;
  source_version: string;
  finalized_at: Date;
  expires_at: Date;
  hold_until: Date | null;
  completed_at: Date | null;
};
type SourceState = { version: string; ready: boolean; changed_at: Date; external: boolean };
export type RetentionReport = {
  dryRun: boolean;
  busy: boolean;
  drafts: number;
  emailDrafts: number;
  auditLogs: number;
  deletedArticles: number;
  deletedComments: number;
  cases: Array<{ kind: RetentionKind; resourceId: string; count: number; blocked?: string }>;
};

@Injectable()
export class RetentionRepository {
  constructor(@Inject(POSTGRES_POOL) private readonly pool: Pool) {}

  async list() {
    const result = await this.pool.query(
      `SELECT kind, resource_id, finalized_at, expires_at, hold_until, hold_reason,
              completed_at, deleted_count FROM privacy_retention_case
       ORDER BY completed_at NULLS FIRST, expires_at LIMIT 500`,
    );
    return result.rows;
  }

  async finalize(input: FinalizeRetentionInput, actorId: string, now: Date) {
    const dates = retentionDeadline(input, now);
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(193668305, 1)");
      if (input.kind === "SURVEY" || input.kind === "APPLICATION") {
        // Submission also locks the survey row. Closing and snapshotting are atomic.
        const closed = await client.query(
          `UPDATE survey SET accepting_responses = false, is_always_open = false,
                  close_at = LEAST(COALESCE(close_at, $3), $3),
                  updated_at = CASE WHEN accepting_responses OR is_always_open OR close_at IS NULL OR close_at > $3 THEN $3 ELSE updated_at END
           WHERE survey_id = $1 AND kind = $2 RETURNING survey_id`,
          [input.resourceId, input.kind, now],
        );
        if (!closed.rowCount) throw new NotFoundException("retention_resource_not_found");
      }
      const source = await this.sourceState(client, input.kind, input.resourceId);
      if (!source.ready) throw new ConflictException("retention_resource_not_finalized");
      if (source.external) throw new ConflictException("retention_external_storage_connected");
      if (dates.finalizedAt < source.changed_at) throw new BadRequestException("retention_end_precedes_latest_activity");
      const result = await client.query(
        `INSERT INTO privacy_retention_case
           (kind, resource_id, source_version, finalized_at, expires_at, created_by, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (kind, resource_id) DO UPDATE SET
           source_version = EXCLUDED.source_version, finalized_at = EXCLUDED.finalized_at,
           expires_at = EXCLUDED.expires_at, updated_at = EXCLUDED.updated_at, created_by = EXCLUDED.created_by,
           completed_at = NULL, deleted_count = 0
         WHERE privacy_retention_case.completed_at IS NULL OR privacy_retention_case.source_version <> EXCLUDED.source_version
         RETURNING kind, resource_id, finalized_at, expires_at, hold_until`,
        [input.kind, input.resourceId, source.version, dates.finalizedAt, dates.expiresAt, actorId, now],
      );
      if (!result.rowCount) throw new ConflictException("retention_already_completed");
      await client.query("COMMIT");
      return result.rows[0];
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally { client.release(); }
  }

  async setHold(kind: RetentionKind, id: string, until: Date | null, reason: string | undefined, now: Date) {
    if (until && (until <= now || !reason)) throw new BadRequestException("retention_hold_requires_future_date_and_reason");
    const result = await this.pool.query(
      `UPDATE privacy_retention_case SET hold_until = $3, hold_reason = $4, updated_at = $5
       WHERE kind = $1 AND resource_id = $2 AND completed_at IS NULL
       RETURNING kind, resource_id, expires_at, hold_until`,
      [kind, id, until, until ? reason : null, now],
    );
    if (!result.rowCount) throw new NotFoundException("retention_pending_case_not_found");
    return result.rows[0];
  }

  async run(dryRun: boolean, now: Date): Promise<RetentionReport> {
    const report: RetentionReport = { dryRun, busy: false, drafts: 0, emailDrafts: 0, auditLogs: 0, deletedArticles: 0, deletedComments: 0, cases: [] };
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const lease = await client.query("SELECT pg_try_advisory_xact_lock(193668305, 1) AS locked");
      if (!lease.rows[0]?.locked) { report.busy = true; await client.query("ROLLBACK"); return report; }
      const draftCutoff = msToDate(now.valueOf() - 30 * 86_400_000);
      const auditTwoYears = shiftCalendarYears(now, -2);
      const auditThreeYears = shiftCalendarYears(now, -3);
      const auditWhere = `((action ~ $3 AND created_at < $2) OR (action !~ $3 AND created_at < $1))`;
      report.drafts = await this.count(client, "SELECT count(*)::int AS count FROM article_draft WHERE updated_at <= $1", [draftCutoff]);
      report.emailDrafts = await this.count(client, "SELECT count(*)::int AS count FROM bulk_email WHERE status = 'DRAFT' AND updated_at <= $1", [draftCutoff]);
      report.auditLogs = await this.count(client, `SELECT count(*)::int AS count FROM audit_log WHERE ${auditWhere}`, [auditTwoYears, auditThreeYears, permissionAuditPattern]);
      report.deletedArticles = await this.count(client, "SELECT count(*)::int AS count FROM article WHERE status = 'DELETED'");
      report.deletedComments = await this.count(client, "SELECT count(*)::int AS count FROM comment WHERE status = 'DELETED'");
      if (!dryRun) {
        await client.query(`UPDATE audit_log SET payload = NULL WHERE
          (target_type = 'article_draft' AND target_id IN (SELECT draft_id::text FROM article_draft WHERE updated_at <= $1)) OR
          (target_type IN ('bulk_email', 'bulk_email_draft') AND target_id IN (SELECT id::text FROM bulk_email WHERE status = 'DRAFT' AND updated_at <= $1))`, [draftCutoff]);
        await client.query("DELETE FROM article_draft WHERE updated_at <= $1", [draftCutoff]);
        await client.query("DELETE FROM bulk_email WHERE status = 'DRAFT' AND updated_at <= $1", [draftCutoff]);
        await client.query(`DELETE FROM audit_log WHERE ${auditWhere}`, [auditTwoYears, auditThreeYears, permissionAuditPattern]);
        // Audit records retain the operation metadata, not copies of removed content.
        await client.query(`UPDATE audit_log SET payload = NULL WHERE
          (target_type = 'article' AND target_id IN (SELECT article_id::text FROM article WHERE status = 'DELETED')) OR
          (target_type = 'comment' AND target_id IN (SELECT comment_id::text FROM comment WHERE status = 'DELETED' OR article_id IN (SELECT article_id FROM article WHERE status = 'DELETED')))`);
        await client.query("DELETE FROM comment WHERE status = 'DELETED'");
        await client.query("DELETE FROM article WHERE status = 'DELETED'");
      }
      const due = await client.query<RetentionCase>(
        `SELECT * FROM privacy_retention_case WHERE completed_at IS NULL AND expires_at <= $1
           AND (hold_until IS NULL OR hold_until <= $1)
         ORDER BY updated_at, expires_at LIMIT 200 FOR UPDATE SKIP LOCKED`, [now],
      );
      for (const item of due.rows) {
        await client.query("SAVEPOINT retention_case");
        try {
          const source = await this.sourceState(client, item.kind, item.resource_id);
          if (!source.ready || source.version !== item.source_version || source.external) {
            report.cases.push({ kind: item.kind, resourceId: item.resource_id, count: 0, blocked: source.external ? "external_storage_connected" : "resource_changed_or_reopened" });
          } else {
            const count = await this.purgeCase(client, item, dryRun);
            if (!dryRun) {
              const completedVersion = item.kind === "SURVEY" || item.kind === "APPLICATION"
                ? (await this.sourceState(client, item.kind, item.resource_id)).version
                : source.version;
              await client.query(`UPDATE audit_log SET payload = NULL WHERE target_id = $1 OR strpos(COALESCE(payload, ''), $1) > 0`, [item.resource_id]);
              await client.query(`UPDATE privacy_retention_case SET completed_at = $3, deleted_count = $4,
                source_version = $5, created_by = NULL, hold_reason = NULL, hold_until = NULL, updated_at = $3 WHERE kind = $1 AND resource_id = $2`,
                [item.kind, item.resource_id, now, count, completedVersion]);
            }
            report.cases.push({ kind: item.kind, resourceId: item.resource_id, count });
          }
          await client.query("RELEASE SAVEPOINT retention_case");
        } catch (error) {
          await client.query("ROLLBACK TO SAVEPOINT retention_case");
          await client.query("RELEASE SAVEPOINT retention_case");
          report.cases.push({ kind: item.kind, resourceId: item.resource_id, count: 0,
            blocked: error instanceof NotFoundException ? "resource_not_found" : "cleanup_failed" });
        }
        if (!dryRun) await client.query("UPDATE privacy_retention_case SET updated_at = $3 WHERE kind = $1 AND resource_id = $2", [item.kind, item.resource_id, now]);
      }
      await client.query(dryRun ? "ROLLBACK" : "COMMIT");
      return report;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally { client.release(); }
  }

  private async count(client: PoolClient, query: string, values: unknown[] = []): Promise<number> {
    const result = await client.query(query, values);
    return Number(result.rows[0]?.count ?? 0);
  }

  private async sourceState(client: PoolClient, kind: RetentionKind, id: string): Promise<SourceState> {
    if (kind === "SURVEY" || kind === "APPLICATION") {
      const parent = await client.query("SELECT * FROM survey WHERE survey_id = $1 AND kind = $2 FOR UPDATE", [id, kind]);
      const source = parent.rows[0];
      if (!source) throw new NotFoundException("retention_resource_not_found");
      const activity = await client.query(
        `SELECT count(*)::int AS count, max(r.updated_at) AS latest_response,
          (SELECT max(a.updated_at) FROM survey_answers a JOIN survey_responses r2 ON r2.id = a.response_id WHERE r2.survey_id = $1) AS latest_answer
         FROM survey_responses r WHERE r.survey_id = $1`, [id],
      );
      const stats = activity.rows[0];
      // Administrative closing updates updated_at; response timestamps determine the business completion boundary.
      const changedAt = msToDate(Math.max(source.created_at.valueOf(), stats.latest_response?.valueOf() ?? 0, stats.latest_answer?.valueOf() ?? 0));
      return { ready: !source.accepting_responses, external: Boolean(source.spreadsheet_id), changed_at: changedAt,
        version: JSON.stringify([source.updated_at, source.close_at, source.accepting_responses, stats.count, stats.latest_response, stats.latest_answer]) };
    }
    if (kind === "VOTE") {
      const parent = await client.query("SELECT * FROM vote WHERE vote_id = $1 FOR UPDATE", [id]);
      const source = parent.rows[0];
      if (!source) throw new NotFoundException("retention_resource_not_found");
      return { ready: source.status === "TALLIED" && Boolean(source.results_published_at), external: false,
        changed_at: source.results_published_at ?? source.updated_at,
        version: JSON.stringify([source.updated_at, source.status, source.results_published_at]) };
    }
    const table = kind === "FEE_PAYMENT" ? "student_fee_payment" : "executive_contact";
    const key = kind === "FEE_PAYMENT" ? "payment_id" : "id";
    if (kind === "FEE_PAYMENT") {
      // Fee mutation also locks the user first; keep summary reconstruction atomic with new payments.
      await client.query("SELECT user_id FROM users WHERE user_id = (SELECT user_id FROM student_fee_payment WHERE payment_id = $1) FOR UPDATE", [id]);
    }
    const source = (await client.query(`SELECT * FROM ${table} WHERE ${key} = $1 FOR UPDATE`, [id])).rows[0];
    if (!source) throw new NotFoundException("retention_resource_not_found");
    const changedAt = kind === "FEE_PAYMENT"
      ? msToDate(Math.max(source.paid_at.valueOf(), feeCoverageEnd(source.effective_start_semester, source.coverage_semesters).valueOf()))
      : source.created_at;
    return { ready: true, external: false, changed_at: changedAt,
      version: JSON.stringify([source.updated_at]) };
  }

  private async purgeCase(client: PoolClient, item: RetentionCase, dryRun: boolean): Promise<number> {
    const id = item.resource_id;
    if (item.kind === "SURVEY" || item.kind === "APPLICATION") {
      const count = await this.count(client, "SELECT count(*)::int AS count FROM survey_responses WHERE survey_id = $1", [id]);
      if (!dryRun) {
        await client.query("DELETE FROM survey_responses WHERE survey_id = $1", [id]);
        await client.query("DELETE FROM survey_response_subscription WHERE survey_id = $1", [id]);
        await client.query("UPDATE survey SET result_visibility = 'PRIVATE' WHERE survey_id = $1", [id]);
      }
      return count;
    }
    if (item.kind === "VOTE") {
      const counts = (await client.query(`SELECT count(*) filter (WHERE status = 'ELIGIBLE')::int AS eligible,
        count(*) filter (WHERE status = 'ELIGIBLE' AND has_voted)::int AS voted, count(*)::int AS total FROM vote_voter WHERE vote_id = $1`, [id])).rows[0];
      const ballots = await this.count(client, "SELECT count(*)::int AS count FROM vote_ballot WHERE vote_id = $1", [id]);
      if (!dryRun) {
        // Keep anonymous aggregate results and participation counts after destroying individual records and keys.
        const tally = await client.query(`UPDATE vote_tally SET result = result || jsonb_build_object('_retentionEligibleCount', $2::int, '_retentionVotedCount', $3::int)
          WHERE vote_id = $1 RETURNING vote_id`, [id, counts.eligible, counts.voted]);
        if (!tally.rowCount) throw new ConflictException("retention_tally_missing");
        await client.query("DELETE FROM vote_ballot WHERE vote_id = $1", [id]);
        await client.query("DELETE FROM vote_voter WHERE vote_id = $1", [id]);
        await client.query("UPDATE vote SET encrypted_ballot_key = NULL, key_iv = NULL, key_tag = NULL WHERE vote_id = $1", [id]);
      }
      return Number(counts.total) + ballots;
    }
    if (item.kind === "FEE_PAYMENT") {
      if (dryRun) return 1;
      const deleted = await client.query("DELETE FROM student_fee_payment WHERE payment_id = $1 RETURNING user_id", [id]);
      if (deleted.rows[0]) {
        const userId = deleted.rows[0].user_id;
        await client.query(`UPDATE student_fee_status s SET coverage_semesters = p.coverage_semesters,
          paid_amount = p.amount, status = 'PAID', paid_at = p.paid_at, note = p.note,
          verified_by = p.recorded_by, verified_at = NULL, updated_at = now()
          FROM (SELECT * FROM student_fee_payment WHERE user_id = $1 ORDER BY paid_at DESC, created_at DESC LIMIT 1) p
          WHERE s.user_id = $1`, [userId]);
        await client.query(`DELETE FROM student_fee_status WHERE user_id = $1 AND NOT EXISTS
          (SELECT 1 FROM student_fee_payment WHERE user_id = $1)`, [userId]);
        // Do not leave an expired payment's personal data in an idempotent response cache.
        // The key and hash remain to reject accidental replay without creating a new payment.
        await client.query("UPDATE student_fee_payment_batch SET result = NULL WHERE strpos(COALESCE(result::text, ''), $1) > 0", [id]);
      }
      return deleted.rowCount ?? 0;
    }
    if (dryRun) return 1;
    const deleted = await client.query("DELETE FROM executive_contact WHERE id = $1", [id]);
    return deleted.rowCount ?? 0;
  }
}
