import { createHash } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, gt, inArray, isNull, lt, ne, or, sql } from 'drizzle-orm';
import { DRIZZLE_DB, type PostgresDatabase } from '../../infrastructure/postgres/postgres.provider';
import { articles, boards, contentMatchers, events, surveyAuditLog, surveyChoiceOptions, surveyExports, surveyGuestIdentityHashes, surveyImageAssets, surveySectionItems, surveySectionDescriptionItems, surveyImageBlocks, surveyImageBlockMemberships, surveyImageMembershipMutations, surveyImageCleanupClaims, surveyResponseAnswers, surveyResponses, surveyRevisions, surveySections, surveyQuestions, surveys, users } from '../../infrastructure/postgres/postgres.schema';
type Tx = Parameters<Parameters<PostgresDatabase['transaction']>[0]>[0];
type LocalizedText = { kr: string; en: string };
export type SurveyImageMembershipMutationMembership = {
  id: string;
  blockId: string;
  set: 'SHARED' | 'KO' | 'EN';
  assetId: string;
  orderKey: number;
};
export type SurveyImageMembershipMutationResult = {
  replayed: boolean;
  definitionVersion: number;
  membership: SurveyImageMembershipMutationMembership | null;
  membershipCount: number;
};
const isSurveyImageMembershipMutationResult = (value: unknown): value is SurveyImageMembershipMutationResult => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const result = value as Record<string, unknown>;
  const membership = result.membership;
  return typeof result.replayed === 'boolean'
    && typeof result.definitionVersion === 'number'
    && Number.isSafeInteger(result.definitionVersion)
    && result.definitionVersion > 0
    && typeof result.membershipCount === 'number'
    && Number.isSafeInteger(result.membershipCount)
    && result.membershipCount >= 0
    && (membership === null || (
      !!membership
      && typeof membership === 'object'
      && !Array.isArray(membership)
      && typeof (membership as Record<string, unknown>).id === 'string'
      && typeof (membership as Record<string, unknown>).blockId === 'string'
      && ['SHARED', 'KO', 'EN'].includes(String((membership as Record<string, unknown>).set))
      && typeof (membership as Record<string, unknown>).assetId === 'string'
      && Number.isSafeInteger((membership as Record<string, unknown>).orderKey)
    ));
};
const isSurveyImageBlockModeMutationResult = (value: unknown): value is { replayed: boolean; definitionVersion: number; mode: 'SHARED' | 'LOCALIZED'; membershipCounts: { shared: number; ko: number; en: number } } => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const result = value as Record<string, unknown>;
  const counts = result.membershipCounts;
  return typeof result.replayed === 'boolean'
    && typeof result.definitionVersion === 'number'
    && Number.isSafeInteger(result.definitionVersion)
    && result.definitionVersion > 0
    && (result.mode === 'SHARED' || result.mode === 'LOCALIZED')
    && !!counts
    && typeof counts === 'object'
    && !Array.isArray(counts)
    && ['shared', 'ko', 'en'].every((key) => Number.isSafeInteger((counts as Record<string, unknown>)[key]) && Number((counts as Record<string, unknown>)[key]) >= 0);
};
type SurveyQuestionInput = {
  id?: string;
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
  choices?: Array<{ id?: string; ordinal: number; value: LocalizedText }>;
};
class DefinitionReplaceAbort extends Error {
  constructor(readonly code: 'MISSING' | 'IMMUTABLE' | 'STALE' | 'INVALID_ITEMS' | 'QUESTION_DELETE_FORBIDDEN' | 'CHOICE_DELETE_FORBIDDEN' | 'IMAGE_BLOCK_MODE_CHANGE_FORBIDDEN') {
    super(code);
  }
}
@Injectable()
export class SurveysRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: PostgresDatabase) {}
  async listPublic() {
    return this.list(inArray(surveys.state, ['SCHEDULED', 'OPEN', 'CLOSED']));
  }
  async listAll() { return this.list(); }
  async reviewQueue() {
    return this.db.select({
      surveyId: surveys.id,
      titleKr: surveyRevisions.titleKr,
      titleEn: surveyRevisions.titleEn,
      state: surveys.state,
      responseCount: sql<number>`count(${surveyResponses.id})::int`,
      latestResponseAt: sql<Date | null>`max(${surveyResponses.submittedAt})`.mapWith(surveyResponses.submittedAt),
    })
      .from(surveys)
      .innerJoin(surveyRevisions, and(
        eq(surveyRevisions.surveyId, surveys.id),
        eq(surveyRevisions.revision, surveys.currentRevision),
      ))
      .innerJoin(surveyResponses, eq(surveyResponses.surveyId, surveys.id))
      .groupBy(surveys.id, surveyRevisions.id)
      .orderBy(desc(sql`max(${surveyResponses.submittedAt})`), asc(surveys.id))
      .limit(200);
  }
  async survey(id: string) {
    const detail = await this.detail(id);
    return detail ? { ...detail.survey, sections: detail.sections, questions: detail.questions, choices: detail.choices, items: detail.items, descriptionItems: detail.descriptionItems, imageBlocks: detail.imageBlocks } : null;
  }
  async detail(id: string) { const survey = await this.surveyRow(id); if (!survey) return null; const [revision] = await this.db.select().from(surveyRevisions).where(and(eq(surveyRevisions.surveyId, id), eq(surveyRevisions.revision, survey.currentRevision))); if (!revision) return null; const sections = await this.db.select().from(surveySections).where(eq(surveySections.surveyRevisionId, revision.id)).orderBy(asc(surveySections.ordinal), asc(surveySections.id)); const questions = sections.length ? await this.db.select().from(surveyQuestions).where(inArray(surveyQuestions.sectionId, sections.map((x) => x.id))).orderBy(asc(surveyQuestions.ordinal), asc(surveyQuestions.id)) : []; const choices = questions.length ? await this.db.select().from(surveyChoiceOptions).where(inArray(surveyChoiceOptions.questionId, questions.map((x) => x.id))).orderBy(asc(surveyChoiceOptions.ordinal), asc(surveyChoiceOptions.id)) : []; const items = sections.length ? await this.db.select().from(surveySectionItems).where(inArray(surveySectionItems.sectionId, sections.map((x) => x.id))).orderBy(asc(surveySectionItems.ordinal), asc(surveySectionItems.id)) : []; const descriptionItems = items.length ? await this.db.select().from(surveySectionDescriptionItems).where(inArray(surveySectionDescriptionItems.itemId, items.map((item) => item.id))) : []; const imageBlocks = items.length ? await this.db.select().from(surveyImageBlocks).where(inArray(surveyImageBlocks.itemId, items.map((item) => item.id))) : []; return { survey, revision, sections, questions, choices, items, descriptionItems, imageBlocks }; }
  async create(
    input: typeof surveys.$inferInsert,
    revision: Omit<typeof surveyRevisions.$inferInsert, 'surveyId'>,
    correlationId: string,
  ) {
    return this.db.transaction(async (tx) => {
      const [survey] = await tx.insert(surveys).values(input).returning();
      const [created] = await tx.insert(surveyRevisions).values({ ...revision, surveyId: survey.id }).returning();
      if (input.onlyForKoreanSpeaker) await tx.update(surveyRevisions).set({ titleEn: created!.titleKr, descriptionEn: created!.descriptionKr }).where(eq(surveyRevisions.id, created!.id));
      await this.audit(tx, survey.id, null, input.createdByUserId, 'SURVEY_CREATED', 'state,revision,settings', correlationId);
      return { survey, revision: created };
    });
  }
  async patch(
    id: string,
    actor: string,
    values: Partial<typeof surveys.$inferInsert>,
    revisionValues: Partial<Pick<typeof surveyRevisions.$inferInsert, 'titleKr' | 'titleEn' | 'descriptionKr' | 'descriptionEn'>>,
    expectedDefinitionVersion: number | undefined,
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
      const localizedDefinitionChange = Object.keys(revisionValues).length > 0;
      const definitionChange = localizedDefinitionChange || values.onlyForKoreanSpeaker !== undefined;
      if (definitionChange && (expectedDefinitionVersion === undefined || current.definitionVersion !== expectedDefinitionVersion)) return 'STALE' as const;
      if (!definitionChange && expectedDefinitionVersion !== undefined && current.definitionVersion !== expectedDefinitionVersion) return 'STALE' as const;
      const koreanOnly = current.onlyForKoreanSpeaker || values.onlyForKoreanSpeaker === true;
      if (
        koreanOnly
        && (
          (revisionValues.titleKr !== undefined && revisionValues.titleEn !== undefined && revisionValues.titleKr !== revisionValues.titleEn)
          || (revisionValues.descriptionKr !== undefined && revisionValues.descriptionEn !== undefined && revisionValues.descriptionKr !== revisionValues.descriptionEn)
        )
      ) return 'INVALID_LOCALIZED_CONTENT' as const;
      const [updated] = Object.keys(values).length > 0
        ? await tx.update(surveys).set(values).where(eq(surveys.id, id)).returning()
        : [current];
      if (koreanOnly) {
        if (revisionValues.titleKr !== undefined) revisionValues.titleEn = revisionValues.titleKr;
        if (revisionValues.descriptionKr !== undefined) revisionValues.descriptionEn = revisionValues.descriptionKr;
      }
      if (localizedDefinitionChange) {
        await tx.update(surveyRevisions).set(revisionValues).where(eq(surveyRevisions.id, revision.id));
      }
      if (values.onlyForKoreanSpeaker) await this.mirrorKoreanDefinition(tx, revision.id);
      if (definitionChange) await this.bumpDefinition(tx, id, actor);
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
      const imageBlocks = await tx.select({ block: surveyImageBlocks, item: surveySectionItems }).from(surveyImageBlocks).innerJoin(surveySectionItems, eq(surveySectionItems.id, surveyImageBlocks.itemId)).where(inArray(surveySectionItems.sectionId, sections.map((section) => section.id)));
      const memberships = imageBlocks.length ? await tx.select().from(surveyImageBlockMemberships).where(inArray(surveyImageBlockMemberships.blockId, imageBlocks.map(({ block }) => block.itemId))) : [];
      if (memberships.length) { const images = await tx.select().from(surveyImageAssets).where(inArray(surveyImageAssets.id, memberships.map((membership) => membership.assetId))); if (images.length !== new Set(memberships.map((membership) => membership.assetId)).size || images.some((image) => image.status !== 'COMPLETED' || image.deletedAt !== null)) return 'INCOMPLETE_ASSET' as const; }
      if (!sections.length) return 'IMMUTABLE' as const;
      const questions = await tx.select().from(surveyQuestions).where(inArray(surveyQuestions.sectionId, sections.map((section) => section.id)));
      if (!questions.length) return 'IMMUTABLE' as const;
      const invalidTopology = await tx.execute(sql`
        SELECT 1
        FROM survey_section_items item
        JOIN survey_sections section ON section.id = item.section_id
        LEFT JOIN survey_questions question ON question.id = item.question_id
        LEFT JOIN survey_section_description_items description ON description.item_id = item.id
        LEFT JOIN survey_image_blocks block ON block.item_id = item.id
        WHERE section.survey_revision_id = ${revision.id}
          AND (
            (item.kind = 'QUESTION' AND (question.id IS NULL OR question.section_id <> item.section_id OR description.item_id IS NOT NULL OR block.item_id IS NOT NULL))
            OR (item.kind = 'DESCRIPTION' AND (description.item_id IS NULL OR question.id IS NOT NULL OR block.item_id IS NOT NULL))
            OR (item.kind = 'IMAGE_BLOCK' AND (block.item_id IS NULL OR question.id IS NOT NULL OR description.item_id IS NOT NULL))
            OR item.ordinal <> (
              SELECT count(*) - 1 FROM survey_section_items preceding
              WHERE preceding.section_id = item.section_id AND preceding.ordinal <= item.ordinal
            )
          )
        LIMIT 1
      `);
      if (invalidTopology.rows.length) return 'IMMUTABLE' as const;
      const invalidBlockTopology = await tx.execute(sql`
        SELECT 1
        FROM survey_image_blocks block
        JOIN survey_section_items item ON item.id = block.item_id
        JOIN survey_sections section ON section.id = item.section_id
        WHERE section.survey_revision_id = ${revision.id}
          AND (
            (block.mode = 'SHARED' AND (block.ko_membership_count <> 0 OR block.en_membership_count <> 0))
            OR (block.mode = 'LOCALIZED' AND block.shared_membership_count <> 0)
            OR block.shared_membership_count <> (SELECT count(*) FROM survey_image_block_memberships membership WHERE membership.block_id = block.item_id AND membership.set = 'SHARED')
            OR block.ko_membership_count <> (SELECT count(*) FROM survey_image_block_memberships membership WHERE membership.block_id = block.item_id AND membership.set = 'KO')
            OR block.en_membership_count <> (SELECT count(*) FROM survey_image_block_memberships membership WHERE membership.block_id = block.item_id AND membership.set = 'EN')
            OR EXISTS (
              SELECT 1 FROM survey_image_block_memberships membership
              JOIN survey_image_assets asset ON asset.id = membership.asset_id
              WHERE membership.block_id = block.item_id
                AND (asset.status <> 'COMPLETED' OR asset.deleted_at IS NOT NULL)
            )
          )
        LIMIT 1
      `);
      if (invalidBlockTopology.rows.length) return 'INCOMPLETE_ASSET' as const;
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
  async replaceDefinition(id: string, actor: string, expectedDefinitionVersion: number, input: Array<{ id?: string; ordinal: number; title: LocalizedText; items: Array<{ id?: string; ordinal: number; kind: 'QUESTION' | 'DESCRIPTION' | 'IMAGE_BLOCK'; question?: SurveyQuestionInput; body?: LocalizedText; mode?: 'SHARED' | 'LOCALIZED' }> }>, correlationId: string) {
    try {
      return await this.db.transaction(async (tx) => {
      const revision = await this.lockDraft(tx, id);
      if (!revision) throw new DefinitionReplaceAbort((await this.exists(tx, id)) ? 'IMMUTABLE' : 'MISSING');
      const [survey] = await tx.select().from(surveys).where(eq(surveys.id, id)).for('update');
      if (!survey) throw new DefinitionReplaceAbort('MISSING');
      if (survey.definitionVersion !== expectedDefinitionVersion) throw new DefinitionReplaceAbort('STALE');
      if (survey.onlyForKoreanSpeaker && this.hasKoreanDefinitionDivergence(input)) throw new DefinitionReplaceAbort('INVALID_ITEMS');

      const existingSections = await tx.select().from(surveySections).where(eq(surveySections.surveyRevisionId, revision.id)).for('update');
      const sectionById = new Map(existingSections.map((section) => [section.id, section]));
      if (input.some((section) => section.id !== undefined && !sectionById.has(section.id))) throw new DefinitionReplaceAbort('INVALID_ITEMS');
      const retainedSectionIds = new Set(input.flatMap((section) => section.id ? [section.id] : []));
      const obsoleteSections = existingSections.filter((section) => !retainedSectionIds.has(section.id));
      const obsoleteSectionIds = obsoleteSections.map((section) => section.id);
      const obsoleteQuestions = obsoleteSectionIds.length ? await tx.select({ id: surveyQuestions.id }).from(surveyQuestions).where(inArray(surveyQuestions.sectionId, obsoleteSectionIds)).for('update') : [];
      if (await this.hasResponseLinkedQuestions(tx, obsoleteQuestions.map((question) => question.id))) throw new DefinitionReplaceAbort('QUESTION_DELETE_FORBIDDEN');

      // Clear response-free legacy replacements before ordinal reuse; identified rows are rekeyed first.
      if (obsoleteSectionIds.length) await tx.delete(surveySectionItems).where(inArray(surveySectionItems.sectionId, obsoleteSectionIds));
      if (obsoleteQuestions.length) await tx.delete(surveyQuestions).where(inArray(surveyQuestions.id, obsoleteQuestions.map((question) => question.id)));
      if (obsoleteSectionIds.length) await tx.delete(surveySections).where(inArray(surveySections.id, obsoleteSectionIds));
      const sectionOffset = Math.max(0, ...existingSections.map((section) => section.ordinal), ...input.map((section) => section.ordinal)) + existingSections.length + input.length + 1;
      for (const section of existingSections.filter((section) => retainedSectionIds.has(section.id))) await tx.update(surveySections).set({ ordinal: section.ordinal + sectionOffset }).where(eq(surveySections.id, section.id));

      for (const sectionInput of input) {
        let section = sectionInput.id ? sectionById.get(sectionInput.id) : undefined;
        if (section) {
          await tx.update(surveySections).set({ ordinal: sectionInput.ordinal, titleKr: sectionInput.title.kr, titleEn: sectionInput.title.en }).where(eq(surveySections.id, section.id));
        } else {
          [section] = await tx.insert(surveySections).values({ surveyRevisionId: revision.id, ordinal: sectionInput.ordinal, titleKr: sectionInput.title.kr, titleEn: sectionInput.title.en }).returning();
        }
        if (!section) throw new Error('survey_section_create_failed');
        const itemInputs = sectionInput.items;
        const existingItems = sectionInput.id ? await tx.select().from(surveySectionItems).where(eq(surveySectionItems.sectionId, section.id)).for('update') : [];
        const itemById = new Map(existingItems.map((item) => [item.id, item]));
        if (itemInputs.some((item) => 'id' in item && item.id !== undefined && !itemById.has(item.id))) throw new DefinitionReplaceAbort('INVALID_ITEMS');
        const retainedItemIds = new Set(itemInputs.flatMap((item) => 'id' in item && item.id ? [item.id] : []));
        const obsoleteItems = existingItems.filter((item) => !retainedItemIds.has(item.id));
        const obsoleteQuestionIds = obsoleteItems.flatMap((item) => item.kind === 'QUESTION' && item.questionId ? [item.questionId] : []);
        if (await this.hasResponseLinkedQuestions(tx, obsoleteQuestionIds)) throw new DefinitionReplaceAbort('QUESTION_DELETE_FORBIDDEN');
        if (obsoleteItems.length) await tx.delete(surveySectionItems).where(inArray(surveySectionItems.id, obsoleteItems.map((item) => item.id)));
        if (obsoleteQuestionIds.length) await tx.delete(surveyQuestions).where(inArray(surveyQuestions.id, obsoleteQuestionIds));

        const itemOffset = Math.max(0, ...existingItems.map((item) => item.ordinal), ...itemInputs.map((item) => item.ordinal)) + existingItems.length + itemInputs.length + 1;
        for (const item of existingItems.filter((item) => retainedItemIds.has(item.id))) await tx.update(surveySectionItems).set({ ordinal: item.ordinal + itemOffset }).where(eq(surveySectionItems.id, item.id));
        const retainedQuestions = existingItems.filter((item) => retainedItemIds.has(item.id) && item.kind === 'QUESTION' && item.questionId).map((item) => item.questionId!);
        if (retainedQuestions.length) {
          const questions = await tx.select().from(surveyQuestions).where(inArray(surveyQuestions.id, retainedQuestions)).for('update');
          const questionOffset = Math.max(0, ...questions.map((question) => question.ordinal), ...itemInputs.flatMap((item) => item.question ? [item.question.ordinal] : [])) + questions.length + itemInputs.length + 1;
          for (const question of questions) await tx.update(surveyQuestions).set({ ordinal: question.ordinal + questionOffset }).where(eq(surveyQuestions.id, question.id));
        }

        let questionOrdinal = 0;
        for (const itemInput of itemInputs) {
          const existing = 'id' in itemInput && itemInput.id ? itemById.get(itemInput.id) : undefined;
          if (existing) {
            if (existing.kind !== itemInput.kind) throw new DefinitionReplaceAbort('INVALID_ITEMS');
            await tx.update(surveySectionItems).set({ ordinal: itemInput.ordinal }).where(eq(surveySectionItems.id, existing.id));
            if (existing.kind === 'QUESTION') {
              if (!itemInput.question || (itemInput.question.id !== undefined && itemInput.question.id !== existing.questionId)) throw new DefinitionReplaceAbort('INVALID_ITEMS');
              const choiceResult = await this.updateQuestion(tx, existing.questionId!, { ...itemInput.question, ordinal: questionOrdinal });
              if (choiceResult === 'CHOICE_DELETE_FORBIDDEN') throw new DefinitionReplaceAbort(choiceResult);
              questionOrdinal += 1;
            } else if (existing.kind === 'DESCRIPTION') {
              if (!('body' in itemInput) || !itemInput.body) throw new DefinitionReplaceAbort('INVALID_ITEMS');
              await tx.update(surveySectionDescriptionItems).set({ bodyKr: itemInput.body.kr, bodyEn: itemInput.body.en }).where(eq(surveySectionDescriptionItems.itemId, existing.id));
            } else if (existing.kind === 'IMAGE_BLOCK') {
              const [imageBlock] = await tx.select().from(surveyImageBlocks).where(eq(surveyImageBlocks.itemId, existing.id));
              if (!imageBlock || itemInput.mode !== imageBlock.mode) throw new DefinitionReplaceAbort('IMAGE_BLOCK_MODE_CHANGE_FORBIDDEN');
            }
            continue;
          }
          if (itemInput.kind === 'QUESTION') {
            if (!itemInput.question) throw new DefinitionReplaceAbort('INVALID_ITEMS');
            const [question] = await this.createQuestion(tx, section.id, { ...itemInput.question, ordinal: questionOrdinal });
            questionOrdinal += 1;
            if (!question) throw new Error('survey_question_create_failed');
            if (itemInput.question.choices?.length) await tx.insert(surveyChoiceOptions).values(itemInput.question.choices.map((choice) => ({ questionId: question.id, ordinal: choice.ordinal, valueKr: choice.value.kr, valueEn: choice.value.en })));
            await tx.insert(surveySectionItems).values({ sectionId: section.id, ordinal: itemInput.ordinal, kind: 'QUESTION', questionId: question.id });
          } else {
            const [item] = await tx.insert(surveySectionItems).values({ sectionId: section.id, ordinal: itemInput.ordinal, kind: itemInput.kind }).returning();
            if (!item) throw new Error('survey_section_item_create_failed');
            if (itemInput.kind === 'DESCRIPTION') {
              if (!itemInput.body) throw new DefinitionReplaceAbort('INVALID_ITEMS');
              await tx.insert(surveySectionDescriptionItems).values({ itemId: item.id, bodyKr: itemInput.body.kr, bodyEn: itemInput.body.en });
            } else await tx.insert(surveyImageBlocks).values({ itemId: item.id, mode: itemInput.mode ?? 'SHARED' });
          }
        }
      }
      if (survey.onlyForKoreanSpeaker) await this.mirrorKoreanDefinition(tx, revision.id);
      await this.bumpDefinition(tx, id, actor);
      await this.audit(tx, id, null, actor, 'SURVEY_DEFINITION_REPLACED', 'definition_version,sections', correlationId);
      return 'UPDATED' as const;
      });
    } catch (error) {
      if (error instanceof DefinitionReplaceAbort) return error.code;
      throw error;
    }
  }
  private hasKoreanDefinitionDivergence(input: Array<{ title: LocalizedText; items: Array<{ kind: 'QUESTION' | 'DESCRIPTION' | 'IMAGE_BLOCK'; question?: SurveyQuestionInput; body?: LocalizedText }> }>) {
    const divergent = (value: LocalizedText | null | undefined) => !!value && value.kr !== value.en;
    return input.some((section) => divergent(section.title) || section.items.some((item) => {
      if (item.kind === 'DESCRIPTION') return divergent(item.body);
      if (item.kind !== 'QUESTION' || !item.question) return false;
      return divergent(item.question.prompt)
        || divergent(item.question.helpText)
        || item.question.choices?.some((choice) => divergent(choice.value));
    }));
  }
  private async mirrorKoreanDefinition(tx: Tx, revisionId: string) {
    const [revision] = await tx.select().from(surveyRevisions).where(eq(surveyRevisions.id, revisionId)).for('update');
    if (!revision) throw new Error('survey_revision_missing');
    await tx.update(surveyRevisions).set({ titleEn: revision.titleKr, descriptionEn: revision.descriptionKr }).where(eq(surveyRevisions.id, revisionId));
    const sections = await tx.select().from(surveySections).where(eq(surveySections.surveyRevisionId, revisionId)).for('update');
    for (const section of sections) await tx.update(surveySections).set({ titleEn: section.titleKr }).where(eq(surveySections.id, section.id));
    if (!sections.length) return;
    const questions = await tx.select().from(surveyQuestions).where(inArray(surveyQuestions.sectionId, sections.map((section) => section.id))).for('update');
    for (const question of questions) await tx.update(surveyQuestions).set({ promptEn: question.promptKr, helpTextEn: question.helpTextKr }).where(eq(surveyQuestions.id, question.id));
    if (questions.length) {
      const choices = await tx.select().from(surveyChoiceOptions).where(inArray(surveyChoiceOptions.questionId, questions.map((question) => question.id))).for('update');
      for (const choice of choices) await tx.update(surveyChoiceOptions).set({ valueEn: choice.valueKr }).where(eq(surveyChoiceOptions.id, choice.id));
    }
    const items = await tx.select().from(surveySectionItems).where(inArray(surveySectionItems.sectionId, sections.map((section) => section.id))).for('update');
    const itemIds = items.map((item) => item.id);
    if (!itemIds.length) return;
    await tx.update(surveySectionDescriptionItems)
      .set({ bodyEn: sql`${surveySectionDescriptionItems.bodyKr}` })
      .where(inArray(surveySectionDescriptionItems.itemId, itemIds));
    await tx.execute(sql`
      WITH localized_blocks AS (
        SELECT ib.item_id
        FROM survey_image_blocks ib
        WHERE ib.item_id = ANY(${itemIds}::uuid[]) AND ib.mode = 'LOCALIZED'
      ),
      deleted AS (
        DELETE FROM survey_image_block_memberships m
        USING localized_blocks b
        WHERE m.block_id = b.item_id AND m.set = 'EN'
      ),
      copied AS (
        INSERT INTO survey_image_block_memberships (block_id, set, asset_id, order_key)
        SELECT m.block_id, 'EN', m.asset_id, m.order_key
        FROM survey_image_block_memberships m
        JOIN localized_blocks b ON b.item_id = m.block_id
        WHERE m.set = 'KO'
      ),
      counts AS (
        SELECT block_id, count(*)::integer AS count
        FROM survey_image_block_memberships
        WHERE set = 'KO' AND block_id IN (SELECT item_id FROM localized_blocks)
        GROUP BY block_id
      )
      UPDATE survey_image_blocks ib
      SET ko_membership_count = COALESCE(counts.count, 0),
          en_membership_count = COALESCE(counts.count, 0)
      FROM localized_blocks b
      LEFT JOIN counts ON counts.block_id = b.item_id
      WHERE ib.item_id = b.item_id
    `);
  }
  private async hasResponseLinkedQuestions(tx: Tx, questionIds: string[]) {
    if (!questionIds.length) return false;
    return !!(await tx.select({ id: surveyResponseAnswers.id }).from(surveyResponseAnswers).where(inArray(surveyResponseAnswers.questionId, questionIds)).limit(1))[0];
  }
  private createQuestion(tx: Tx, sectionId: string, input: SurveyQuestionInput) {
    return tx.insert(surveyQuestions).values({ sectionId, ordinal: input.ordinal, type: input.type, promptKr: input.prompt.kr, promptEn: input.prompt.en, helpTextKr: input.helpText?.kr ?? null, helpTextEn: input.helpText?.en ?? null, required: input.required, validationRegex: input.validationRegex ?? null, numberMin: input.numberMin ?? null, numberMax: input.numberMax ?? null, dateMin: input.dateMin ?? null, dateMax: input.dateMax ?? null }).returning();
  }
  private async updateQuestion(tx: Tx, questionId: string, input: SurveyQuestionInput): Promise<'CHOICE_DELETE_FORBIDDEN' | void> {
    await tx.update(surveyQuestions).set({ ordinal: input.ordinal, type: input.type, promptKr: input.prompt.kr, promptEn: input.prompt.en, helpTextKr: input.helpText?.kr ?? null, helpTextEn: input.helpText?.en ?? null, required: input.required, validationRegex: input.validationRegex ?? null, numberMin: input.numberMin ?? null, numberMax: input.numberMax ?? null, dateMin: input.dateMin ?? null, dateMax: input.dateMax ?? null }).where(eq(surveyQuestions.id, questionId));
    const existing = await tx.select().from(surveyChoiceOptions).where(eq(surveyChoiceOptions.questionId, questionId)).for('update');
    const inputs = input.choices ?? [];
    const byId = new Map(existing.map((choice) => [choice.id, choice]));
    if (inputs.some((choice) => choice.id !== undefined && !byId.has(choice.id))) return 'CHOICE_DELETE_FORBIDDEN';
    const retained = new Set(inputs.flatMap((choice) => choice.id ? [choice.id] : []));
    const removed = existing.filter((choice) => !retained.has(choice.id));
    if (removed.length) {
      const [answer] = await tx.select({ id: surveyResponseAnswers.id }).from(surveyResponseAnswers).where(and(eq(surveyResponseAnswers.questionId, questionId), sql`(${surveyResponseAnswers.choiceOptionIds})::jsonb ?| ARRAY[${sql.join(removed.map((choice) => sql`${choice.id}`), sql`, `)}]::text[]`)).limit(1);
      if (answer) return 'CHOICE_DELETE_FORBIDDEN';
      await tx.delete(surveyChoiceOptions).where(inArray(surveyChoiceOptions.id, removed.map((choice) => choice.id)));
    }
    const offset = Math.max(0, ...existing.map((choice) => choice.ordinal), ...inputs.map((choice) => choice.ordinal)) + existing.length + inputs.length + 1;
    for (const choice of existing.filter((choice) => retained.has(choice.id))) await tx.update(surveyChoiceOptions).set({ ordinal: choice.ordinal + offset }).where(eq(surveyChoiceOptions.id, choice.id));
    for (const choice of inputs) {
      if (choice.id) await tx.update(surveyChoiceOptions).set({ ordinal: choice.ordinal, valueKr: choice.value.kr, valueEn: choice.value.en }).where(eq(surveyChoiceOptions.id, choice.id));
      else await tx.insert(surveyChoiceOptions).values({ questionId, ordinal: choice.ordinal, valueKr: choice.value.kr, valueEn: choice.value.en });
    }
  }
  async imageMembershipPage(surveyId: string, blockId: string, set: 'SHARED' | 'KO' | 'EN', limit: number, after: { orderKey: number; id: string } | null) {
    const [scoped] = await this.db.select({ survey: surveys, block: surveyImageBlocks }).from(surveys).innerJoin(surveyRevisions, and(eq(surveyRevisions.surveyId, surveys.id), eq(surveyRevisions.revision, surveys.currentRevision))).innerJoin(surveySections, eq(surveySections.surveyRevisionId, surveyRevisions.id)).innerJoin(surveySectionItems, eq(surveySectionItems.sectionId, surveySections.id)).innerJoin(surveyImageBlocks, eq(surveyImageBlocks.itemId, surveySectionItems.id)).where(and(eq(surveys.id, surveyId), eq(surveyImageBlocks.itemId, blockId)));
    if (!scoped) return null;
    const rows = await this.db.select({ membership: surveyImageBlockMemberships, image: surveyImageAssets }).from(surveyImageBlockMemberships).innerJoin(surveyImageBlocks, eq(surveyImageBlocks.itemId, surveyImageBlockMemberships.blockId)).innerJoin(surveySectionItems, eq(surveySectionItems.id, surveyImageBlocks.itemId)).innerJoin(surveySections, eq(surveySections.id, surveySectionItems.sectionId)).innerJoin(surveyRevisions, eq(surveyRevisions.id, surveySections.surveyRevisionId)).innerJoin(surveys, and(eq(surveys.id, surveyRevisions.surveyId), eq(surveyRevisions.revision, surveys.currentRevision))).innerJoin(surveyImageAssets, and(eq(surveyImageAssets.id, surveyImageBlockMemberships.assetId), eq(surveyImageAssets.status, 'COMPLETED'), isNull(surveyImageAssets.deletedAt))).where(and(eq(surveys.id, surveyId), eq(surveyImageBlockMemberships.blockId, blockId), eq(surveyImageBlockMemberships.set, set), after ? or(gt(surveyImageBlockMemberships.orderKey, after.orderKey), and(eq(surveyImageBlockMemberships.orderKey, after.orderKey), gt(surveyImageBlockMemberships.id, after.id))) : undefined)).orderBy(asc(surveyImageBlockMemberships.orderKey), asc(surveyImageBlockMemberships.id)).limit(limit + 1);
    return { survey: scoped.survey, rows, membershipCount: this.storedMembershipCount(scoped.block, set) };
  }
  async mutateImageMembership(surveyId: string, actor: string, expectedDefinitionVersion: number, clientMutationId: string, blockId: string, operation: { type: 'ADD'; set: 'SHARED' | 'KO' | 'EN'; assetId: string; afterId: string | null } | { type: 'REMOVE'; membershipId: string } | { type: 'MOVE'; membershipId: string; afterId: string | null }, correlationId: string) {
    return this.db.transaction(async (tx) => {
      const requestHash = createHash('sha256').update(JSON.stringify({ expectedDefinitionVersion, blockId, operation })).digest('hex');
      const revision = await this.lockDraft(tx, surveyId); if (!revision) return 'IMMUTABLE' as const;
      const [survey] = await tx.select().from(surveys).where(eq(surveys.id, surveyId)).for('update'); if (!survey) return 'MISSING' as const;
      const [replayed] = await tx.select().from(surveyImageMembershipMutations).where(and(eq(surveyImageMembershipMutations.surveyId, surveyId), eq(surveyImageMembershipMutations.actorUserId, actor), eq(surveyImageMembershipMutations.clientMutationId, clientMutationId))).for('update');
      if (replayed) { if (replayed.operation !== operation.type || replayed.requestHash !== requestHash) return 'IDEMPOTENCY_MISMATCH' as const; let parsed: unknown; try { parsed = JSON.parse(replayed.resultJson); } catch { throw new Error('survey_image_membership_mutation_result_invalid'); } if (!isSurveyImageMembershipMutationResult(parsed)) throw new Error('survey_image_membership_mutation_result_invalid'); return { ...parsed, replayed: true }; }
      if (survey.definitionVersion !== expectedDefinitionVersion) return 'STALE' as const;
      const scopedBlock = await tx.select({ block: surveyImageBlocks }).from(surveyImageBlocks).innerJoin(surveySectionItems, eq(surveySectionItems.id, surveyImageBlocks.itemId)).innerJoin(surveySections, eq(surveySections.id, surveySectionItems.sectionId)).where(and(eq(surveyImageBlocks.itemId, blockId), eq(surveySections.surveyRevisionId, revision.id))).for('update');
      const block = scopedBlock[0]?.block; if (!block) return 'INVALID_BLOCK' as const;
      let set: 'SHARED' | 'KO' | 'EN'; let membership: typeof surveyImageBlockMemberships.$inferSelect | null = null; let count: number;
      if (operation.type === 'ADD') { set = operation.set; if ((block.mode === 'SHARED') !== (set === 'SHARED') || (survey.onlyForKoreanSpeaker && set === 'EN')) return 'INVALID_SET' as const; const [asset] = await tx.select().from(surveyImageAssets).where(and(eq(surveyImageAssets.id, operation.assetId), eq(surveyImageAssets.ownerUserId, actor))).for('update'); if (!asset || asset.status !== 'COMPLETED' || asset.deletedAt !== null || asset.objectDeletionStatus === 'CLAIMED') return 'INVALID_ASSET' as const; const key = await this.sparseOrderKey(tx, blockId, set, operation.afterId, null); if (typeof key === 'string') return key; const [created] = await tx.insert(surveyImageBlockMemberships).values({ blockId, set, assetId: asset.id, orderKey: key }).returning(); membership = created!; count = this.storedMembershipCount(block, set) + 1; await this.updateMembershipCount(tx, blockId, set, count); }
      else { const [existing] = await tx.select().from(surveyImageBlockMemberships).where(and(eq(surveyImageBlockMemberships.id, operation.membershipId), eq(surveyImageBlockMemberships.blockId, blockId))).for('update'); if (!existing) return 'INVALID_MEMBERSHIP' as const; set = existing.set; if (survey.onlyForKoreanSpeaker && block.mode === 'LOCALIZED' && set === 'EN') return 'INVALID_SET' as const; count = this.storedMembershipCount(block, set); if (operation.type === 'REMOVE') { await tx.delete(surveyImageBlockMemberships).where(eq(surveyImageBlockMemberships.id, existing.id)); membership = null; count -= 1; await this.updateMembershipCount(tx, blockId, set, count); } else { const key = await this.sparseOrderKey(tx, blockId, set, operation.afterId, existing.id); if (typeof key === 'string') return key; await tx.update(surveyImageBlockMemberships).set({ orderKey: key }).where(eq(surveyImageBlockMemberships.id, existing.id)); membership = { ...existing, orderKey: key }; } }
      if (survey.onlyForKoreanSpeaker && block.mode === 'LOCALIZED') await this.mirrorKoreanDefinition(tx, revision.id); await this.bumpDefinition(tx, surveyId, actor); const [updated] = await tx.select({ definitionVersion: surveys.definitionVersion }).from(surveys).where(eq(surveys.id, surveyId)); const result: SurveyImageMembershipMutationResult = { replayed: false, definitionVersion: updated!.definitionVersion, membership: membership ? { id: membership.id, blockId: membership.blockId, set: membership.set, assetId: membership.assetId, orderKey: membership.orderKey } : null, membershipCount: count }; await tx.insert(surveyImageMembershipMutations).values({ surveyId, actorUserId: actor, clientMutationId, operation: operation.type, requestHash, resultJson: JSON.stringify(result) }); await this.audit(tx, surveyId, null, actor, `SURVEY_IMAGE_MEMBERSHIP_${operation.type}`, 'definition_version,membership', correlationId); return result;
    });
  }
  private storedMembershipCount(block: typeof surveyImageBlocks.$inferSelect, set: 'SHARED' | 'KO' | 'EN') { return set === 'SHARED' ? block.sharedMembershipCount : set === 'KO' ? block.koMembershipCount : block.enMembershipCount; }
  private async updateMembershipCount(tx: Tx, blockId: string, set: 'SHARED' | 'KO' | 'EN', count: number) {
    const values = set === 'SHARED'
      ? { sharedMembershipCount: count }
      : set === 'KO'
        ? { koMembershipCount: count }
        : { enMembershipCount: count };
    await tx.update(surveyImageBlocks).set(values).where(eq(surveyImageBlocks.itemId, blockId));
  }
  private async sparseOrderKey(tx: Tx, blockId: string, set: 'SHARED' | 'KO' | 'EN', afterId: string | null, excludeId: string | null): Promise<number | 'INVALID_NEIGHBOR' | 'ORDER_REBALANCE_EXHAUSTED'> {
    const minimum = -2_147_483_648;
    const maximum = 2_147_483_647;
    const after = afterId ? (await tx.select().from(surveyImageBlockMemberships).where(and(eq(surveyImageBlockMemberships.id, afterId), eq(surveyImageBlockMemberships.blockId, blockId), eq(surveyImageBlockMemberships.set, set))).for('update'))[0] : null;
    if (afterId && (!after || after.id === excludeId)) return 'INVALID_NEIGHBOR';
    const nextWhere = after ? gt(surveyImageBlockMemberships.orderKey, after.orderKey) : undefined;
    const successors = await tx.select().from(surveyImageBlockMemberships).where(and(eq(surveyImageBlockMemberships.blockId, blockId), eq(surveyImageBlockMemberships.set, set), nextWhere, excludeId ? sql`${surveyImageBlockMemberships.id} <> ${excludeId}` : undefined)).orderBy(asc(surveyImageBlockMemberships.orderKey), asc(surveyImageBlockMemberships.id)).for('update');
    if (!successors.length) {
      if (!after) return 0;
      return after.orderKey < maximum ? after.orderKey + Math.ceil((maximum - after.orderKey) / 2) : 'ORDER_REBALANCE_EXHAUSTED';
    }
    const lower = after?.orderKey ?? Math.max(minimum, successors[0]!.orderKey - 1024);
    const upper = successors[0]!.orderKey;
    if (upper - lower > 1) return lower + Math.floor((upper - lower) / 2);
    const step = Math.min(1024, Math.floor((maximum - lower) / (successors.length + 2)));
    if (step < 2) return 'ORDER_REBALANCE_EXHAUSTED';
    const targets = successors.map((row, index) => ({ id: row.id, orderKey: lower + step * (index + 1), rank: index + 1 }));
    const temporaryStart = Math.max(...successors.map((row) => row.orderKey));
    if (temporaryStart > maximum - targets.length) return 'ORDER_REBALANCE_EXHAUSTED';
    await tx.execute(sql`
      WITH targets(id, order_key, rank) AS (VALUES ${sql.join(targets.map((target) => sql`(${target.id}::uuid, ${target.orderKey}::integer, ${target.rank}::integer)`), sql`, `)})
      UPDATE survey_image_block_memberships AS membership
      SET order_key = ${temporaryStart}::integer + targets.rank
      FROM targets
      WHERE membership.id = targets.id
    `);
    await tx.execute(sql`
      WITH targets(id, order_key) AS (VALUES ${sql.join(targets.map((target) => sql`(${target.id}::uuid, ${target.orderKey}::integer)`), sql`, `)})
      UPDATE survey_image_block_memberships AS membership
      SET order_key = targets.order_key
      FROM targets
      WHERE membership.id = targets.id
    `);
    return lower + Math.floor(step / 2);
  }
  async changeImageBlockMode(surveyId: string, actor: string, expectedDefinitionVersion: number, clientMutationId: string, blockId: string, mode: 'SHARED' | 'LOCALIZED', retainSet: 'KO' | 'EN' | undefined, correlationId: string) {
    return this.db.transaction(async (tx) => { const operation = 'MODE'; const requestHash = createHash('sha256').update(JSON.stringify({ expectedDefinitionVersion, blockId, mode, retainSet })).digest('hex');
      const revision = await this.lockDraft(tx, surveyId);
      if (!revision) return 'IMMUTABLE' as const;
      const [survey] = await tx.select().from(surveys).where(eq(surveys.id, surveyId)).for('update');
      if (!survey) return 'MISSING' as const;
      const [replayed] = await tx.select().from(surveyImageMembershipMutations).where(and(eq(surveyImageMembershipMutations.surveyId, surveyId), eq(surveyImageMembershipMutations.actorUserId, actor), eq(surveyImageMembershipMutations.clientMutationId, clientMutationId))).for('update');
      if (replayed) { if (replayed.operation !== operation || replayed.requestHash !== requestHash) return 'IDEMPOTENCY_MISMATCH' as const; let parsed: unknown; try { parsed = JSON.parse(replayed.resultJson); } catch { throw new Error('survey_image_block_mode_mutation_result_invalid'); } if (!isSurveyImageBlockModeMutationResult(parsed)) throw new Error('survey_image_block_mode_mutation_result_invalid'); return { ...parsed, replayed: true }; }
      if (survey.definitionVersion !== expectedDefinitionVersion) return 'STALE' as const;
      const scopedBlock = await tx.select({ block: surveyImageBlocks })
        .from(surveyImageBlocks)
        .innerJoin(surveySectionItems, eq(surveySectionItems.id, surveyImageBlocks.itemId))
        .innerJoin(surveySections, eq(surveySections.id, surveySectionItems.sectionId))
        .where(and(eq(surveyImageBlocks.itemId, blockId), eq(surveySections.surveyRevisionId, revision.id)))
        .for('update');
      const block = scopedBlock[0]?.block;
      if (!block || block.mode === mode) return 'INVALID_MODE' as const;
      if (mode === 'LOCALIZED') {
        await tx.execute(sql`
          WITH source AS (
            DELETE FROM survey_image_block_memberships
            WHERE block_id = ${blockId}
            RETURNING asset_id, order_key, set
          ),
          inserted AS (
            INSERT INTO survey_image_block_memberships (block_id, set, asset_id, order_key)
            SELECT ${blockId}, target.set, source.asset_id, source.order_key
            FROM source
            CROSS JOIN (VALUES ('KO'::survey_image_membership_set), ('EN'::survey_image_membership_set)) AS target(set)
            WHERE source.set = 'SHARED'
          )
          UPDATE survey_image_blocks
          SET mode = 'LOCALIZED', shared_membership_count = 0,
              ko_membership_count = (SELECT count(*)::integer FROM source WHERE set = 'SHARED'),
              en_membership_count = (SELECT count(*)::integer FROM source WHERE set = 'SHARED')
          WHERE item_id = ${blockId}
        `);
      } else {
        if (!retainSet || (survey.onlyForKoreanSpeaker && retainSet === 'EN')) return 'INVALID_MODE' as const;
        await tx.execute(sql`
          WITH source AS (
            DELETE FROM survey_image_block_memberships
            WHERE block_id = ${blockId}
            RETURNING asset_id, order_key, set
          ),
          inserted AS (
            INSERT INTO survey_image_block_memberships (block_id, set, asset_id, order_key)
            SELECT ${blockId}, 'SHARED'::survey_image_membership_set, asset_id, order_key
            FROM source
            WHERE set = ${retainSet}::survey_image_membership_set
          )
          UPDATE survey_image_blocks
          SET mode = 'SHARED',
              shared_membership_count = (SELECT count(*)::integer FROM source WHERE set = ${retainSet}::survey_image_membership_set),
              ko_membership_count = 0, en_membership_count = 0
          WHERE item_id = ${blockId}
        `);
      }
      const [countsRow] = await tx.select({
        shared: surveyImageBlocks.sharedMembershipCount,
        ko: surveyImageBlocks.koMembershipCount,
        en: surveyImageBlocks.enMembershipCount,
      }).from(surveyImageBlocks).where(eq(surveyImageBlocks.itemId, blockId));
      const counts = { shared: countsRow!.shared, ko: countsRow!.ko, en: countsRow!.en };
      if (survey.onlyForKoreanSpeaker) await this.mirrorKoreanDefinition(tx, revision.id);
      await this.bumpDefinition(tx, surveyId, actor);
      const [updated] = await tx.select({ definitionVersion: surveys.definitionVersion }).from(surveys).where(eq(surveys.id, surveyId));
      const result = { replayed: false, definitionVersion: updated!.definitionVersion, mode, membershipCounts: counts };
      await tx.insert(surveyImageMembershipMutations).values({ surveyId, actorUserId: actor, clientMutationId, operation, requestHash, resultJson: JSON.stringify(result) });
      await this.audit(tx, surveyId, null, actor, 'SURVEY_IMAGE_BLOCK_MODE_CHANGED', 'definition_version,mode', correlationId);
      return result;
    });
  }
  createSurveyImageAsset(values: typeof surveyImageAssets.$inferInsert) {
    return this.db.insert(surveyImageAssets).values(values).returning().then((rows) => rows[0]!);
  }
  async surveyImageAsset(id: string) {
    const [row] = await this.db.select().from(surveyImageAssets).where(eq(surveyImageAssets.id, id));
    return row ?? null;
  }
  async publicSurveyImageAsset(surveyId: string, imageId: string) { const [row] = await this.db.select({ survey: surveys, image: surveyImageAssets }).from(surveys).innerJoin(surveyRevisions, and(eq(surveyRevisions.surveyId, surveys.id), eq(surveyRevisions.revision, surveys.currentRevision))).innerJoin(surveySections, eq(surveySections.surveyRevisionId, surveyRevisions.id)).innerJoin(surveySectionItems, eq(surveySectionItems.sectionId, surveySections.id)).innerJoin(surveyImageBlocks, eq(surveyImageBlocks.itemId, surveySectionItems.id)).innerJoin(surveyImageBlockMemberships, and(eq(surveyImageBlockMemberships.blockId, surveyImageBlocks.itemId), eq(surveyImageBlockMemberships.assetId, imageId))).innerJoin(surveyImageAssets, and(eq(surveyImageAssets.id, surveyImageBlockMemberships.assetId), eq(surveyImageAssets.status, 'COMPLETED'))).where(and(eq(surveys.id, surveyId), isNull(surveyImageAssets.deletedAt))); return row ?? null; }
  async completeSurveyImageAsset(id: string, checksumSha256: string, width: number, height: number, now: Date) {
    const [row] = await this.db.update(surveyImageAssets).set({ status: 'COMPLETED', checksumSha256, width, height, completedAt: now }).where(and(eq(surveyImageAssets.id, id), eq(surveyImageAssets.status, 'INITIATED'))).returning();
    return row ?? null;
  }
  private static readonly maxImageCleanupAttempts = 12;
  async claimImageCleanupCandidates(now: Date, graceMs: number, limit: number) {
    return this.db.transaction(async (tx) => {
      const eligible = or(
        and(eq(surveyImageAssets.status, 'INITIATED'), lt(surveyImageAssets.createdAt, new Date(now.getTime() - graceMs))),
        and(eq(surveyImageAssets.status, 'COMPLETED'), lt(surveyImageAssets.completedAt, new Date(now.getTime() - graceMs))),
      );
      const exhausted = await tx.update(surveyImageCleanupClaims)
        .set({ completedAt: now, lastErrorCode: 'attempts_exhausted' })
        .where(and(isNull(surveyImageCleanupClaims.completedAt), sql`${surveyImageCleanupClaims.attempts} >= ${SurveysRepository.maxImageCleanupAttempts}`))
        .returning({ assetId: surveyImageCleanupClaims.assetId });
      if (exhausted.length) await tx.update(surveyImageAssets)
        .set({ objectDeletionStatus: 'FAILED', lastObjectDeletionErrorCode: 'attempts_exhausted' })
        .where(inArray(surveyImageAssets.id, exhausted.map((claim) => claim.assetId)));
      const leaseCutoff = new Date(now.getTime() - graceMs);
      const candidates = await tx.select().from(surveyImageAssets).where(and(
        eligible,
        ne(surveyImageAssets.objectDeletionStatus, 'FAILED'),
        sql`NOT EXISTS (SELECT 1 FROM survey_image_block_memberships m WHERE m.asset_id = ${surveyImageAssets.id})`,
        sql`NOT EXISTS (
          SELECT 1 FROM survey_image_cleanup_claims c
          WHERE c.asset_id = ${surveyImageAssets.id}
            AND c.completed_at IS NULL
            AND (
              c.next_retry_at > ${now}
              OR (c.next_retry_at IS NULL AND c.claimed_at >= ${leaseCutoff})
            )
        )`,
      )).orderBy(asc(surveyImageAssets.createdAt), asc(surveyImageAssets.id)).limit(limit).for('update', { skipLocked: true });
      const claimed: Array<{ asset: typeof surveyImageAssets.$inferSelect; claimToken: string }> = [];
      for (const asset of candidates) {
        const [reference] = await tx.select({ id: surveyImageBlockMemberships.id }).from(surveyImageBlockMemberships).where(eq(surveyImageBlockMemberships.assetId, asset.id)).limit(1);
        if (reference || asset.status === 'DELETED') continue;
        const [existing] = await tx.select().from(surveyImageCleanupClaims).where(and(eq(surveyImageCleanupClaims.assetId, asset.id), isNull(surveyImageCleanupClaims.completedAt))).for('update');
        if (existing && existing.attempts >= SurveysRepository.maxImageCleanupAttempts) continue;
        const leaseExpired = !!existing && existing.claimedAt < leaseCutoff;
        if (existing && ((existing.nextRetryAt !== null && existing.nextRetryAt > now) || (existing.nextRetryAt === null && !leaseExpired))) continue;
        if (asset.objectDeletionStatus === 'CLAIMED' && !leaseExpired) continue;
        if (asset.objectDeletionStatus === 'CLAIMED') await tx.update(surveyImageAssets).set({ objectDeletionStatus: 'PENDING', lastObjectDeletionErrorCode: 'claim_lease_expired' }).where(eq(surveyImageAssets.id, asset.id));
        const claimToken = crypto.randomUUID();
        const attempts = (existing?.attempts ?? 0) + 1;
        if (existing) await tx.update(surveyImageCleanupClaims).set({ claimToken, claimedAt: now, nextRetryAt: null, lastErrorCode: null, attempts }).where(eq(surveyImageCleanupClaims.id, existing.id));
        else await tx.insert(surveyImageCleanupClaims).values({ assetId: asset.id, claimToken, attempts });
        claimed.push({ asset, claimToken });
      }
      return { claims: claimed, exhaustedAssetIds: exhausted.map((claim) => claim.assetId) };
    });
  }
  async beginImageCleanupDeletion(assetId: string, claimToken: string, now: Date) {
    return this.db.transaction(async (tx) => {
      const [asset] = await tx.select().from(surveyImageAssets).where(eq(surveyImageAssets.id, assetId)).for('update');
      const [claim] = await tx.select().from(surveyImageCleanupClaims).where(and(eq(surveyImageCleanupClaims.assetId, assetId), eq(surveyImageCleanupClaims.claimToken, claimToken), isNull(surveyImageCleanupClaims.completedAt))).for('update');
      if (!asset || !claim || asset.status === 'DELETED' || asset.objectDeletionStatus === 'CLAIMED') return null;
      const [reference] = await tx.select({ id: surveyImageBlockMemberships.id }).from(surveyImageBlockMemberships).where(eq(surveyImageBlockMemberships.assetId, assetId)).limit(1);
      if (reference) { await tx.update(surveyImageCleanupClaims).set({ completedAt: now, lastErrorCode: 'reattached' }).where(eq(surveyImageCleanupClaims.id, claim.id)); return null; }
      const [claimed] = await tx.update(surveyImageAssets).set({ objectDeletionStatus: 'CLAIMED', objectDeletionAttempts: sql`${surveyImageAssets.objectDeletionAttempts} + 1`, lastObjectDeletionErrorCode: null }).where(and(eq(surveyImageAssets.id, assetId), eq(surveyImageAssets.objectDeletionStatus, 'PENDING'))).returning();
      return claimed ?? null;
    });
  }
  async completeImageCleanupClaim(assetId: string, claimToken: string, now: Date, errorCode?: string) {
    return this.db.transaction(async (tx) => {
      const [asset] = await tx.select().from(surveyImageAssets).where(eq(surveyImageAssets.id, assetId)).for('update');
      const [claim] = await tx.select().from(surveyImageCleanupClaims).where(and(eq(surveyImageCleanupClaims.assetId, assetId), eq(surveyImageCleanupClaims.claimToken, claimToken), isNull(surveyImageCleanupClaims.completedAt))).for('update');
      if (!asset || !claim || asset.objectDeletionStatus !== 'CLAIMED') return false;
      if (errorCode) {
        const delayMs = Math.min(3_600_000, 1_000 * 2 ** Math.min(claim.attempts, 12));
        await tx.update(surveyImageAssets).set({ objectDeletionStatus: 'PENDING', lastObjectDeletionErrorCode: errorCode }).where(eq(surveyImageAssets.id, assetId));
        await tx.update(surveyImageCleanupClaims).set({ nextRetryAt: new Date(now.getTime() + delayMs), lastErrorCode: errorCode }).where(eq(surveyImageCleanupClaims.id, claim.id));
        return false;
      }
      const [reference] = await tx.select({ id: surveyImageBlockMemberships.id }).from(surveyImageBlockMemberships).where(eq(surveyImageBlockMemberships.assetId, assetId)).limit(1);
      if (reference) { await tx.update(surveyImageAssets).set({ objectDeletionStatus: 'PENDING' }).where(eq(surveyImageAssets.id, assetId)); await tx.update(surveyImageCleanupClaims).set({ completedAt: now, lastErrorCode: 'reattached' }).where(eq(surveyImageCleanupClaims.id, claim.id)); return false; }
      await tx.update(surveyImageAssets).set({ status: 'DELETED', deletedAt: now, purgeAfter: now, objectDeletionStatus: 'DELETED', lastObjectDeletionErrorCode: null }).where(eq(surveyImageAssets.id, assetId));
      await tx.update(surveyImageCleanupClaims).set({ completedAt: now, nextRetryAt: null, lastErrorCode: null }).where(eq(surveyImageCleanupClaims.id, claim.id));
      return true;
    });
  }
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
  async responsePage(surveyId: string, state: 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'WAITLISTED', limit: number, cursor?: { submittedAt: Date; responseId: string }) {
    if (!(await this.survey(surveyId))) return null;
    const predicate = cursor ? or(
      lt(surveyResponses.submittedAt, cursor.submittedAt),
      and(eq(surveyResponses.submittedAt, cursor.submittedAt), lt(surveyResponses.id, cursor.responseId)),
    ) : undefined;
    const items = await this.db.select({
      response: surveyResponses, revision: surveyRevisions,
    }).from(surveyResponses).innerJoin(surveyRevisions, eq(surveyRevisions.id, surveyResponses.surveyRevisionId))
      .where(and(eq(surveyResponses.surveyId, surveyId), eq(surveyResponses.state, state), predicate))
      .orderBy(desc(surveyResponses.submittedAt), desc(surveyResponses.id)).limit(limit + 1);
    const [{ count }] = await this.db.select({ count: sql<number>`count(*)::int` }).from(surveyResponses)
      .where(and(eq(surveyResponses.surveyId, surveyId), eq(surveyResponses.state, state)));
    return { items, count: Number(count) };
  }
  async responseDetail(surveyId: string, responseId: string) {
    const [row] = await this.db.select({ response: surveyResponses, revision: surveyRevisions }).from(surveyResponses)
      .innerJoin(surveyRevisions, eq(surveyRevisions.id, surveyResponses.surveyRevisionId))
      .where(and(eq(surveyResponses.surveyId, surveyId), eq(surveyResponses.id, responseId), inArray(surveyResponses.state, ['SUBMITTED', 'APPROVED', 'REJECTED', 'WAITLISTED']))).limit(1);
    if (!row) return null;
    const sections = await this.db.select().from(surveySections).where(eq(surveySections.surveyRevisionId, row.response.surveyRevisionId));
    const questions = sections.length ? await this.db.select().from(surveyQuestions).where(inArray(surveyQuestions.sectionId, sections.map((section) => section.id))) : [];
    const choices = questions.length ? await this.db.select().from(surveyChoiceOptions).where(inArray(surveyChoiceOptions.questionId, questions.map((question) => question.id))) : [];
    return { ...row, questions, choices, answers: await this.answers(responseId) };
  }
  async myResponses(userId: string) {
    return this.db.select().from(surveyResponses)
      .where(eq(surveyResponses.campusUserId, userId))
      .orderBy(desc(surveyResponses.submittedAt), desc(surveyResponses.id));
  }
  async exportPage(surveyId: string, limit: number, cursor: { submittedAt: string; responseId: string } | undefined, upperBoundary: { submittedAt: string; responseId: string }) {
    const cursorPredicate = cursor ? sql`
      AND (response.submitted_at, response.id) > (${cursor.submittedAt}::timestamptz, ${cursor.responseId}::uuid)
    ` : sql``;
    const rows = await this.db.execute(sql`
      WITH response_page AS (
        SELECT response.id, response.survey_revision_id, response.state, response.submitted_at
        FROM survey_responses AS response
        WHERE response.survey_id = ${surveyId}
        AND response.state IN ('SUBMITTED', 'APPROVED', 'REJECTED', 'WAITLISTED')
        ${cursorPredicate}
        AND (response.submitted_at, response.id) <= (${upperBoundary.submittedAt}::timestamptz, ${upperBoundary.responseId}::uuid)
        ORDER BY response.submitted_at ASC, response.id ASC
        LIMIT ${limit}
      )
      SELECT response.id AS response_id, response.survey_revision_id, revision.revision, response.state, response.submitted_at,
        response.submitted_at::text AS submitted_at_cursor,
        answer.id AS answer_id, answer.question_id, answer.text_value, answer.number_value, answer.date_value, answer.choice_option_ids,
        question.prompt_kr, question.prompt_en, selected_choice.id AS selected_choice_id, choice.id AS choice_id, choice.value_kr, choice.value_en
      FROM response_page AS response
      JOIN survey_revisions AS revision ON revision.id = response.survey_revision_id
      LEFT JOIN survey_response_answers AS answer ON answer.response_id = response.id
      LEFT JOIN survey_questions AS question ON question.id = answer.question_id
      LEFT JOIN LATERAL jsonb_array_elements_text(COALESCE(answer.choice_option_ids, '[]')::jsonb) AS selected_choice(id) ON true
      LEFT JOIN survey_choice_options AS choice ON choice.id = selected_choice.id::uuid AND choice.question_id = answer.question_id
      ORDER BY response.submitted_at ASC, response.id ASC, answer.id ASC, choice.ordinal ASC, choice.id ASC
    `);
    return rows.rows;
  }
  async review(
    surveyId: string,
    id: string,
    expectedSurveyRevisionId: string,
    actor: string,
    state: 'APPROVED' | 'REJECTED' | 'WAITLISTED',
    reason: string | null,
    correlationId: string,
  ) {
    return this.db.transaction(async (tx) => {
      const [response] = await tx.select().from(surveyResponses).where(and(eq(surveyResponses.id, id), eq(surveyResponses.surveyId, surveyId), inArray(surveyResponses.state, ['SUBMITTED', 'APPROVED', 'REJECTED', 'WAITLISTED']))).for('update');
      if (!response) return null;
      await tx.select({ id: surveyRevisions.id }).from(surveyRevisions).where(eq(surveyRevisions.id, response.surveyRevisionId)).for('update');
      if (response.surveyRevisionId !== expectedSurveyRevisionId) return 'STALE' as const;
      if (response.state !== 'SUBMITTED') return 'INVALID' as const;
      const [updated] = await tx.update(surveyResponses).set({
        state, reviewReason: reason, reviewedAt: new Date(), reviewedByUserId: actor,
      }).where(eq(surveyResponses.id, id)).returning();
      await this.audit(tx, response.surveyId, response.id, actor, 'SURVEY_RESPONSE_REVIEWED', 'state,reason', correlationId);
      return updated;
    });
  }
  async aggregate(surveyId: string) {
    const definitions = await this.db.execute(sql`
      SELECT revision.id AS survey_revision_id, revision.revision,
        question.id AS question_id, question.prompt_kr, question.prompt_en,
        choice.id AS choice_option_id, choice.value_kr, choice.value_en
      FROM survey_revisions AS revision
      LEFT JOIN survey_sections AS section ON section.survey_revision_id = revision.id
      LEFT JOIN survey_questions AS question ON question.section_id = section.id
      LEFT JOIN survey_choice_options AS choice ON choice.question_id = question.id
      WHERE revision.survey_id = ${surveyId}
        AND EXISTS (
          SELECT 1
          FROM survey_responses AS response
          WHERE response.survey_revision_id = revision.id
            AND response.state IN ('SUBMITTED', 'APPROVED', 'REJECTED', 'WAITLISTED')
        )
      ORDER BY revision.revision ASC, question.id ASC, choice.ordinal ASC, choice.id ASC
    `);
    if (!definitions.rows.length && !(await this.survey(surveyId))) return null;
    const responseCounts = await this.db.execute(sql`
      SELECT response.survey_revision_id, count(*)::int AS response_count
      FROM survey_responses AS response
      WHERE response.survey_id = ${surveyId}
        AND response.state IN ('SUBMITTED', 'APPROVED', 'REJECTED', 'WAITLISTED')
      GROUP BY response.survey_revision_id
    `);
    const answerCounts = await this.db.execute(sql`
      SELECT response.survey_revision_id, answer.question_id, count(*)::int AS response_count
      FROM survey_responses AS response
      JOIN survey_response_answers AS answer ON answer.response_id = response.id
      WHERE response.survey_id = ${surveyId}
        AND response.state IN ('SUBMITTED', 'APPROVED', 'REJECTED', 'WAITLISTED')
      GROUP BY response.survey_revision_id, answer.question_id
    `);
    const choiceCounts = await this.db.execute(sql`
      SELECT response.survey_revision_id, answer.question_id, choice_id.value AS choice_option_id, count(*)::int AS count
      FROM survey_responses AS response
      JOIN survey_response_answers AS answer ON answer.response_id = response.id
      CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(answer.choice_option_ids, '[]')::jsonb) AS choice_id(value)
      WHERE response.survey_id = ${surveyId}
        AND response.state IN ('SUBMITTED', 'APPROVED', 'REJECTED', 'WAITLISTED')
      GROUP BY response.survey_revision_id, answer.question_id, choice_id.value
    `);
    const revisionCounts = new Map(responseCounts.rows.map((row) => [row.survey_revision_id as string, Number(row.response_count)]));
    const questionCounts = new Map(answerCounts.rows.map((row) => [`${row.survey_revision_id}:${row.question_id}`, Number(row.response_count)]));
    const selections = new Map(choiceCounts.rows.map((row) => [`${row.survey_revision_id}:${row.question_id}:${row.choice_option_id}`, Number(row.count)]));
    const revisions = new Map<string, {
      surveyRevisionId: string; revision: number; responseCount: number;
      questions: Map<string, { questionId: string; promptKr: string; promptEn: string; responseCount: number; choices: Array<{ choiceOptionId: string; valueKr: string; valueEn: string; count: number }> }>;
    }>();
    for (const row of definitions.rows) {
      const surveyRevisionId = row.survey_revision_id as string;
      let revision = revisions.get(surveyRevisionId);
      if (!revision) {
        revision = { surveyRevisionId, revision: Number(row.revision), responseCount: revisionCounts.get(surveyRevisionId) ?? 0, questions: new Map() };
        revisions.set(surveyRevisionId, revision);
      }
      if (!row.question_id) continue;
      const questionId = row.question_id as string;
      let question = revision.questions.get(questionId);
      if (!question) {
        question = { questionId, promptKr: row.prompt_kr as string, promptEn: row.prompt_en as string, responseCount: questionCounts.get(`${surveyRevisionId}:${questionId}`) ?? 0, choices: [] };
        revision.questions.set(questionId, question);
      }
      if (row.choice_option_id) question.choices.push({
        choiceOptionId: row.choice_option_id as string, valueKr: row.value_kr as string, valueEn: row.value_en as string,
        count: selections.get(`${surveyRevisionId}:${questionId}:${row.choice_option_id}`) ?? 0,
      });
    }
    return {
      responseCount: [...revisionCounts.values()].reduce((total, count) => total + count, 0),
      revisions: [...revisions.values()].map(({ questions, ...revision }) => ({ ...revision, questions: [...questions.values()] })),
    };
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
      const boundary = await tx.execute(sql`
        SELECT submitted_at::text AS submitted_at, id AS response_id
        FROM survey_responses
        WHERE survey_id = ${surveyId}
          AND state IN ('SUBMITTED', 'APPROVED', 'REJECTED', 'WAITLISTED')
        ORDER BY submitted_at DESC, id DESC
        LIMIT 1
      `);
      await this.audit(tx, surveyId, null, actor, 'SURVEY_EXPORT_REQUESTED', 'format,status', correlationId);
      const upperBoundary = boundary.rows[0]
        ? { submittedAt: boundary.rows[0].submitted_at as string, responseId: boundary.rows[0].response_id as string }
        : null;
      return { export: created, upperBoundary };
    });
  }
  async listMatchers(subject: { articleId?: string; eventId?: string; surveyId?: string }) {
    const filters = [
      subject.articleId ? eq(contentMatchers.articleId, subject.articleId) : undefined,
      subject.eventId ? eq(contentMatchers.eventId, subject.eventId) : undefined,
      subject.surveyId ? eq(contentMatchers.surveyId, subject.surveyId) : undefined,
    ].filter((filter): filter is Exclude<typeof filter, undefined> => filter !== undefined);
    return this.db.select().from(contentMatchers)
      .where(filters.length ? and(...filters) : undefined)
      .orderBy(desc(contentMatchers.createdAt), desc(contentMatchers.id));
  }
  async related(subject: { articleId?: string; eventId?: string; surveyId?: string }, locale: 'ko' | 'en') {
    const relations = await this.listMatchers(subject);
    const cards = await Promise.all(relations.flatMap((relation) => {
      const pending: Array<Promise<Record<string, unknown> | null>> = [];
      if (relation.articleId && relation.articleId !== subject.articleId) pending.push(this.db.select({
        id: articles.id, titleKr: articles.titleKr, titleEn: articles.titleEn, boardCode: boards.code,
      }).from(articles).innerJoin(boards, eq(articles.boardId, boards.id)).where(and(
        eq(articles.id, relation.articleId), eq(articles.status, 'PUBLISHED'), eq(articles.scope, 'ALL'),
      )).limit(1).then(([article]) => article ? {
        kind: 'ARTICLE', id: article.id, title: locale === 'en' ? article.titleEn : article.titleKr,
        href: `/board/${article.boardCode}/${article.id}`, relationType: relation.relationType,
      } : null));
      if (relation.eventId && relation.eventId !== subject.eventId) pending.push(this.db.select().from(events).where(and(
        eq(events.id, relation.eventId), eq(events.visibility, 'PUBLIC'),
      )).limit(1).then(([event]) => event ? {
        kind: 'EVENT', id: event.id, title: locale === 'en' ? event.titleEn : event.titleKr,
        href: `/calendar?event=${event.id}`, startsAt: event.startAt.toISOString(), relationType: relation.relationType,
      } : null));
      if (relation.surveyId && relation.surveyId !== subject.surveyId) pending.push(this.db.select({
        id: surveys.id, titleKr: surveyRevisions.titleKr, titleEn: surveyRevisions.titleEn,
        opensAt: surveys.opensAt, closesAt: surveys.closesAt,
      }).from(surveys).innerJoin(surveyRevisions, and(
        eq(surveyRevisions.surveyId, surveys.id), eq(surveyRevisions.revision, surveys.currentRevision),
      )).where(and(eq(surveys.id, relation.surveyId), inArray(surveys.state, ['SCHEDULED', 'OPEN', 'CLOSED']))).limit(1).then(([survey]) => survey ? {
        kind: 'SURVEY', id: survey.id, title: locale === 'en' ? survey.titleEn : survey.titleKr,
        href: `/survey/${survey.id}`, opensAt: survey.opensAt?.toISOString() ?? null,
        closesAt: survey.closesAt?.toISOString() ?? null, relationType: relation.relationType,
      } : null));
      return pending;
    }));
    return cards.filter((card): card is Record<string, unknown> => card !== null);
  }
  async materializeEvent(surveyId: string, actor: string, location: string, visibility: 'PUBLIC' | 'AUTHENTICATED' | 'COMMITTEE', correlationId: string) {
    return this.db.transaction(async (tx) => {
      const [survey] = await tx.select().from(surveys).where(eq(surveys.id, surveyId)).for('update');
      if (!survey) return null;
      if (!survey.opensAt || !survey.closesAt) return 'INVALID' as const;
      const [revision] = await tx.select().from(surveyRevisions).where(and(
        eq(surveyRevisions.surveyId, surveyId), eq(surveyRevisions.revision, survey.currentRevision),
      )).limit(1);
      if (!revision) throw new Error('survey_revision_invariant_violation');
      const now = new Date();
      const [event] = await tx.insert(events).values({
        titleKr: revision.titleKr, titleEn: revision.titleEn,
        descriptionKr: revision.descriptionKr ?? revision.titleKr,
        descriptionEn: revision.descriptionEn ?? revision.titleEn,
        startAt: survey.opensAt, endAt: survey.closesAt, allDay: false, location, visibility,
        createdByUserId: actor, updatedByUserId: actor, createdAt: now, updatedAt: now,
      }).returning();
      const [relation] = await tx.insert(contentMatchers).values({
        eventId: event.id, surveyId, relationType: 'SURVEY_PERIOD', syncMode: 'SURVEY_TO_EVENT',
        createdByUserId: actor, updatedByUserId: actor, synchronizedAt: now, createdAt: now, updatedAt: now,
      }).returning();
      await this.audit(tx, surveyId, null, actor, 'SURVEY_EVENT_MATERIALIZED', 'event_id,relation_type,sync_mode', correlationId);
      return { event, relation };
    });
  }
  async matcher(
    input: {
      articleId?: string;
      eventId?: string;
      surveyId?: string;
      relationType: 'ANNOUNCEMENT' | 'SCHEDULE' | 'SURVEY_PERIOD';
      syncMode: 'NONE' | 'SURVEY_TO_EVENT';
      createdByUserId: string;
      updatedByUserId: string;
      synchronizedAt: Date | null;
    },
    correlationId: string,
  ) {
    return this.db.transaction(async (tx) => {
      if ([input.articleId, input.eventId, input.surveyId].filter(Boolean).length !== 2) return 'INVALID' as const;
      if (input.articleId && !(await tx.select().from(articles).where(eq(articles.id, input.articleId)).limit(1))[0]) return 'MISSING' as const;
      if (input.eventId && !(await tx.select().from(events).where(eq(events.id, input.eventId)).limit(1))[0]) return 'MISSING' as const;
      if (input.surveyId && !(await tx.select().from(surveys).where(eq(surveys.id, input.surveyId)).limit(1))[0]) return 'MISSING' as const;
      const [created] = await tx.insert(contentMatchers).values(input).onConflictDoNothing().returning();
      if (!created) return 'DUPLICATE' as const;
      if (input.surveyId) await this.audit(tx, input.surveyId, null, input.createdByUserId, 'CONTENT_MATCHER_CREATED', 'article_id,event_id,survey_id,relation_type,sync_mode', correlationId);
      return created;
    });
  }
  async deleteMatcher(id: string, actor: string, correlationId: string) {
    return this.db.transaction(async (tx) => {
      const [deleted] = await tx.delete(contentMatchers).where(eq(contentMatchers.id, id)).returning();
      if (!deleted) return null;
      if (deleted.surveyId) await this.audit(tx, deleted.surveyId, null, actor, 'CONTENT_MATCHER_DELETED', 'article_id,event_id,survey_id,relation_type,sync_mode', correlationId);
      return deleted;
    });
  }
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
  private async bumpDefinition(tx: Tx, surveyId: string, actor: string) {
    await tx.update(surveys).set({
      definitionVersion: sql`${surveys.definitionVersion} + 1`,
      updatedByUserId: actor,
      updatedAt: new Date(),
    }).where(eq(surveys.id, surveyId));
  }
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
    const items = sections.length ? await this.db.select().from(surveySectionItems).where(inArray(surveySectionItems.sectionId, sections.map((section) => section.id))).orderBy(asc(surveySectionItems.ordinal), asc(surveySectionItems.id)) : [];
    const descriptionItems = items.length ? await this.db.select().from(surveySectionDescriptionItems).where(inArray(surveySectionDescriptionItems.itemId, items.map((item) => item.id))) : [];
    const imageBlocks = items.length ? await this.db.select().from(surveyImageBlocks).where(inArray(surveyImageBlocks.itemId, items.map((item) => item.id))) : [];
    return rows.flatMap((survey) => {
      const revision = revisionBySurvey.get(survey.id);
      if (!revision) return [];
      const surveySections = sections.filter((section) => section.surveyRevisionId === revision.id);
      const surveyQuestions = questions.filter((question) => surveySections.some((section) => section.id === question.sectionId));
      const surveyChoices = choices.filter((choice) => surveyQuestions.some((question) => question.id === choice.questionId));
      return [{ survey, revision, sections: surveySections, questions: surveyQuestions, choices: surveyChoices, items: items.filter((item) => surveySections.some((section) => section.id === item.sectionId)), descriptionItems, imageBlocks }];
    });
  }
  private async lockDraft(tx: Tx, id: string) { const [survey] = await tx.select().from(surveys).where(eq(surveys.id, id)).for('update'); if (!survey || survey.state !== 'DRAFT') return null; const [revision] = await tx.select().from(surveyRevisions).where(and(eq(surveyRevisions.surveyId, id), eq(surveyRevisions.revision, survey.currentRevision))).for('update'); return revision ?? null; }
  private async surveyRow(id: string) { const [row] = await this.db.select().from(surveys).where(eq(surveys.id, id)); return row ?? null; }
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
