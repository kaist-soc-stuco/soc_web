import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { and, eq, sql } from "drizzle-orm";

import {
  DRIZZLE_DB,
  PostgresDatabase,
  PostgresTransaction,
} from "../../infrastructure/postgres/postgres.provider";
import {
  surveyResponses,
  surveys,
} from "../../infrastructure/postgres/postgres.schema";

import type { SurveyRecord } from "./entities/survey.entity";
import type { UpdateSurveyDto } from "./dto/update-survey.dto";

const normalizeOptionalText = (value: string | null | undefined): string =>
  value?.trim() ?? "";

export function changesSurveyMeaning(
  current: SurveyRecord,
  dto: UpdateSurveyDto,
): boolean {
  if (dto.kind !== undefined && dto.kind !== current.kind) return true;
  if (dto.titleKo !== undefined && dto.titleKo.trim() !== current.titleKo.trim()) {
    return true;
  }
  if (
    dto.titleEn !== undefined &&
    normalizeOptionalText(dto.titleEn) !== normalizeOptionalText(current.titleEn)
  ) {
    return true;
  }
  if (
    dto.descriptionKo !== undefined &&
    normalizeOptionalText(dto.descriptionKo) !==
      normalizeOptionalText(current.descriptionKo)
  ) {
    return true;
  }
  if (
    dto.descriptionEn !== undefined &&
    normalizeOptionalText(dto.descriptionEn) !==
      normalizeOptionalText(current.descriptionEn)
  ) {
    return true;
  }

  const currentFeePolicy = current.feePayersOnly ? "PAID_ONLY" : "NONE";
  if (
    dto.feeRequirementPolicy !== undefined &&
    dto.feeRequirementPolicy !== currentFeePolicy
  ) {
    return true;
  }
  if (
    dto.allowMultipleResponses !== undefined &&
    dto.allowMultipleResponses !== current.allowMultipleResponses
  ) {
    return true;
  }
  if (
    dto.allowResponseEdit !== undefined &&
    dto.allowResponseEdit !== current.allowResponseEdit
  ) {
    return true;
  }
  if (
    dto.isKoreanOnly !== undefined &&
    dto.isKoreanOnly !== current.isKoreanOnly
  ) {
    return true;
  }

  return false;
}

interface LockedSurvey {
  id: string;
  lifecycleStatus: string;
}

type LockedSurveyMutation<T> = (
  tx: PostgresTransaction,
  survey: LockedSurvey,
) => Promise<T>;

@Injectable()
export class SurveyMutationPolicy {
  constructor(@Inject(DRIZZLE_DB) private readonly db: PostgresDatabase) {}

  /**
   * All operations that race with response insertion serialize on this row.
   * The callback is part of this transaction, so callers cannot accidentally
   * split the response check and the mutation across commits.
   */
  async withSurveyLock<T>(
    surveyId: string,
    mutation: LockedSurveyMutation<T>,
  ): Promise<T> {
    return this.db.transaction(async (tx) => {
      const [lockedSurvey] = await tx
        .select({
          id: surveys.surveyId,
          lifecycleStatus: surveys.lifecycleStatus,
        })
        .from(surveys)
        .where(eq(surveys.surveyId, surveyId))
        .for("update");

      if (!lockedSurvey) {
        throw new NotFoundException("survey_not_found");
      }

      return mutation(tx, lockedSurvey);
    });
  }

  async withStructureMutation<T>(
    surveyId: string,
    mutation: LockedSurveyMutation<T>,
  ): Promise<T> {
    return this.withSurveyLock(surveyId, async (tx, survey) => {
      if (survey.lifecycleStatus === "ARCHIVED") {
        throw new ConflictException("survey_archived_immutable");
      }
      await this.assertNoSubmittedResponses(
        tx,
        surveyId,
        "survey_structure_locked_after_response",
      );
      return mutation(tx, survey);
    });
  }

  async withHardDelete<T>(
    surveyId: string,
    mutation: LockedSurveyMutation<T>,
  ): Promise<T> {
    return this.withSurveyLock(surveyId, async (tx, survey) => {
      if (survey.lifecycleStatus !== "DRAFT") {
        throw new ConflictException("survey_delete_requires_draft");
      }
      await this.assertNoSubmittedResponses(
        tx,
        surveyId,
        "survey_delete_blocked_after_response",
      );
      await this.assertNoDerivedVersions(tx, surveyId);
      return mutation(tx, survey);
    });
  }

  async assertMeaningMutable(
    tx: PostgresTransaction,
    surveyId: string,
    current: SurveyRecord,
    dto: UpdateSurveyDto,
  ): Promise<void> {
    if (!changesSurveyMeaning(current, dto)) return;

    await this.assertNoSubmittedResponses(
      tx,
      surveyId,
      "survey_meaning_locked_after_response",
    );
  }

  private async assertNoSubmittedResponses(
    tx: PostgresTransaction,
    surveyId: string,
    conflictCode: string,
  ): Promise<void> {
    const [result] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(surveyResponses)
      .where(
        and(
          eq(surveyResponses.surveyId, surveyId),
          eq(surveyResponses.status, "submitted"),
        ),
      );

    if ((result?.count ?? 0) > 0) {
      throw new ConflictException(conflictCode);
    }
  }

  private async assertNoDerivedVersions(
    tx: PostgresTransaction,
    surveyId: string,
  ): Promise<void> {
    const [result] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(surveys)
      .where(eq(surveys.previousVersionId, surveyId));

    if ((result?.count ?? 0) > 0) {
      throw new ConflictException("survey_delete_blocked_by_versions");
    }
  }
}
