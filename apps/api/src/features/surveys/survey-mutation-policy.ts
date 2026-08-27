import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { eq } from "drizzle-orm";

import {
  DRIZZLE_DB,
  PostgresDatabase,
  PostgresTransaction,
} from "../../infrastructure/postgres/postgres.provider";
import {
  surveys,
} from "../../infrastructure/postgres/postgres.schema";

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
    return this.withSurveyLock(surveyId, mutation);
  }

  async withHardDelete<T>(
    surveyId: string,
    mutation: LockedSurveyMutation<T>,
  ): Promise<T> {
    return this.withSurveyLock(surveyId, mutation);
  }

}
