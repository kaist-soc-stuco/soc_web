import { Inject, Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { and, eq, lte, sql } from "drizzle-orm";
import { msToDate, nowDate, nowMs } from "@soc/shared";

import {
  DRIZZLE_DB,
  type PostgresDatabase,
} from "../postgres/postgres.provider";
import { googleSpreadsheetSyncJobs } from "../postgres/postgres.schema";

export const GOOGLE_SHEET_RESOURCE = {
  CONTACTS: "CONTACTS",
  STUDENT_FEES: "STUDENT_FEES",
  SURVEY: "SURVEY",
} as const;

type GoogleSheetResourceType =
  (typeof GOOGLE_SHEET_RESOURCE)[keyof typeof GOOGLE_SHEET_RESOURCE];
type SyncHandler = (resourceKey: string) => Promise<void>;

const PENDING = "PENDING";
const PROCESSING = "PROCESSING";
const SUCCEEDED = "SUCCEEDED";
const FAILED = "FAILED";
const MAX_ATTEMPTS = 8;

/**
 * Google API 호출을 사용자 요청에서 분리하는 DB 기반 coalescing queue입니다.
 * 같은 리소스의 연속 변경은 한 작업으로 합치며 실패 작업은 지수 backoff로 재시도합니다.
 */
@Injectable()
export class GoogleSpreadsheetSyncQueueService {
  private readonly logger = new Logger(GoogleSpreadsheetSyncQueueService.name);
  private readonly handlers = new Map<GoogleSheetResourceType, SyncHandler>();

  constructor(
    @Inject(DRIZZLE_DB) private readonly db: PostgresDatabase,
  ) {}

  registerHandler(resourceType: GoogleSheetResourceType, handler: SyncHandler): void {
    this.handlers.set(resourceType, handler);
  }

  async enqueue(resourceType: GoogleSheetResourceType, resourceKey = "global"): Promise<void> {
    await this.db
      .insert(googleSpreadsheetSyncJobs)
      .values({
        resourceType,
        resourceKey,
        status: PENDING,
        revision: 1,
        attempts: 0,
        availableAt: nowDate(),
        lockedAt: null,
        lastError: null,
      })
      .onConflictDoUpdate({
        target: [
          googleSpreadsheetSyncJobs.resourceType,
          googleSpreadsheetSyncJobs.resourceKey,
        ],
        set: {
          status: PENDING,
          revision: sql`${googleSpreadsheetSyncJobs.revision} + 1`,
          attempts: 0,
          availableAt: nowDate(),
          lockedAt: null,
          lastError: null,
          updatedAt: nowDate(),
        },
      });
  }

  async processPendingJobs(limit = 25): Promise<{
    processedCount: number;
    succeededCount: number;
    failedCount: number;
  }> {
    const staleLockAt = msToDate(nowMs() - 10 * 60 * 1_000);
    await this.db
      .update(googleSpreadsheetSyncJobs)
      .set({ status: PENDING, lockedAt: null, updatedAt: nowDate() })
      .where(
        and(
          eq(googleSpreadsheetSyncJobs.status, PROCESSING),
          lte(googleSpreadsheetSyncJobs.lockedAt, staleLockAt),
        ),
      );

    const dueJobs = await this.db
      .select()
      .from(googleSpreadsheetSyncJobs)
      .where(
        and(
          eq(googleSpreadsheetSyncJobs.status, PENDING),
          lte(googleSpreadsheetSyncJobs.availableAt, nowDate()),
        ),
      )
      .orderBy(
        googleSpreadsheetSyncJobs.availableAt,
        googleSpreadsheetSyncJobs.googleSpreadsheetSyncJobId,
      )
      .limit(limit);

    let processedCount = 0;
    let succeededCount = 0;
    let failedCount = 0;

    for (const candidate of dueJobs) {
      const [job] = await this.db
        .update(googleSpreadsheetSyncJobs)
        .set({
          status: PROCESSING,
          attempts: candidate.attempts + 1,
          lockedAt: nowDate(),
          updatedAt: nowDate(),
        })
        .where(
          and(
            eq(
              googleSpreadsheetSyncJobs.googleSpreadsheetSyncJobId,
              candidate.googleSpreadsheetSyncJobId,
            ),
            eq(googleSpreadsheetSyncJobs.status, PENDING),
            eq(googleSpreadsheetSyncJobs.revision, candidate.revision),
          ),
        )
        .returning();
      if (!job) continue;

      processedCount += 1;
      try {
        const handler = this.handlers.get(job.resourceType as GoogleSheetResourceType);
        if (!handler) throw new Error(`google_sheet_sync_handler_missing:${job.resourceType}`);
        await handler(job.resourceKey);
        await this.markSucceeded(job);
        succeededCount += 1;
      } catch (error) {
        await this.markFailed(job, error);
        failedCount += 1;
      }
    }

    return { processedCount, succeededCount, failedCount };
  }

  @Cron("*/10 * * * * *")
  async processQueue(): Promise<void> {
    try {
      await this.processPendingJobs();
    } catch (error) {
      this.logger.error(
        `Google Sheets queue failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async markSucceeded(
    job: typeof googleSpreadsheetSyncJobs.$inferSelect,
  ): Promise<void> {
    await this.db
      .update(googleSpreadsheetSyncJobs)
      .set({
        status: SUCCEEDED,
        lockedAt: null,
        lastError: null,
        updatedAt: nowDate(),
      })
      .where(this.currentClaim(job));
  }

  private async markFailed(
    job: typeof googleSpreadsheetSyncJobs.$inferSelect,
    error: unknown,
  ): Promise<void> {
    const terminal = job.attempts >= MAX_ATTEMPTS;
    const retryDelay = Math.min(
      60 * 60 * 1_000,
      15 * 1_000 * 2 ** Math.max(job.attempts - 1, 0),
    );
    const message = (error instanceof Error ? error.message : String(error))
      .replace(/\s+/g, " ")
      .slice(0, 1_000);

    await this.db
      .update(googleSpreadsheetSyncJobs)
      .set({
        status: terminal ? FAILED : PENDING,
        availableAt: msToDate(nowMs() + retryDelay),
        lockedAt: null,
        lastError: message,
        updatedAt: nowDate(),
      })
      .where(this.currentClaim(job));
  }

  private currentClaim(job: typeof googleSpreadsheetSyncJobs.$inferSelect) {
    return and(
      eq(
        googleSpreadsheetSyncJobs.googleSpreadsheetSyncJobId,
        job.googleSpreadsheetSyncJobId,
      ),
      eq(googleSpreadsheetSyncJobs.status, PROCESSING),
      eq(googleSpreadsheetSyncJobs.revision, job.revision),
    );
  }
}
