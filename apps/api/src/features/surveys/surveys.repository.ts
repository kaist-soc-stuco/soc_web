import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, inArray, lt, or, sql } from 'drizzle-orm';
import { DRIZZLE_DB, type PostgresDatabase } from '../../infrastructure/postgres/postgres.provider';
import { articles, contentMatchers, events, surveyAuditLog, surveyChoiceOptions, surveyExports, surveyGuestIdentityHashes, surveyResponseAnswers, surveyResponses, surveyRevisions, surveySections, surveyQuestions, surveys, users } from '../../infrastructure/postgres/postgres.schema';
type Tx = Parameters<Parameters<PostgresDatabase['transaction']>[0]>[0];
type LocalizedText = { kr: string; en: string };
type SurveyQuestionInput = {
  ordinal: number;
  type: typeof surveyQuestions.$inferInsert.type;
  prompt: LocalizedText;
  helpText?: LocalizedText | null;
  required: boolean;
  validationRegex?: string | null;
  numberMin?: number | null;
  numberMax?: number | null;
  dateMin?: string | null;
  dateMax?: string | null;
  choices?: Array<{ ordinal: number; value: LocalizedText }>;
};
@Injectable()
export class SurveysRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: PostgresDatabase) {}
  async listPublic() {
    return this.list(inArray(surveys.state, ['SCHEDULED', 'OPEN', 'CLOSED']));
  }
  async listAll() { return this.list(); }
  async survey(id: string) { const [row] = await this.db.select().from(surveys).where(eq(surveys.id, id)); return row ?? null; }
  async detail(id: string) { const survey = await this.survey(id); if (!survey) return null; const [revision] = await this.db.select().from(surveyRevisions).where(and(eq(surveyRevisions.surveyId, id), eq(surveyRevisions.revision, survey.currentRevision))); if (!revision) return null; const sections = await this.db.select().from(surveySections).where(eq(surveySections.surveyRevisionId, revision.id)).orderBy(asc(surveySections.ordinal), asc(surveySections.id)); const questions = sections.length ? await this.db.select().from(surveyQuestions).where(inArray(surveyQuestions.sectionId, sections.map((x) => x.id))).orderBy(asc(surveyQuestions.ordinal), asc(surveyQuestions.id)) : []; const choices = questions.length ? await this.db.select().from(surveyChoiceOptions).where(inArray(surveyChoiceOptions.questionId, questions.map((x) => x.id))).orderBy(asc(surveyChoiceOptions.ordinal), asc(surveyChoiceOptions.id)) : []; return { survey, revision, sections, questions, choices }; }
  async create(
    input: typeof surveys.$inferInsert,
    revision: Omit<typeof surveyRevisions.$inferInsert, 'surveyId'>,
    correlationId: string,
  ) {
    return this.db.transaction(async (tx) => {
      const [survey] = await tx.insert(surveys).values(input).returning();
      const [created] = await tx.insert(surveyRevisions).values({ ...revision, surveyId: survey.id }).returning();
      await this.audit(tx, survey.id, null, input.createdByUserId, 'SURVEY_CREATED', 'state,revision,settings', correlationId);
      return { survey, revision: created };
    });
  }
  async patch(
    id: string,
    actor: string,
    values: Partial<typeof surveys.$inferInsert>,
    revisionValues: Partial<Pick<typeof surveyRevisions.$inferInsert, 'titleKr' | 'titleEn' | 'descriptionKr' | 'descriptionEn'>>,
    correlationId: string,
  ) {
    return this.db.transaction(async (tx) => {
      const revision = await this.lockDraft(tx, id);
      if (!revision) {
        const exists = await this.exists(tx, id);
        return exists ? 'IMMUTABLE' as const : null;
      }
      const [current] = await tx.select().from(surveys).where(eq(surveys.id, id)).for('update');
      if (!current) return null;
      const guestAllowed = values.guestAllowed ?? current.guestAllowed;
      const phoneRequired = values.phoneRequired ?? current.phoneRequired;
      const opensAt = values.opensAt === undefined ? current.opensAt : values.opensAt;
      const closesAt = values.closesAt === undefined ? current.closesAt : values.closesAt;
      const editDeadlineAt = values.editDeadlineAt === undefined ? current.editDeadlineAt : values.editDeadlineAt;
      if (
        (phoneRequired && !guestAllowed)
        || (opensAt && closesAt && opensAt >= closesAt)
        || (editDeadlineAt && closesAt && editDeadlineAt > closesAt)
      ) {
        return 'INVALID_SETTINGS' as const;
      }
      const [updated] = await tx.update(surveys).set(values).where(eq(surveys.id, id)).returning();
      if (Object.keys(revisionValues).length) {
        await tx.update(surveyRevisions).set(revisionValues).where(eq(surveyRevisions.id, revision.id));
      }
      await this.audit(tx, id, null, actor, 'SURVEY_UPDATED', 'settings,revision', correlationId);
      return updated ?? null;
    });
  }
  async publish(id: string, actor: string, now: Date, correlationId: string) {
    return this.db.transaction(async (tx) => {
      const revision = await this.lockDraft(tx, id);
      if (!revision) {
        const exists = await this.exists(tx, id);
        return exists ? 'IMMUTABLE' as const : null;
      }
      const sections = await tx.select().from(surveySections).where(eq(surveySections.surveyRevisionId, revision.id));
      if (!sections.length) return 'IMMUTABLE' as const;
      const questions = await tx.select().from(surveyQuestions).where(inArray(surveyQuestions.sectionId, sections.map((section) => section.id)));
      if (!questions.length) return 'IMMUTABLE' as const;
      const [survey] = await tx.select().from(surveys).where(eq(surveys.id, id));
      if (!survey?.closesAt || !Number.isFinite(survey.closesAt.getTime())) return 'INVALID_SETTINGS' as const;
      const state = survey.closesAt <= now
        ? 'CLOSED'
        : survey.opensAt && survey.opensAt > now
          ? 'SCHEDULED'
          : 'OPEN';
      await tx.update(surveyRevisions).set({ publishedAt: now }).where(eq(surveyRevisions.id, revision.id));
      const [updated] = await tx.update(surveys).set({
        state,
        updatedByUserId: actor,
        updatedAt: now,
      }).where(eq(surveys.id, id)).returning();
      await this.audit(tx, id, null, actor, 'SURVEY_PUBLISHED', 'state', correlationId);
      return updated;
    });
  }
  async replaceSections(id: string, actor: string, input: Array<{ ordinal: number; title: { kr: string; en: string } }>, correlationId: string) { return this.db.transaction(async (tx) => { const revision = await this.lockDraft(tx, id); if (!revision) return (await this.exists(tx, id)) ? 'IMMUTABLE' as const : 'MISSING' as const; await tx.delete(surveySections).where(eq(surveySections.surveyRevisionId, revision.id)); if (input.length) await tx.insert(surveySections).values(input.map((s) => ({ surveyRevisionId: revision.id, ordinal: s.ordinal, titleKr: s.title.kr, titleEn: s.title.en }))); await this.audit(tx, id, null, actor, 'SURVEY_SECTIONS_REPLACED', 'sections', correlationId); return 'UPDATED' as const; }); }
  async replaceQuestions(sectionId: string, actor: string, input: SurveyQuestionInput[], correlationId: string) { return this.db.transaction(async (tx) => { const [located] = await tx.select({ surveyId: surveyRevisions.surveyId }).from(surveySections).innerJoin(surveyRevisions, eq(surveyRevisions.id, surveySections.surveyRevisionId)).where(eq(surveySections.id, sectionId)); if (!located) return 'MISSING' as const; const revision = await this.lockDraft(tx, located.surveyId); if (!revision) return 'IMMUTABLE' as const; const [section] = await tx.select().from(surveySections).where(and(eq(surveySections.id, sectionId), eq(surveySections.surveyRevisionId, revision.id))).for('update'); if (!section) return 'MISSING' as const; await tx.delete(surveyQuestions).where(eq(surveyQuestions.sectionId, sectionId)); for (const questionInput of input) { const [question] = await tx.insert(surveyQuestions).values({ sectionId, ordinal: questionInput.ordinal, type: questionInput.type, promptKr: questionInput.prompt.kr, promptEn: questionInput.prompt.en, helpTextKr: questionInput.helpText?.kr ?? null, helpTextEn: questionInput.helpText?.en ?? null, required: questionInput.required, validationRegex: questionInput.validationRegex ?? null, numberMin: questionInput.numberMin ?? null, numberMax: questionInput.numberMax ?? null, dateMin: questionInput.dateMin ?? null, dateMax: questionInput.dateMax ?? null }).returning(); if (!question) throw new Error('survey_question_create_failed'); if (questionInput.choices?.length) await tx.insert(surveyChoiceOptions).values(questionInput.choices.map((choice) => ({ questionId: question.id, ordinal: choice.ordinal, valueKr: choice.value.kr, valueEn: choice.value.en }))); } await this.audit(tx, revision.surveyId, null, actor, 'SURVEY_QUESTIONS_REPLACED', 'questions', correlationId); return { surveyId: revision.surveyId } as const; }); }
  async submit(surveyId: string, campusUserId: string | undefined, guest: { ciphertext: string; hash: string; version: string; candidates: Array<{ hash: string; version: string }> } | null, rawAnswers: unknown, correlationId: string) {
    return this.db.transaction(async (tx) => {
      const [survey] = await tx.select().from(surveys).where(eq(surveys.id, surveyId)).for('update');
      if (!survey) return null;
      const [revision] = await tx.select().from(surveyRevisions).where(and(eq(surveyRevisions.surveyId, surveyId), eq(surveyRevisions.revision, survey.currentRevision))).for('update');
      if (!revision) return null;
      const now = new Date();
      const effectiveState = surveyState(survey, now);
      if (effectiveState !== survey.state) {
        await tx.update(surveys).set({ state: effectiveState, updatedAt: now }).where(eq(surveys.id, surveyId));
        await this.audit(tx, surveyId, null, null, 'SURVEY_STATE_ADVANCED', 'state', correlationId);
      }
      if (effectiveState !== 'OPEN') return 'CLOSED' as const;
      if (!campusUserId) {
        if (!survey.guestAllowed || (survey.phoneRequired && !guest) || survey.feeRestriction === 'PAID_ONLY') return 'GUEST' as const;
      } else {
        const [user] = await tx.select().from(users).where(eq(users.id, campusUserId)).for('update');
        if (!user) return null;
        if (survey.feeRestriction === 'PAID_ONLY' && user.feeStatus !== 'PAID') return 'PAID' as const;
      }
      const definition = await this.definition(tx, revision.id);
      const answers = validateAnswers(definition.questions, definition.choices, rawAnswers);
      if (!answers) return 'INVALID' as const;
      const campusExistingWhere = campusUserId
        ? and(eq(surveyResponses.surveyId, surveyId), eq(surveyResponses.campusUserId, campusUserId))
        : undefined;
      const guestExistingWhere = guest
        ? or(...guest.candidates.map((candidate) => and(
          eq(surveyGuestIdentityHashes.surveyId, surveyId),
          eq(surveyGuestIdentityHashes.keyVersion, candidate.version),
          eq(surveyGuestIdentityHashes.hash, candidate.hash),
        )))
        : undefined;
      if (campusUserId) {
        const [existing] = await tx.select().from(surveyResponses).where(campusExistingWhere).for('update');
        if (existing) {
          if (existing.state !== 'SUBMITTED' || !survey.editDeadlineAt || survey.editDeadlineAt <= now) return 'CLOSED' as const;
          await tx.delete(surveyResponseAnswers).where(eq(surveyResponseAnswers.responseId, existing.id));
          if (answers.length) await tx.insert(surveyResponseAnswers).values(answers.map((answer) => ({ ...answer, responseId: existing.id, choiceOptionIds: answer.choiceOptionIds ? JSON.stringify(answer.choiceOptionIds) : null })));
          await this.audit(tx, surveyId, existing.id, campusUserId, 'SURVEY_RESPONSE_EDITED', 'answers', correlationId);
          return { response: existing, answers: await tx.select().from(surveyResponseAnswers).where(eq(surveyResponseAnswers.responseId, existing.id)) };
        }
      }
      if (guest && guestExistingWhere) {
        const [existing] = await tx.select({ id: surveyResponses.id })
          .from(surveyGuestIdentityHashes)
          .innerJoin(surveyResponses, eq(surveyResponses.id, surveyGuestIdentityHashes.responseId))
          .where(guestExistingWhere)
          .for('update');
        if (existing) return 'DUPLICATE' as const;
      }
      if (survey.cap !== null) {
        const [{ count }] = await tx.select({ count: sql<number>`count(*)::int` }).from(surveyResponses).where(and(eq(surveyResponses.surveyId, surveyId), inArray(surveyResponses.state, ['SUBMITTED', 'APPROVED', 'REJECTED', 'WAITLISTED'])));
        if (count >= survey.cap) return 'CAP' as const;
      }
      const [response] = await tx.insert(surveyResponses).values({
        surveyId, surveyRevisionId: revision.id, campusUserId: campusUserId ?? null,
        guestPhoneCiphertext: guest?.ciphertext ?? null, guestPhoneHash: guest?.hash ?? null, guestPhoneHashVersion: guest?.version ?? null,
        state: 'SUBMITTED', submittedAt: now, retentionDeadlineAt: new Date(survey.closesAt!.getTime() + survey.responseRetentionDays * 86400000),
      }).returning();
      if (!response) throw new Error('survey_response_create_failed');
      if (guest) {
        await tx.insert(surveyGuestIdentityHashes).values(guest.candidates.map((candidate) => ({
          responseId: response.id,
          surveyId,
          keyVersion: candidate.version,
          hash: candidate.hash,
        })));
      }
      if (answers.length) await tx.insert(surveyResponseAnswers).values(answers.map((answer) => ({ ...answer, responseId: response.id, choiceOptionIds: answer.choiceOptionIds ? JSON.stringify(answer.choiceOptionIds) : null })));
      await this.audit(tx, surveyId, response.id, campusUserId ?? null, 'SURVEY_RESPONSE_SUBMITTED', 'state,revision', correlationId);
      return { response, answers: await tx.select().from(surveyResponseAnswers).where(eq(surveyResponseAnswers.responseId, response.id)) };
    });
  }
  async myResponse(surveyId: string, userId: string) {
    const survey = await this.survey(surveyId);
    if (!survey) return null;
    const [row] = await this.db.select().from(surveyResponses).where(and(
      eq(surveyResponses.surveyId, surveyId),
      eq(surveyResponses.campusUserId, userId),
    )).limit(1);
    return row ?? null;
  }
  async answers(responseId: string) { return this.db.select().from(surveyResponseAnswers).where(eq(surveyResponseAnswers.responseId, responseId)); }
  async review(
    id: string,
    actor: string,
    state: 'APPROVED' | 'REJECTED' | 'WAITLISTED',
    reason: string | null,
    correlationId: string,
  ) {
    return this.db.transaction(async (tx) => {
      const locked = await tx.execute(sql`
        SELECT survey.id AS survey_id, response.survey_revision_id
        FROM surveys AS survey
        JOIN survey_responses AS response ON response.survey_id = survey.id
        WHERE response.id = ${id}
        FOR UPDATE OF survey
      `);
      const target = (locked.rows as Array<{ survey_id: string; survey_revision_id: string }>)[0];
      if (!target) return null;
      await tx.select({ id: surveyRevisions.id }).from(surveyRevisions).where(eq(surveyRevisions.id, target.survey_revision_id)).for('update');
      const [response] = await tx.select().from(surveyResponses).where(eq(surveyResponses.id, id)).for('update');
      if (!response) return null;
      if (response.state !== 'SUBMITTED') return 'INVALID' as const;
      const [updated] = await tx.update(surveyResponses).set({
        state,
        reviewReason: reason,
        reviewedAt: new Date(),
        reviewedByUserId: actor,
      }).where(eq(surveyResponses.id, id)).returning();
      await this.audit(tx, response.surveyId, response.id, actor, 'SURVEY_RESPONSE_REVIEWED', 'state,reason', correlationId);
      return updated;
    });
  }
  async aggregate(surveyId: string) {
    const detail = await this.detail(surveyId);
    if (!detail) return null;
    const rows = await this.db.execute(sql`
      WITH response_snapshot AS MATERIALIZED (
        SELECT id FROM survey_responses
        WHERE survey_id = ${surveyId}
          AND survey_revision_id = ${detail.revision.id}
          AND state IN ('SUBMITTED', 'APPROVED', 'REJECTED', 'WAITLISTED')
      ), totals AS (
        SELECT count(*)::int AS count FROM response_snapshot
      ), question_counts AS (
        SELECT answer.question_id AS id, count(*)::int AS count
        FROM survey_response_answers AS answer
        JOIN response_snapshot ON response_snapshot.id = answer.response_id
        GROUP BY answer.question_id
      ), choice_counts AS (
        SELECT choice_id.value AS id, count(*)::int AS count
        FROM survey_response_answers AS answer
        JOIN response_snapshot ON response_snapshot.id = answer.response_id
        CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(answer.choice_option_ids, '[]')::jsonb) AS choice_id(value)
        GROUP BY choice_id.value
      )
      SELECT totals.count, 'question' AS kind, question_counts.id::text AS id, question_counts.count AS item_count
      FROM totals LEFT JOIN question_counts ON true
      UNION ALL
      SELECT totals.count, 'choice' AS kind, choice_counts.id, choice_counts.count AS item_count
      FROM totals LEFT JOIN choice_counts ON true
    `);
    const questionCounts = new Map<string, number>();
    const choiceCounts = new Map<string, number>();
    let count = 0;
    for (const row of rows.rows as Array<{ count: number; kind: string; id: string | null; item_count: number | null }>) {
      count = Number(row.count);
      if (row.id && row.item_count !== null) (row.kind === 'question' ? questionCounts : choiceCounts).set(row.id, Number(row.item_count));
    }
    return { count, questions: detail.questions, choices: detail.choices, questionCounts, choiceCounts };
  }
  async export(surveyId: string, actor: string, correlationId: string) {
    return this.db.transaction(async (tx) => {
      const [survey] = await tx.select().from(surveys).where(eq(surveys.id, surveyId)).for('update');
      if (!survey?.closesAt) return survey ? 'INVALID' as const : null;
      const requestedAt = new Date();
      const retentionDeadlineAt = new Date(survey.closesAt.getTime() + survey.responseRetentionDays * 86_400_000);
      if (retentionDeadlineAt < requestedAt) return 'INVALID' as const;
      const [created] = await tx.insert(surveyExports).values({
        surveyId,
        requestedByUserId: actor,
        requestedAt,
        retentionDeadlineAt,
      }).returning();
      await this.audit(tx, surveyId, null, actor, 'SURVEY_EXPORT_REQUESTED', 'format,status', correlationId);
      return created;
    });
  }
  async matcher(
    input: { articleId?: string; eventId?: string; surveyId: string; createdByUserId: string },
    correlationId: string,
  ) {
    return this.db.transaction(async (tx) => {
      if (!input.surveyId || (!!input.articleId === !!input.eventId)) return 'INVALID' as const;
      if (input.articleId && !(await tx.select().from(articles).where(eq(articles.id, input.articleId)).limit(1))[0]) {
        return 'MISSING' as const;
      }
      if (input.eventId && !(await tx.select().from(events).where(eq(events.id, input.eventId)).limit(1))[0]) {
        return 'MISSING' as const;
      }
      if (input.surveyId && !(await tx.select().from(surveys).where(eq(surveys.id, input.surveyId)).limit(1))[0]) {
        return 'MISSING' as const;
      }
      const [created] = await tx.insert(contentMatchers).values(input).onConflictDoNothing().returning();
      if (!created) return 'DUPLICATE' as const;
      await this.audit(tx, input.surveyId, null, input.createdByUserId, 'CONTENT_MATCHER_CREATED', 'article_id,event_id,survey_id', correlationId);
      return created;
    });
  }
  async deleteMatcher(id: string, actor: string, correlationId: string) { return this.db.transaction(async (tx) => { const [deleted] = await tx.delete(contentMatchers).where(eq(contentMatchers.id, id)).returning(); if (!deleted) return null; if (!deleted.surveyId) throw new Error('survey_matcher_invariant_violation'); await this.audit(tx, deleted.surveyId, null, actor, 'CONTENT_MATCHER_DELETED', 'article_id,event_id,survey_id', correlationId); return deleted; }); }
  async purgeExpired(limit: number, correlationId: string) {
    return this.db.transaction(async (tx) => {
      const rows = await tx.execute(sql`
        SELECT response.id, response.survey_id, response.survey_revision_id
        FROM survey_responses AS response
        JOIN surveys AS survey ON survey.id = response.survey_id
        WHERE response.retention_deadline_at <= now()
          AND (
            survey.closes_at <= now()
            OR survey.state IN ('CLOSED', 'ARCHIVED')
          )
        ORDER BY survey.id, response.retention_deadline_at, response.id
        LIMIT ${limit}
        FOR UPDATE OF survey, response SKIP LOCKED
      `);
      const candidates = rows.rows as Array<{ id: string; survey_id: string; survey_revision_id: string }>;
      if (!candidates.length) return 0;
      const expired = candidates.map((row) => ({
        id: row.id,
        surveyId: row.survey_id,
        surveyRevisionId: row.survey_revision_id,
      }));
      if (!expired.length) return 0;
      await tx.delete(surveyResponses).where(inArray(surveyResponses.id, expired.map((row) => row.id)));
      const affectedSurveyIds = new Set(expired.map((row) => row.surveyId));
      for (const affectedSurveyId of affectedSurveyIds) {
        await this.audit(
          tx,
          affectedSurveyId,
          null,
          null,
          'SURVEY_RESPONSES_PURGED',
          'responses',
          correlationId,
        );
      }
      return expired.length;
    });
  }
  private async definition(tx: Tx, revisionId: string) { const sections = await tx.select().from(surveySections).where(eq(surveySections.surveyRevisionId, revisionId)); const questions = sections.length ? await tx.select().from(surveyQuestions).where(inArray(surveyQuestions.sectionId, sections.map((s) => s.id))) : []; const choices = questions.length ? await tx.select().from(surveyChoiceOptions).where(inArray(surveyChoiceOptions.questionId, questions.map((q) => q.id))) : []; return { questions, choices }; }
  private async list(condition?: ReturnType<typeof and>) {
    const query = this.db.select().from(surveys);
    const rows = condition
      ? await query.where(condition).orderBy(asc(surveys.opensAt), asc(surveys.id)).limit(200)
      : await query.orderBy(asc(surveys.opensAt), asc(surveys.id)).limit(200);
    if (!rows.length) return [];
    const revisions = await this.db.select().from(surveyRevisions).where(inArray(surveyRevisions.surveyId, rows.map((row) => row.id)));
    const revisionBySurvey = new Map(revisions.filter((revision) => rows.some((survey) => survey.id === revision.surveyId && survey.currentRevision === revision.revision)).map((revision) => [revision.surveyId, revision]));
    const currentRevisions = [...revisionBySurvey.values()];
    const sections = currentRevisions.length ? await this.db.select().from(surveySections).where(inArray(surveySections.surveyRevisionId, currentRevisions.map((revision) => revision.id))).orderBy(asc(surveySections.ordinal), asc(surveySections.id)) : [];
    const questions = sections.length ? await this.db.select().from(surveyQuestions).where(inArray(surveyQuestions.sectionId, sections.map((section) => section.id))).orderBy(asc(surveyQuestions.ordinal), asc(surveyQuestions.id)) : [];
    const choices = questions.length ? await this.db.select().from(surveyChoiceOptions).where(inArray(surveyChoiceOptions.questionId, questions.map((question) => question.id))).orderBy(asc(surveyChoiceOptions.ordinal), asc(surveyChoiceOptions.id)) : [];
    return rows.flatMap((survey) => {
      const revision = revisionBySurvey.get(survey.id);
      if (!revision) return [];
      const surveySections = sections.filter((section) => section.surveyRevisionId === revision.id);
      const surveyQuestions = questions.filter((question) => surveySections.some((section) => section.id === question.sectionId));
      const surveyChoices = choices.filter((choice) => surveyQuestions.some((question) => question.id === choice.questionId));
      return [{ survey, revision, sections: surveySections, questions: surveyQuestions, choices: surveyChoices }];
    });
  }
  private async lockDraft(tx: Tx, id: string) { const [survey] = await tx.select().from(surveys).where(eq(surveys.id, id)).for('update'); if (!survey || survey.state !== 'DRAFT') return null; const [revision] = await tx.select().from(surveyRevisions).where(and(eq(surveyRevisions.surveyId, id), eq(surveyRevisions.revision, survey.currentRevision))).for('update'); return revision ?? null; }
  private async exists(tx: Tx, id: string) { return !!(await tx.select({ id: surveys.id }).from(surveys).where(eq(surveys.id, id)).limit(1))[0]; }
  private audit(tx: Tx, surveyId: string, responseId: string | null, actorUserId: string | null, action: string, changedFieldNames: string, correlationId: string) { return tx.insert(surveyAuditLog).values({ surveyId, responseId, actorUserId, action, changedFieldNames, correlationId }); }
}
export function surveyState(survey: Pick<typeof surveys.$inferSelect, 'state' | 'opensAt' | 'closesAt'>, now: Date): 'DRAFT' | 'SCHEDULED' | 'OPEN' | 'CLOSED' | 'ARCHIVED' {
  if (survey.state === 'DRAFT' || survey.state === 'CLOSED' || survey.state === 'ARCHIVED') return survey.state;
  if (survey.closesAt && survey.closesAt <= now) return 'CLOSED';
  return survey.opensAt && survey.opensAt > now ? 'SCHEDULED' : 'OPEN';
}
function parseChoiceIds(value: string | null): string[] | null {
  if (value === null) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) && parsed.every((id) => typeof id === 'string') ? parsed : null;
  } catch { return null; }
}
export type RestrictedCharacterPattern = { allowed: ReadonlySet<string>; minimum: number; maximum: number };

export function parseRestrictedCharacterPattern(pattern: unknown): RestrictedCharacterPattern | null {
  if (typeof pattern !== 'string' || pattern.length > 256) return null;
  const match = /^\^\[([A-Za-z0-9 .,_@+\-]+)\](?:\{(\d+)(?:,(\d+))?\}|([+*?]))\$$/.exec(pattern);
  if (!match) return null;
  const [, characters, exact, maximum, shorthand] = match;
  const allowed = new Set<string>();
  for (let index = 0; index < characters.length;) {
    const character = characters[index]!;
    if (character === '-') {
      if (index !== 0 && index !== characters.length - 1) return null;
      allowed.add(character);
      index += 1;
    } else if (characters[index + 1] === '-') {
      if (index + 2 >= characters.length || characters[index + 2] === '-') return null;
      const end = characters.charCodeAt(index + 2);
      const start = character.charCodeAt(0);
      if (start > end || end > 0x7f) return null;
      for (let code = start; code <= end; code += 1) allowed.add(String.fromCharCode(code));
      index += 3;
    } else {
      allowed.add(character);
      index += 1;
    }
  }
  const minimum = exact ? Number(exact) : shorthand === '+' ? 1 : 0;
  const limit = exact && maximum === undefined ? Number(exact) : maximum ? Number(maximum) : shorthand === '?' ? 1 : 8_192;
  if (!Number.isSafeInteger(minimum) || !Number.isSafeInteger(limit) || minimum > limit || limit > 8_192) return null;
  return { allowed, minimum, maximum: limit };
}

function safeCharacterPatternTest(pattern: string, value: string): boolean {
  const parsed = parseRestrictedCharacterPattern(pattern);
  return !!parsed && [...value].every((character) => parsed.allowed.has(character)) && value.length >= parsed.minimum && value.length <= parsed.maximum;
}
function validateAnswers(
  questions: Array<typeof surveyQuestions.$inferSelect>,
  choices: Array<typeof surveyChoiceOptions.$inferSelect>,
  raw: unknown,
) {
  if (!Array.isArray(raw)) return null;
  const seen = new Set<string>();
  const out: Array<{ questionId: string; textValue?: string; numberValue?: number; dateValue?: string; choiceOptionIds?: string[] }> = [];
  for (const value of raw) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const answer = value as Record<string, unknown>;
    if (
      Object.keys(answer).length !== 2
      || !Object.keys(answer).every((key) => ['questionId', 'textValue', 'numberValue', 'dateValue', 'choiceOptionIds'].includes(key))
    ) {
      return null;
    }
    const question = questions.find((candidate) => candidate.id === answer.questionId);
    if (!question || seen.has(question.id)) return null;
    seen.add(question.id);

    const numberValue = answer.numberValue;
    if (
      typeof answer.textValue === 'string'
      && answer.textValue.length > 0
      && Buffer.byteLength(answer.textValue, 'utf8') <= 8_192
      && ['SHORT_TEXT', 'LONG_TEXT'].includes(question.type)
      && (!question.validationRegex || safeCharacterPatternTest(question.validationRegex, answer.textValue))
    ) {
      out.push({ questionId: question.id, textValue: answer.textValue });
    } else if (
      typeof numberValue === 'number'
      && Number.isInteger(numberValue)
      && question.type === 'NUMBER'
      && (question.numberMin === null || numberValue >= question.numberMin)
      && (question.numberMax === null || numberValue <= question.numberMax)
    ) {
      out.push({ questionId: question.id, numberValue });
    } else if (
      typeof answer.dateValue === 'string'
      && question.type === 'DATE'
      && isIsoDate(answer.dateValue)
      && (question.dateMin === null || answer.dateValue >= question.dateMin)
      && (question.dateMax === null || answer.dateValue <= question.dateMax)
    ) {
      out.push({ questionId: question.id, dateValue: answer.dateValue });
    } else if (
      Array.isArray(answer.choiceOptionIds)
      && ['SINGLE_CHOICE', 'MULTIPLE_CHOICE'].includes(question.type)
      && answer.choiceOptionIds.length > 0
      && (question.type === 'MULTIPLE_CHOICE' || answer.choiceOptionIds.length === 1)
      && new Set(answer.choiceOptionIds).size === answer.choiceOptionIds.length
      && answer.choiceOptionIds.every((choiceId) => typeof choiceId === 'string' && choices.some((choice) => choice.id === choiceId && choice.questionId === question.id))
    ) {
      out.push({ questionId: question.id, choiceOptionIds: answer.choiceOptionIds as string[] });
    } else {
      return null;
    }
  }
  return questions.some((question) => question.required && !seen.has(question.id)) ? null : out;
}
function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
