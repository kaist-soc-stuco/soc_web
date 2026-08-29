import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Cron } from "@nestjs/schedule";
import { and, eq, inArray, lte } from "drizzle-orm";
import { msToDate, nowDate, nowMs } from "@soc/shared";

import {
  DRIZZLE_DB,
  PostgresDatabase,
} from "../../infrastructure/postgres/postgres.provider";
import {
  calendarEvents,
  calendarSyncJobs,
} from "../../infrastructure/postgres/postgres.schema";
import { GoogleCalendarApiError, GoogleCalendarClient, GoogleCalendarConflictError, type GoogleCalendarEventResource } from "./google-calendar.client";
import { KaistAcademicCalendarSource } from "./kaist-academic-calendar.source";
import {
  addSeoulDays,
  formatSeoulDate,
  SEOUL_TIME_ZONE,
  seoulYear,
} from "./calendar.utils";

const MANUAL_SOURCE = "MANUAL";
const KAIST_SOURCE = "KAIST_ACADEMIC";
const UPSERT_OPERATION = "UPSERT";
const DELETE_OPERATION = "DELETE";
const PENDING_STATUS = "PENDING";
const PROCESSING_STATUS = "PROCESSING";
const SUCCEEDED_STATUS = "SUCCEEDED";
const FAILED_STATUS = "FAILED";
const MAX_ATTEMPTS = 8;

type CalendarEventRow = typeof calendarEvents.$inferSelect;

@Injectable()
export class CalendarSyncService {
  private readonly logger = new Logger(CalendarSyncService.name);

  constructor(
    @Inject(DRIZZLE_DB) private readonly db: PostgresDatabase,
    private readonly configService: ConfigService,
    private readonly kaistSource: KaistAcademicCalendarSource,
    private readonly googleCalendar: GoogleCalendarClient,
  ) {}

  async enqueueEvent(calendarEventId: number): Promise<boolean> {
    const [row] = await this.db
      .select()
      .from(calendarEvents)
      .where(eq(calendarEvents.calendarEventId, calendarEventId));
    if (!row) return false;

    const targetCalendarId = this.targetCalendarId(row.sourceType);
    if (!targetCalendarId || !this.isTargetEnabled(row.sourceType)) {
      await this.db
        .update(calendarEvents)
        .set({
          googleSyncStatus: "NOT_CONFIGURED",
          googleSyncError: null,
          updatedAt: nowDate(),
        })
        .where(eq(calendarEvents.calendarEventId, calendarEventId));
      return false;
    }

    await this.db
      .insert(calendarSyncJobs)
      .values({
        calendarEventId,
        targetCalendarId,
        operation: row.isActive && !row.isHiddenByAdmin ? UPSERT_OPERATION : DELETE_OPERATION,
        status: PENDING_STATUS,
        attempts: 0,
        availableAt: nowDate(),
        lockedAt: null,
        lastError: null,
      })
      .onConflictDoUpdate({
        target: [calendarSyncJobs.calendarEventId, calendarSyncJobs.targetCalendarId],
        set: {
          operation: row.isActive && !row.isHiddenByAdmin ? UPSERT_OPERATION : DELETE_OPERATION,
          status: PENDING_STATUS,
          attempts: 0,
          availableAt: nowDate(),
          lockedAt: null,
          lastError: null,
          updatedAt: nowDate(),
        },
      });

    await this.db
      .update(calendarEvents)
      .set({
        googleCalendarId: targetCalendarId,
        googleSyncStatus: "PENDING",
        googleSyncError: null,
        updatedAt: nowDate(),
      })
      .where(eq(calendarEvents.calendarEventId, calendarEventId));

    return true;
  }

  async syncKaistAcademicCalendar(year: number): Promise<{
    year: number;
    fetchedCount: number;
    insertedCount: number;
    updatedCount: number;
    unchangedCount: number;
    archivedCount: number;
    googleQueuedCount: number;
    failedMonths: number[];
  }> {
    const fetched = await this.kaistSource.fetchYear(year);
    const existingRows = await this.db
      .select()
      .from(calendarEvents)
      .where(
        and(
          eq(calendarEvents.sourceType, KAIST_SOURCE),
          eq(calendarEvents.sourceYear, year),
        ),
      );
    const existingByUid = new Map(
      existingRows
        .filter((row) => row.sourceUid)
        .map((row) => [row.sourceUid as string, row]),
    );
    const seen = new Set<string>();
    let insertedCount = 0;
    let updatedCount = 0;
    let unchangedCount = 0;
    let archivedCount = 0;
    let googleQueuedCount = 0;

    for (const item of fetched.items) {
      seen.add(item.sourceUid);
      const current = existingByUid.get(item.sourceUid);

      if (!current) {
        const [row] = await this.db
          .insert(calendarEvents)
          .values({
            titleKo: item.titleKo,
            startAt: item.startAt,
            endAt: item.endAt,
            sourceUid: item.sourceUid,
            sourceType: KAIST_SOURCE,
            sourceYear: item.sourceYear,
            sourceHash: item.sourceHash,
            isReadOnly: true,
            isActive: true,
            createdByUserId: null,
          })
          .returning();
        insertedCount += 1;
        if (await this.enqueueEvent(row.calendarEventId)) googleQueuedCount += 1;
        continue;
      }

      const changed = current.titleKo !== item.titleKo ||
        current.startAt.valueOf() !== item.startAt.valueOf() ||
        current.endAt.valueOf() !== item.endAt.valueOf() ||
        current.sourceHash !== item.sourceHash ||
        !current.isActive ||
        !current.isReadOnly;

      if (!changed) {
        unchangedCount += 1;
        continue;
      }

      const [row] = await this.db
        .update(calendarEvents)
        .set({
          titleKo: item.titleKo,
          titleEn: null,
          descriptionKo: null,
          descriptionEn: null,
          startAt: item.startAt,
          endAt: item.endAt,
          sourceUid: item.sourceUid,
          sourceType: KAIST_SOURCE,
          sourceYear: item.sourceYear,
          sourceHash: item.sourceHash,
          isReadOnly: true,
          isActive: true,
          createdByUserId: null,
          updatedAt: nowDate(),
        })
        .where(eq(calendarEvents.calendarEventId, current.calendarEventId))
        .returning();
      updatedCount += 1;
      if (row && await this.enqueueEvent(row.calendarEventId)) googleQueuedCount += 1;
    }

    // A partially failed crawl must never hide events merely because a month
    // was temporarily unavailable. Archive only after all 12 months succeed.
    if (fetched.failedMonths.length === 0) {
      for (const row of existingRows) {
        if (!row.sourceUid || seen.has(row.sourceUid) || !row.isActive) continue;
        const [archived] = await this.db
          .update(calendarEvents)
          .set({ isActive: false, updatedAt: nowDate() })
          .where(eq(calendarEvents.calendarEventId, row.calendarEventId))
          .returning({ calendarEventId: calendarEvents.calendarEventId });
        if (!archived) continue;
        archivedCount += 1;
        if (await this.enqueueEvent(row.calendarEventId)) googleQueuedCount += 1;
      }
    }

    return {
      year,
      fetchedCount: fetched.items.length,
      insertedCount,
      updatedCount,
      unchangedCount,
      archivedCount,
      googleQueuedCount,
      failedMonths: fetched.failedMonths,
    };
  }

  async syncGoogleCalendars(): Promise<{
    queuedCount: number;
    processedCount: number;
    succeededCount: number;
    failedCount: number;
  }> {
    let queuedCount = 0;
    const rows = await this.db
      .select({ calendarEventId: calendarEvents.calendarEventId })
      .from(calendarEvents)
      .where(inArray(calendarEvents.sourceType, [MANUAL_SOURCE, KAIST_SOURCE]));

    for (const row of rows) {
      if (await this.enqueueEvent(row.calendarEventId)) queuedCount += 1;
    }

    let processedCount = 0;
    let succeededCount = 0;
    let failedCount = 0;
    for (let batch = 0; batch < 5; batch += 1) {
      const result = await this.processPendingJobs(100);
      processedCount += result.processedCount;
      succeededCount += result.succeededCount;
      failedCount += result.failedCount;
      if (result.processedCount === 0) break;
    }

    return { queuedCount, processedCount, succeededCount, failedCount };
  }

  async processPendingJobs(limit = 50): Promise<{
    processedCount: number;
    succeededCount: number;
    failedCount: number;
  }> {
    if (!this.googleCalendar.isConfigured()) {
      return { processedCount: 0, succeededCount: 0, failedCount: 0 };
    }

    const staleLockAt = msToDate(nowMs() - 10 * 60 * 1_000);
    await this.db
      .update(calendarSyncJobs)
      .set({ status: PENDING_STATUS, lockedAt: null, updatedAt: nowDate() })
      .where(
        and(
          eq(calendarSyncJobs.status, PROCESSING_STATUS),
          lte(calendarSyncJobs.lockedAt, staleLockAt),
        ),
      );

    const dueJobs = await this.db
      .select()
      .from(calendarSyncJobs)
      .where(
        and(
          eq(calendarSyncJobs.status, PENDING_STATUS),
          lte(calendarSyncJobs.availableAt, nowDate()),
        ),
      )
      .orderBy(calendarSyncJobs.availableAt, calendarSyncJobs.calendarSyncJobId)
      .limit(limit);

    let processedCount = 0;
    let succeededCount = 0;
    let failedCount = 0;

    for (const candidate of dueJobs) {
      const [job] = await this.db
        .update(calendarSyncJobs)
        .set({
          status: PROCESSING_STATUS,
          attempts: candidate.attempts + 1,
          lockedAt: nowDate(),
          updatedAt: nowDate(),
        })
        .where(
          and(
            eq(calendarSyncJobs.calendarSyncJobId, candidate.calendarSyncJobId),
            eq(calendarSyncJobs.status, PENDING_STATUS),
          ),
        )
        .returning();
      if (!job) continue;

      processedCount += 1;
      try {
        await this.processJob(job.calendarSyncJobId);
        succeededCount += 1;
      } catch (error) {
        failedCount += 1;
        await this.markJobFailed(job, error);
      }
    }

    return { processedCount, succeededCount, failedCount };
  }

  @Cron("*/1 * * * *")
  async processGoogleCalendarQueue(): Promise<void> {
    if (!this.isAnyGoogleSyncEnabled()) return;
    try {
      await this.processPendingJobs(50);
    } catch (error) {
      this.logger.error(
        `Google Calendar queue failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  @Cron("0 4 * * *", { timeZone: SEOUL_TIME_ZONE })
  async syncKaistAcademicCalendarDaily(): Promise<void> {
    if (!this.configService.get<boolean>("KAIST_CALENDAR_SYNC_ENABLED", false)) return;
    const year = seoulYear();
    try {
      const result = await this.syncKaistAcademicCalendar(year);
      this.logger.log(
        `KAIST academic calendar ${year}: ${result.fetchedCount} fetched, ${result.insertedCount} inserted, ${result.updatedCount} updated, ${result.archivedCount} archived${result.failedMonths.length ? `; failed months ${result.failedMonths.join(",")}` : ""}`,
      );
    } catch (error) {
      this.logger.error(
        `KAIST academic calendar sync failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async processJob(jobId: number): Promise<void> {
    const [job] = await this.db
      .select()
      .from(calendarSyncJobs)
      .where(eq(calendarSyncJobs.calendarSyncJobId, jobId));
    if (!job) return;

    const [row] = await this.db
      .select()
      .from(calendarEvents)
      .where(eq(calendarEvents.calendarEventId, job.calendarEventId));
    if (!row) {
      await this.db
        .update(calendarSyncJobs)
        .set({ status: SUCCEEDED_STATUS, lockedAt: null, lastError: null, updatedAt: nowDate() })
        .where(eq(calendarSyncJobs.calendarSyncJobId, jobId));
      return;
    }

    if (job.operation === DELETE_OPERATION) {
      if (row.googleCalendarId === job.targetCalendarId && row.googleEventId) {
        await this.googleCalendar.deleteEvent({
          calendarId: job.targetCalendarId,
          eventId: row.googleEventId,
          etag: row.googleEtag,
        });
      }
      await this.markJobSucceeded(jobId);
      await this.markEventSynced(row.calendarEventId, job.targetCalendarId, row.googleEventId, row.googleEtag);
      return;
    }

    const existingEventId = row.googleCalendarId === job.targetCalendarId
      ? row.googleEventId
      : null;
    const result = await this.googleCalendar.upsertEvent({
      calendarId: job.targetCalendarId,
      eventId: existingEventId,
      etag: existingEventId ? row.googleEtag : null,
      resource: this.toGoogleResource(row),
    });

    await this.db
      .update(calendarEvents)
      .set({
        googleCalendarId: job.targetCalendarId,
        googleEventId: result.eventId,
        googleEtag: result.etag,
        googleSyncStatus: "SYNCED",
        googleSyncedAt: nowDate(),
        googleSyncError: null,
        updatedAt: nowDate(),
      })
      .where(eq(calendarEvents.calendarEventId, row.calendarEventId));
    await this.markJobSucceeded(jobId);
  }

  private async markJobSucceeded(jobId: number): Promise<void> {
    await this.db
      .update(calendarSyncJobs)
      .set({ status: SUCCEEDED_STATUS, lockedAt: null, lastError: null, updatedAt: nowDate() })
      .where(eq(calendarSyncJobs.calendarSyncJobId, jobId));
  }

  private async markEventSynced(
    eventId: number,
    calendarId: string,
    googleEventId: string | null,
    googleEtag: string | null,
  ): Promise<void> {
    await this.db
      .update(calendarEvents)
      .set({
        googleCalendarId: calendarId,
        googleEventId,
        googleEtag,
        googleSyncStatus: "SYNCED",
        googleSyncedAt: nowDate(),
        googleSyncError: null,
        updatedAt: nowDate(),
      })
      .where(eq(calendarEvents.calendarEventId, eventId));
  }

  private async markJobFailed(
    job: typeof calendarSyncJobs.$inferSelect,
    error: unknown,
  ): Promise<void> {
    const message = sanitizeError(error);
    const conflict = error instanceof GoogleCalendarConflictError;
    const terminal = conflict || job.attempts >= MAX_ATTEMPTS;
    const retryDelay = Math.min(60 * 60 * 1_000, 30 * 1_000 * 2 ** Math.max(job.attempts - 1, 0));

    await this.db
      .update(calendarSyncJobs)
      .set({
        status: terminal ? FAILED_STATUS : PENDING_STATUS,
        availableAt: msToDate(nowMs() + retryDelay),
        lockedAt: null,
        lastError: message,
        updatedAt: nowDate(),
      })
      .where(eq(calendarSyncJobs.calendarSyncJobId, job.calendarSyncJobId));
    await this.db
      .update(calendarEvents)
      .set({
        googleSyncStatus: conflict ? "CONFLICT" : "FAILED",
        googleSyncError: message,
        updatedAt: nowDate(),
      })
      .where(eq(calendarEvents.calendarEventId, job.calendarEventId));
  }

  private toGoogleResource(row: CalendarEventRow): GoogleCalendarEventResource {
    const isAllDay = row.isAllDay || row.sourceType === KAIST_SOURCE;
    const resource: GoogleCalendarEventResource = isAllDay
      ? {
          summary: row.titleKo,
          start: { date: formatSeoulDate(row.startAt) },
          end: { date: formatSeoulDate(addSeoulDays(row.endAt, 1)) },
        }
      : {
          summary: row.titleKo,
          start: { dateTime: row.startAt.toISOString(), timeZone: SEOUL_TIME_ZONE },
          end: { dateTime: row.endAt.toISOString(), timeZone: SEOUL_TIME_ZONE },
        };

    if (row.descriptionKo) resource.description = row.descriptionKo;
    if (row.location) resource.location = row.location;
    resource.extendedProperties = {
      private: {
        socCalendarEventId: String(row.calendarEventId),
        socSourceType: row.sourceType,
        socSourceUid: row.sourceUid ?? "",
      },
    };
    return resource;
  }

  private targetCalendarId(sourceType: string): string | null {
    const key = sourceType === KAIST_SOURCE ? "GOOGLE_KAIST_CALENDAR_ID" : "GOOGLE_CALENDAR_ID";
    return this.configService.get<string>(key)?.trim() || null;
  }

  private isTargetEnabled(sourceType: string): boolean {
    const key = sourceType === KAIST_SOURCE
      ? "KAIST_CALENDAR_SYNC_ENABLED"
      : "GOOGLE_CALENDAR_SYNC_ENABLED";
    return this.configService.get<boolean>(key, false) && this.googleCalendar.isConfigured();
  }

  private isAnyGoogleSyncEnabled(): boolean {
    return this.configService.get<boolean>("GOOGLE_CALENDAR_SYNC_ENABLED", false) ||
      this.configService.get<boolean>("KAIST_CALENDAR_SYNC_ENABLED", false);
  }
}

function sanitizeError(error: unknown): string {
  if (error instanceof GoogleCalendarApiError) {
    return `${error.name}:${error.statusCode}:${error.message}`.slice(0, 1_000);
  }
  return (error instanceof Error ? error.message : String(error)).replace(/\s+/g, " ").slice(0, 1_000);
}
