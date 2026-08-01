import { createHmac } from 'node:crypto';
import { ConflictException, ForbiddenException, Inject, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PiiCipherService } from '../../shared/security/pii-cipher.service';
import { PermissionsService } from '../permissions/permissions.service';
import { SurveysRepository, parseRestrictedCharacterPattern, surveyState } from './surveys.repository';
import { contentMatchers, surveys } from '../../infrastructure/postgres/postgres.schema';
import type { ContentLocale } from '@soc/contracts';

const TYPES = new Set(['SHORT_TEXT', 'LONG_TEXT', 'SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'NUMBER', 'DATE']);
const MAX_SECTIONS = 100;
const MAX_QUESTIONS = 100;
const MAX_CHOICES = 100;
const MAX_ANSWERS = 100;
const MAX_LOCALIZED_TEXT = 4_000;
const own = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
const exact = (value: unknown, keys: string[]): value is Record<string, unknown> => own(value) && Object.keys(value).every((key) => keys.includes(key));
const uuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
@Injectable()
export class SurveysService {
  constructor(@Inject(SurveysRepository) private readonly repo: SurveysRepository, @Inject(PermissionsService) private readonly permissions: PermissionsService, private readonly cipher: PiiCipherService, private readonly config: ConfigService) {}
  async list(actor: string | undefined, locale: ContentLocale) {
    const canManage = actor && await this.permissions.hasPermission(actor, 'SURVEY_MANAGE', 'GLOBAL');
    const details = canManage ? await this.repo.listAll() : await this.repo.listPublic();
    return { locale, items: details.map((detail) => this.publicDto(detail, locale)) };
  }

  async get(actor: string | undefined, id: string, locale: ContentLocale) {
    const detail = await this.repo.detail(id);
    if (!detail) throw new NotFoundException('survey_not_found');
    const effectiveState = surveyState(detail.survey as never, new Date());
    if (!['SCHEDULED', 'OPEN', 'CLOSED'].includes(effectiveState)) {
      if (!actor || !(await this.permissions.hasPermission(actor, 'SURVEY_MANAGE', 'GLOBAL'))) {
        throw new NotFoundException('survey_not_found');
      }
    }
    return this.publicDto(detail, locale);
  }
  async create(actor: string, input: unknown, correlationId: string) {
    await this.manage(actor);
    const value = this.settings(input, true);
    if (value.responseRetentionDays === undefined) {
      throw new UnprocessableEntityException('invalid_survey');
    }
    const body = input as Record<string, unknown>;
    const title = this.localized(body.title)!;
    const description = body.description === undefined || body.description === null
      ? null
      : this.localized(body.description);
    if (body.description !== undefined && body.description !== null && !description) {
      throw new UnprocessableEntityException('invalid_survey');
    }
    const created = await this.repo.create(
      {
        ...value,
        responseRetentionDays: value.responseRetentionDays,
        state: 'DRAFT',
        currentRevision: 1,
        createdByUserId: actor,
        updatedByUserId: actor,
      },
      {
        revision: 1,
        titleKr: title.kr,
        titleEn: title.en,
        descriptionKr: description?.kr ?? null,
        descriptionEn: description?.en ?? null,
        createdByUserId: actor,
      },
      correlationId,
    );
    return this.publicDto({ ...created, sections: [], questions: [], choices: [] }, 'ko');
  }
  async patch(actor: string, id: string, input: unknown, correlationId: string) {
    await this.manage(actor);
    const value = this.settings(input, false);
    const body = input as Record<string, unknown>;
    const title = body.title === undefined ? null : this.localized(body.title);
    const description = body.description === undefined || body.description === null
      ? null
      : this.localized(body.description);
    const revisionValues: {
      titleKr?: string;
      titleEn?: string;
      descriptionKr?: string | null;
      descriptionEn?: string | null;
    } = {};
    if (title) {
      revisionValues.titleKr = title.kr;
      revisionValues.titleEn = title.en;
    }
    if (body.description !== undefined) {
      revisionValues.descriptionKr = description?.kr ?? null;
      revisionValues.descriptionEn = description?.en ?? null;
    }
    const result = await this.repo.patch(
      id,
      actor,
      { ...value, updatedByUserId: actor, updatedAt: new Date() },
      revisionValues,
      correlationId,
    );
    if (!result) throw new NotFoundException('survey_not_found');
    if (result === 'IMMUTABLE') throw new UnprocessableEntityException('survey_immutable');
    if (result === 'INVALID_SETTINGS') throw new UnprocessableEntityException('invalid_survey');
    return this.admin(id);
  }
  async publish(actor: string, id: string, correlationId: string) { await this.manage(actor); const result = await this.repo.publish(id, actor, new Date(), correlationId); if (!result) throw new NotFoundException('survey_not_found'); if (result === 'IMMUTABLE') throw new UnprocessableEntityException('survey_immutable'); if (result === 'INVALID_SETTINGS') throw new UnprocessableEntityException('invalid_survey'); return { survey: await this.admin(id) }; }
  async sections(actor: string, id: string, input: unknown, correlationId: string) {
    await this.manage(actor);
    if (!exact(input, ['sections']) || !Array.isArray(input.sections)) {
      throw new UnprocessableEntityException('invalid_sections');
    }
    if (input.sections.length > MAX_SECTIONS) throw new UnprocessableEntityException('invalid_sections');
    for (const [index, section] of input.sections.entries()) {
      if (!exact(section, ['ordinal', 'title']) && !exact(section, ['ordinal', 'title', 'description'])) throw new UnprocessableEntityException('invalid_sections');
      const ordinal = section.ordinal;
      const description = section.description === undefined || section.description === null ? null : this.localized(section.description);
      if (typeof ordinal !== 'number' || !Number.isInteger(ordinal) || ordinal !== index || !this.localized(section.title) || (section.description !== undefined && section.description !== null && !description)) {
        throw new UnprocessableEntityException('invalid_sections');
      }
    }
    if (!unique(input.sections.map((section) => String((section as Record<string, unknown>).ordinal)))) {
      throw new UnprocessableEntityException('invalid_sections');
    }
    const result = await this.repo.replaceSections(id, actor, input.sections as never[], correlationId);
    if (result === 'MISSING') throw new NotFoundException('survey_not_found');
    if (result === 'IMMUTABLE') throw new UnprocessableEntityException('survey_immutable');
    return this.admin(id);
  }
  async questions(actor: string, sectionId: string, input: unknown, correlationId: string) {
    await this.manage(actor);
    if (!exact(input, ['questions']) || !Array.isArray(input.questions)) {
      throw new UnprocessableEntityException('invalid_questions');
    }
    if (input.questions.length > MAX_QUESTIONS) throw new UnprocessableEntityException('invalid_questions');
    for (const [index, question] of input.questions.entries()) {
      this.question(question);
      if ((question as Record<string, unknown>).ordinal !== index) {
        throw new UnprocessableEntityException('invalid_questions');
      }
    }
    if (!unique(input.questions.map((question) => String((question as Record<string, unknown>).ordinal)))) {
      throw new UnprocessableEntityException('invalid_questions');
    }
    const result = await this.repo.replaceQuestions(sectionId, actor, input.questions as never[], correlationId);
    if (result === 'MISSING') throw new NotFoundException('survey_section_not_found');
    if (result === 'IMMUTABLE') throw new UnprocessableEntityException('survey_immutable');
    return this.admin(result.surveyId);
  }
  async submit(actor: string | undefined, id: string, input: unknown, correlationId: string) {
    if ((!exact(input, ['answers', 'guestPhone']) && !exact(input, ['answers'])) || !Array.isArray(input.answers) || input.answers.length > MAX_ANSWERS) throw new UnprocessableEntityException('invalid_response');
    const phone = input.guestPhone;
    if (actor && phone !== undefined) throw new UnprocessableEntityException('invalid_response');
    let guest: { phone: string; hash: string; version: string; candidates: Array<{ hash: string; version: string }> } | undefined;
    if (!actor) {
      const detail = await this.repo.detail(id);
      if (!detail) throw new NotFoundException('survey_not_found');
      if (phone === undefined) {
        if (detail.survey.phoneRequired) throw new UnprocessableEntityException('guest_phone_required');
      } else {
        if (typeof phone !== 'string') throw new UnprocessableEntityException('invalid_response');
        const canonical = this.phone(phone);
        const version = this.config.get<string>('SURVEY_PHONE_HASH_HMAC_VERSION');
        const activeKey = this.hmacKey(this.config.get<string>('SURVEY_PHONE_HASH_HMAC_KEY'));
        if (!version || !/^[A-Za-z0-9._-]{1,64}$/.test(version) || !activeKey) throw new Error('survey_phone_hash_configuration_invalid');
        const prior = this.priorHmacKeys();
        if (!prior || prior.has(version)) throw new Error('survey_phone_hash_configuration_invalid');
        const hash = (key: Buffer) => createHmac('sha256', key).update(`survey-response\u0000${id}\u0000${canonical}`).digest('base64url');
        guest = { phone: canonical, version, hash: hash(activeKey), candidates: [{ version, hash: hash(activeKey) }, ...[...prior].map(([priorVersion, key]) => ({ version: priorVersion, hash: hash(key) }))] };
      }
    }
    let encryptedGuest: { ciphertext: string; hash: string; version: string; candidates: Array<{ hash: string; version: string }> } | null = null;
    if (guest) {
      const ciphertext = this.cipher.encrypt('survey-response-phone', guest.phone);
      if (ciphertext === null) throw new Error('survey_phone_encryption_failed');
      encryptedGuest = { ciphertext, hash: guest.hash, version: guest.version, candidates: guest.candidates };
    }
    const result = await this.repo.submit(id, actor, encryptedGuest, input.answers, correlationId);
    if (!result) throw new NotFoundException('survey_not_found');
    if (result === 'CLOSED') throw new UnprocessableEntityException('survey_closed');
    if (result === 'GUEST') throw new ForbiddenException('guest_not_allowed');
    if (result === 'PAID') throw new ForbiddenException('paid_only');
    if (result === 'CAP') {
      if (actor) throw new UnprocessableEntityException('survey_cap_reached');
      return { status: 'ACCEPTED' as const };
    }
    if (result === 'INVALID') throw new UnprocessableEntityException('invalid_answers');
    if (!actor) return { status: 'ACCEPTED' };
    if (result === 'DUPLICATE') throw new ConflictException('duplicate_response');
    return { response: this.response(result.response, result.answers) };
  }
  async mine(actor: string, id: string) { const response = await this.repo.myResponse(id, actor); return { response: response ? this.response(response, await this.repo.answers(response.id)) : null }; }
  async mineAll(actor: string) {
    const rows = await this.repo.myResponses(actor);
    return {
      items: await Promise.all(rows.map(async (row) => ({
        survey: this.publicDto((await this.repo.detail(row.surveyId))!, 'ko'),
        response: this.response(row, await this.repo.answers(row.id)),
      }))),
    };
  }
  async responses(actor: string, surveyId: string) {
    await this.reviewPerm(actor);
    const rows = await this.repo.responses(surveyId);
    if (!rows) throw new NotFoundException('survey_not_found');
    return { items: rows.map((row) => {
      const { answers: _answers, ...item } = this.response(row, []);
      return { surveyId: row.surveyId, ...item };
    }) };
  }
  async responseDetail(actor: string, responseId: string) {
    await this.reviewPerm(actor);
    const row = await this.repo.response(responseId);
    if (!row) throw new NotFoundException('survey_response_not_found');
    return this.response(row, await this.repo.answers(row.id));
  }
  async review(actor: string, id: string, input: unknown, correlationId: string) {
    await this.reviewPerm(actor);
    if (!exact(input, ['state', 'reason']) || !['APPROVED', 'REJECTED', 'WAITLISTED'].includes(String(input.state))) {
      throw new UnprocessableEntityException('invalid_review');
    }
    const reason = input.reason;
    if (
      (input.state === 'REJECTED' && (typeof reason !== 'string' || reason.trim().length < 1 || reason.length > 500))
      || (input.state !== 'REJECTED' && reason !== undefined && reason !== null)
    ) {
      throw new UnprocessableEntityException('invalid_review');
    }
    const result = await this.repo.review(
      id,
      actor,
      input.state as 'APPROVED' | 'REJECTED' | 'WAITLISTED',
      input.state === 'REJECTED' ? (reason as string).trim() : null,
      correlationId,
    );
    if (!result) throw new NotFoundException('survey_response_not_found');
    if (result === 'INVALID') throw new UnprocessableEntityException('invalid_response_transition');
    return this.response(result, await this.repo.answers(result.id));
  }
  async aggregate(actor: string, id: string) {
    await this.reviewPerm(actor);
    const result = await this.repo.aggregate(id);
    if (!result) throw new NotFoundException('survey_not_found');
    const suppressed = result.count < 5;
    return {
      surveyId: id,
      responseCount: suppressed ? null : result.count,
      suppressed,
      questions: result.questions.map((question) => {
        const questionCount = result.questionCounts.get(question.id) ?? 0;
        const choices = result.choices.filter((choice) => choice.questionId === question.id);
        return {
          questionId: question.id,
          suppressed,
          responseCount: suppressed ? null : questionCount,
          choices: question.type.includes('CHOICE')
            ? choices.map((choice) => ({
                choiceOptionId: choice.id,
                count: suppressed ? null : (result.choiceCounts.get(choice.id) ?? 0),
              }))
            : [],
        };
      }),
    };
  }
  async export(actor: string, id: string, input: unknown, correlationId: string) {
    await this.reviewPerm(actor);
    if (!exact(input, ['format']) || input.format !== 'CSV') throw new UnprocessableEntityException('invalid_export');
    const recorded = await this.repo.export(id, actor, correlationId);
    if (!recorded) throw new NotFoundException('survey_not_found');
    if (recorded === 'INVALID') throw new UnprocessableEntityException('invalid_export_lifecycle');
    const data = await this.repo.exportRows(id);
    if (!data) throw new NotFoundException('survey_not_found');
    const escape = (raw: unknown) => {
      let value = raw === null || raw === undefined ? '' : String(raw);
      if (/^[=+\-@\t\r]/.test(value)) value = `'${value}`;
      return `"${value.replaceAll('"', '""')}"`;
    };
    const questions = data.detail.questions;
    const byResponse = new Map<string, Map<string, string>>();
    for (const answer of data.answers) {
      const rendered = answer.textValue ?? answer.numberValue ?? answer.dateValue
        ?? (answer.choiceOptionIds ? JSON.parse(answer.choiceOptionIds).join('|') : '');
      const values = byResponse.get(answer.responseId) ?? new Map<string, string>();
      values.set(answer.questionId, String(rendered));
      byResponse.set(answer.responseId, values);
    }
    const header = ['response_id', 'state', 'submitted_at', ...questions.map((question) => question.promptKr)];
    const lines = data.responses.map((row) => [
      row.id, row.state, row.submittedAt?.toISOString() ?? '',
      ...questions.map((question) => byResponse.get(row.id)?.get(question.id) ?? ''),
    ].map(escape).join(','));
    return { filename: `survey-${id}.csv`, csv: `\uFEFF${[header.map(escape).join(','), ...lines].join('\r\n')}\r\n` };
  }
  async related(query: Record<string, unknown>) {
    if (!exact(query, ['articleId', 'eventId', 'surveyId', 'locale'])) throw new UnprocessableEntityException('invalid_content_relation_query');
    const subject = {
      articleId: query.articleId as string | undefined,
      eventId: query.eventId as string | undefined,
      surveyId: query.surveyId as string | undefined,
    };
    if (Object.values(subject).filter((value) => value !== undefined).length !== 1
      || Object.values(subject).some((value) => value !== undefined && !uuid(value))
      || (query.locale !== undefined && query.locale !== 'ko' && query.locale !== 'en')) {
      throw new UnprocessableEntityException('invalid_content_relation_query');
    }
    return { items: await this.repo.related(subject, query.locale === 'en' ? 'en' : 'ko') };
  }
  async listMatchers(actor: string, query: Record<string, unknown>) {
    await this.manage(actor);
    if (!exact(query, ['articleId', 'eventId', 'surveyId'])) throw new UnprocessableEntityException('invalid_content_matcher_query');
    const subject = {
      articleId: query.articleId as string | undefined,
      eventId: query.eventId as string | undefined,
      surveyId: query.surveyId as string | undefined,
    };
    if (Object.values(subject).some((value) => value !== undefined && !uuid(value))) throw new UnprocessableEntityException('invalid_content_matcher_query');
    return { items: (await this.repo.listMatchers(subject)).map((row) => this.matcherDto(row)) };
  }
  async matcher(actor: string, input: unknown, correlationId: string) {
    await this.manage(actor);
    if (!exact(input, ['articleId', 'eventId', 'surveyId', 'relationType', 'syncMode'])) throw new UnprocessableEntityException('invalid_content_matcher');
    const articleId = input.articleId as string | undefined;
    const eventId = input.eventId as string | undefined;
    const surveyId = input.surveyId as string | undefined;
    const relationType = input.relationType;
    const syncMode = input.syncMode ?? 'NONE';
    if ([articleId, eventId, surveyId].filter(Boolean).length !== 2
      || [articleId, eventId, surveyId].some((value) => value !== undefined && !uuid(value))
      || !['ANNOUNCEMENT', 'SCHEDULE', 'SURVEY_PERIOD'].includes(relationType as string)
      || !['NONE', 'SURVEY_TO_EVENT'].includes(syncMode as string)
      || (relationType === 'ANNOUNCEMENT' && !articleId)
      || (relationType === 'SCHEDULE' && !(articleId && eventId && !surveyId))
      || (relationType === 'SURVEY_PERIOD' && !(eventId && surveyId && !articleId))
      || (syncMode === 'SURVEY_TO_EVENT' && relationType !== 'SURVEY_PERIOD')) {
      throw new UnprocessableEntityException('invalid_content_matcher');
    }
    const result = await this.repo.matcher({
      articleId,
      eventId,
      surveyId,
      relationType: relationType as 'ANNOUNCEMENT' | 'SCHEDULE' | 'SURVEY_PERIOD',
      syncMode: syncMode as 'NONE' | 'SURVEY_TO_EVENT',
      createdByUserId: actor,
      updatedByUserId: actor,
      synchronizedAt: syncMode === 'SURVEY_TO_EVENT' ? new Date() : null,
    }, correlationId);
    if (result === 'INVALID') throw new UnprocessableEntityException('invalid_content_matcher');
    if (result === 'MISSING') throw new NotFoundException('content_subject_not_found');
    if (result === 'DUPLICATE') throw new ConflictException('content_matcher_exists');
    return this.matcherDto(result);
  }
  async deleteMatcher(actor: string, id: string, correlationId: string) { await this.manage(actor); if (!(await this.repo.deleteMatcher(id, actor, correlationId))) throw new NotFoundException('content_matcher_not_found'); }
  private matcherDto(row: typeof contentMatchers.$inferSelect) {
    return {
      id: row.id,
      articleId: row.articleId,
      eventId: row.eventId,
      surveyId: row.surveyId,
      relationType: row.relationType,
      syncMode: row.syncMode,
      createdByUserId: row.createdByUserId,
      createdAt: row.createdAt.toISOString(),
      updatedByUserId: row.updatedByUserId,
      updatedAt: row.updatedAt.toISOString(),
      synchronizedAt: row.synchronizedAt?.toISOString() ?? null,
    };
  }
  async purge(limit: number, correlationId: string) { return this.repo.purgeExpired(limit, correlationId); }
  private async admin(id: string) {
    const detail = await this.repo.detail(id);
    if (!detail) throw new NotFoundException('survey_not_found');
    return this.publicDto(detail, 'ko');
  }
  private async manage(id: string) { if (!await this.permissions.hasPermission(id, 'SURVEY_MANAGE', 'GLOBAL')) throw new ForbiddenException('insufficient_permission'); }
  private async reviewPerm(id: string) { if (!await this.permissions.hasPermission(id, 'SURVEY_REVIEW', 'GLOBAL')) throw new ForbiddenException('insufficient_permission'); }
  private settings(input: unknown, required: boolean): Partial<typeof surveys.$inferInsert> {
    if (!own(input) || (required && !this.localized(input.title))) {
      throw new UnprocessableEntityException('invalid_survey');
    }
    const allowed = ['title', 'description', 'guestAllowed', 'phoneRequired', 'feeRestriction', 'cap', 'opensAt', 'closesAt', 'editDeadlineAt', 'responseRetentionDays'];
    if (!exact(input, allowed)) throw new UnprocessableEntityException('invalid_survey');
    if (required && (
      !Object.hasOwn(input, 'guestAllowed')
      || !Object.hasOwn(input, 'phoneRequired')
      || !Object.hasOwn(input, 'feeRestriction')
      || !Object.hasOwn(input, 'responseRetentionDays')
    )) throw new UnprocessableEntityException('invalid_survey');
    if (!required && input.title !== undefined && !this.localized(input.title)) {
      throw new UnprocessableEntityException('invalid_survey');
    }
    if (input.description !== undefined && input.description !== null && !this.localized(input.description)) {
      throw new UnprocessableEntityException('invalid_survey');
    }

    const value: Partial<typeof surveys.$inferInsert> = {};
    if (input.guestAllowed !== undefined) {
      if (typeof input.guestAllowed !== 'boolean') throw new UnprocessableEntityException('invalid_survey');
      value.guestAllowed = input.guestAllowed;
    }
    if (input.phoneRequired !== undefined) {
      if (typeof input.phoneRequired !== 'boolean') throw new UnprocessableEntityException('invalid_survey');
      value.phoneRequired = input.phoneRequired;
    }
    if (required && input.phoneRequired === true && input.guestAllowed !== true) {
      throw new UnprocessableEntityException('invalid_survey');
    }
    if (input.feeRestriction !== undefined) {
      if (input.feeRestriction !== 'ANY' && input.feeRestriction !== 'PAID_ONLY') {
        throw new UnprocessableEntityException('invalid_survey');
      }
      value.feeRestriction = input.feeRestriction;
    }
    if (input.cap !== undefined) {
      const cap = input.cap;
      if (cap !== null && (typeof cap !== 'number' || !Number.isInteger(cap) || cap <= 0)) {
        throw new UnprocessableEntityException('invalid_survey');
      }
      value.cap = cap as number | null;
    }
    if (input.responseRetentionDays !== undefined) {
      const retentionDays = input.responseRetentionDays;
      if (typeof retentionDays !== 'number' || !Number.isInteger(retentionDays) || retentionDays < 1 || retentionDays > 3650) {
        throw new UnprocessableEntityException('invalid_survey');
      }
      value.responseRetentionDays = retentionDays;
    } else if (required) {
      throw new UnprocessableEntityException('invalid_survey');
    }
    for (const key of ['opensAt', 'closesAt', 'editDeadlineAt'] as const) {
      const raw = input[key];
      if (raw === undefined) continue;
      if (raw === null) value[key] = null;
      else if (typeof raw === 'string' && strictInstant(raw)) value[key] = new Date(raw);
      else throw new UnprocessableEntityException('invalid_survey');
    }
    if (
      required
      && (
        (value.opensAt && value.closesAt && value.opensAt >= value.closesAt)
        || (value.editDeadlineAt && value.closesAt && value.editDeadlineAt > value.closesAt)
      )
    ) {
      throw new UnprocessableEntityException('invalid_survey');
    }
    return value;
  }
  private localized(value: unknown): { kr: string; en: string } | null { return exact(value, ['kr', 'en']) && typeof value.kr === 'string' && value.kr.trim() && value.kr.length <= MAX_LOCALIZED_TEXT && typeof value.en === 'string' && value.en.trim() && value.en.length <= MAX_LOCALIZED_TEXT ? { kr: value.kr, en: value.en } : null; }
  private hmacKey(value: unknown): Buffer | null {
    if (typeof value !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) return null;
    const key = Buffer.from(value, 'base64');
    return key.length === 32 && key.toString('base64') === value ? key : null;
  }
  private priorHmacKeys(): Map<string, Buffer> | null {
    const raw = this.config.get<unknown>('SURVEY_PHONE_HASH_HMAC_PRIOR_KEYS_JSON');
    if (raw === undefined) return new Map();
    if (typeof raw !== 'string') return null;
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!own(parsed)) return null;
      const keys = new Map<string, Buffer>();
      for (const [version, encoded] of Object.entries(parsed)) {
        const key = this.hmacKey(encoded);
        if (!/^[A-Za-z0-9._-]{1,64}$/.test(version) || !key || keys.has(version)) return null;
        keys.set(version, key);
      }
      return keys;
    } catch { return null; }
  }
  private question(value: unknown) {
    if (!own(value) || !exact(value, ['ordinal', 'type', 'prompt', 'helpText', 'required', 'validationRegex', 'numberMin', 'numberMax', 'dateMin', 'dateMax', 'choices'])) {
      throw new UnprocessableEntityException('invalid_question');
    }
    const ordinal = value.ordinal;
    if (
      typeof ordinal !== 'number'
      || !Number.isInteger(ordinal)
      || ordinal < 0
      || !TYPES.has(String(value.type))
      || !this.localized(value.prompt)
      || typeof value.required !== 'boolean'
    ) {
      throw new UnprocessableEntityException('invalid_question');
    }
    if (value.helpText !== undefined && value.helpText !== null && !this.localized(value.helpText)) {
      throw new UnprocessableEntityException('invalid_question');
    }

    const type = String(value.type);
    const isText = type === 'SHORT_TEXT' || type === 'LONG_TEXT';
    const isNumber = type === 'NUMBER';
    const isDate = type === 'DATE';
    const isChoice = type === 'SINGLE_CHOICE' || type === 'MULTIPLE_CHOICE';
    const hasNumberBounds = Object.hasOwn(value, 'numberMin') || Object.hasOwn(value, 'numberMax');
    const hasDateBounds = Object.hasOwn(value, 'dateMin') || Object.hasOwn(value, 'dateMax');
    const hasRegex = Object.hasOwn(value, 'validationRegex');
    const hasChoices = Object.hasOwn(value, 'choices');

    if (
      (isText && (hasNumberBounds || hasDateBounds || hasChoices))
      || (isNumber && (hasRegex || hasDateBounds || hasChoices))
      || (isDate && (hasRegex || hasNumberBounds || hasChoices))
      || (isChoice && (hasRegex || hasNumberBounds || hasDateBounds))
      || (!isText && !isNumber && !isDate && !isChoice)
    ) {
      throw new UnprocessableEntityException('invalid_question');
    }
    if (hasRegex && value.validationRegex != null && !parseRestrictedCharacterPattern(value.validationRegex)) {
      throw new UnprocessableEntityException('invalid_question');
    }
    if (isNumber) {
      const minimum = value.numberMin;
      const maximum = value.numberMax;
      if (
        (minimum !== undefined && minimum !== null && (typeof minimum !== 'number' || !Number.isInteger(minimum)))
        || (maximum !== undefined && maximum !== null && (typeof maximum !== 'number' || !Number.isInteger(maximum)))
        || (typeof minimum === 'number' && typeof maximum === 'number' && minimum > maximum)
      ) {
        throw new UnprocessableEntityException('invalid_question');
      }
    }
    if (isDate) {
      const minimum = value.dateMin;
      const maximum = value.dateMax;
      if (
        (minimum !== undefined && minimum !== null && (typeof minimum !== 'string' || !isIsoDate(minimum)))
        || (maximum !== undefined && maximum !== null && (typeof maximum !== 'string' || !isIsoDate(maximum)))
        || (typeof minimum === 'string' && typeof maximum === 'string' && minimum > maximum)
      ) {
        throw new UnprocessableEntityException('invalid_question');
      }
    }
    if (isChoice !== hasChoices || (hasChoices && !Array.isArray(value.choices))) {
      throw new UnprocessableEntityException('invalid_question');
    }
    if (Array.isArray(value.choices)) {
      if (value.choices.length > MAX_CHOICES) throw new UnprocessableEntityException('invalid_question');
      if (
        !value.choices.length
        || value.choices.some((choice, index) => {
          if (!exact(choice, ['ordinal', 'value'])) return true;
          const choiceOrdinal = choice.ordinal;
          return typeof choiceOrdinal !== 'number'
            || !Number.isInteger(choiceOrdinal)
            || choiceOrdinal !== index
            || !this.localized(choice.value);
        })
        || !unique(value.choices.map((choice) => String((choice as Record<string, unknown>).ordinal)))
      ) {
        throw new UnprocessableEntityException('invalid_question');
      }
    }
  }
  private phone(value: string) {
    const canonical = value.replace(/[\s()-]/g, '');
    if (!/^\+[1-9]\d{7,14}$/.test(canonical)) {
      throw new UnprocessableEntityException('invalid_guest_phone');
    }
    return canonical;
  }
  private publicDto(detail: { survey: Record<string, unknown>; revision: Record<string, unknown>; sections: Record<string, unknown>[]; questions: Record<string, unknown>[]; choices: Record<string, unknown>[] }, locale: ContentLocale) {
    const localized = (kr: unknown, en: unknown) => {
      const primary = locale === 'ko' ? kr : en;
      if (typeof primary === 'string' && primary.trim().length > 0) {
        return { value: primary, translationUnavailable: false };
      }
      const fallback = locale === 'ko' ? en : kr;
      if (typeof fallback === 'string' && fallback.trim().length > 0) {
        return { value: fallback, translationUnavailable: true };
      }
      throw new Error('survey_translation_invariant');
    };
    const survey = detail.survey;
    return {
      id: survey.id,
      revision: survey.currentRevision,
      locale,
      title: localized(detail.revision.titleKr, detail.revision.titleEn),
      description: detail.revision.descriptionKr === null && detail.revision.descriptionEn === null ? null : localized(detail.revision.descriptionKr, detail.revision.descriptionEn),
      state: surveyState(survey as never, new Date()),
      guestAllowed: survey.guestAllowed,
      phoneRequired: survey.phoneRequired,
      feeRestriction: survey.feeRestriction,
      cap: survey.cap,
      opensAt: date(survey.opensAt),
      closesAt: date(survey.closesAt),
      editDeadlineAt: date(survey.editDeadlineAt),
      responseRetentionDays: survey.responseRetentionDays,
      sections: detail.sections.map((section) => ({
        id: section.id, ordinal: section.ordinal, title: localized(section.titleKr, section.titleEn),
        description: section.descriptionKr == null && section.descriptionEn == null ? null : localized(section.descriptionKr, section.descriptionEn),
        questions: detail.questions.filter((question) => question.sectionId === section.id).map((question) => ({
          id: question.id, ordinal: question.ordinal, type: question.type,
          prompt: localized(question.promptKr, question.promptEn),
          helpText: question.helpTextKr === null && question.helpTextEn === null ? null : localized(question.helpTextKr, question.helpTextEn),
          required: question.required, validationRegex: question.validationRegex ?? null,
          numberMin: question.numberMin ?? null, numberMax: question.numberMax ?? null,
          dateMin: question.dateMin ?? null, dateMax: question.dateMax ?? null,
          choices: detail.choices.filter((choice) => choice.questionId === question.id).map((choice) => ({
            id: choice.id, ordinal: choice.ordinal, value: localized(choice.valueKr, choice.valueEn),
          })),
        })),
      })),
      updatedAt: date(survey.updatedAt),
    };
  }
  private response(response: Record<string, unknown>, answers: Record<string, unknown>[]) { const submittedAt = date(response.submittedAt); return { id: response.id, state: response.state, answers: answers.map((answer) => ({ questionId: answer.questionId, submittedAt: submittedAt ?? undefined, textValue: answer.textValue ?? undefined, numberValue: answer.numberValue ?? undefined, dateValue: answer.dateValue ?? undefined, choiceOptionIds: answer.choiceOptionIds ? choiceIds(answer.choiceOptionIds) : undefined })), submittedAt, reviewedAt: date(response.reviewedAt), reviewReason: response.reviewReason ?? null, phonePresent: !!response.guestPhoneCiphertext, maskedPhone: response.guestPhoneCiphertext ? '***' : null }; }
}
const unique = (values: string[]) => new Set(values).size === values.length;
const date = (value: unknown) => value instanceof Date ? value.toISOString() : null;
const strictInstant = (value: string): boolean => {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?(Z|[+-](\d{2}):(\d{2}))$/.exec(value);
  if (!match) return false;
  const [, year, month, day, hour, minute, second, , zone, zoneHour, zoneMinute] = match;
  const values = [year, month, day, hour, minute, second].map(Number);
  if (values[1]! < 1 || values[1]! > 12 || values[2]! < 1 || values[2]! > 31 || values[3]! > 23 || values[4]! > 59 || values[5]! > 59) return false;
  if (zone !== 'Z' && (Number(zoneHour) > 23 || Number(zoneMinute) > 59)) return false;
  const calendar = new Date(Date.UTC(values[0]!, values[1]! - 1, values[2]!));
  return calendar.getUTCFullYear() === values[0] && calendar.getUTCMonth() === values[1]! - 1 && calendar.getUTCDate() === values[2]! && Number.isFinite(new Date(value).getTime());
};
const isIsoDate = (value: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};
const choiceIds = (value: unknown): string[] => {
  try {
    const parsed: unknown = JSON.parse(String(value));
    if (Array.isArray(parsed) && parsed.every((id) => typeof id === 'string')) return parsed;
  } catch { /* converted below */ }
  throw new Error('malformed_persisted_choice_json');
};
