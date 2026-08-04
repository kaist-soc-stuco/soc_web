import { createHmac } from 'node:crypto';
import { canonicalJson, canonicalSurveyDefinition, parseInventoryReport, sha256Canonical, SURVEY_DEFINITION_CANONICAL_SERIALIZER, SURVEY_DEFINITION_INVENTORY_SCHEMA } from './survey-definition-canonical';
import { ConflictException, ForbiddenException, Inject, Injectable, NotFoundException, PayloadTooLargeException, ServiceUnavailableException, UnprocessableEntityException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PiiCipherService } from '../../shared/security/pii-cipher.service';
import { PermissionsService } from '../permissions/permissions.service';
import { SurveysRepository, type SurveyImageMembershipMutationMembership, parseRestrictedCharacterPattern, surveyState } from './surveys.repository';
import { contentMatchers, surveys } from '../../infrastructure/postgres/postgres.schema';
import type { AdminSurveyResponseDetail, ContentLocale, SurveyImageBlockMembershipDto, SurveyImageBlockMutationResponse } from '@soc/contracts';

const TYPES = new Set(['SHORT_TEXT', 'LONG_TEXT', 'SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'NUMBER', 'DATE']);
const MAX_SECTIONS = 100;
const MAX_QUESTIONS = 100;
const MAX_CHOICES = 100;
const MAX_ANSWERS = 100;
const MAX_IMAGE_MEMBERSHIP_PAGE_SIZE = 100;
const MAX_LOCALIZED_TEXT = 4_000;
const own = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
const exact = (value: unknown, keys: string[]): value is Record<string, unknown> => own(value) && Object.keys(value).every((key) => keys.includes(key));
const uuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
export const surveyImageProviderDownloadPath = (objectKey: string): string => `/uploads/${encodeURIComponent(objectKey)}`;
const MAX_SURVEY_IMAGE_BYTES = 20 * 1024 * 1024;
@Injectable()
export class SurveysService {
  constructor(@Inject(SurveysRepository) private readonly repo: SurveysRepository, @Inject(PermissionsService) private readonly permissions: PermissionsService, private readonly cipher: PiiCipherService, private readonly config: ConfigService) {}
  async list(_actor: string | undefined, locale: ContentLocale) {
    const details = await this.repo.listPublic();
    return { locale, items: details.map((detail) => this.publicDto(detail, locale)) };
  }
  async listManaged(actor: string, locale: ContentLocale) {
    await this.manage(actor);
    const details = await this.repo.listAll();
    return { locale, items: details.map((detail) => this.publicDto(detail, locale)) };
  }
  async reviewQueue(actor: string, locale: ContentLocale) {
    await this.reviewPerm(actor);
    return {
      items: (await this.repo.reviewQueue()).map((row) => ({
        surveyId: row.surveyId,
        title: this.localizedDto(row.titleKr, row.titleEn, locale),
        state: row.state,
        responseCount: row.responseCount,
        latestResponseAt: row.latestResponseAt?.toISOString() ?? null,
      })),
    };
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
  async publicImage(surveyId: string, imageId: string) {
    if (!uuid(surveyId) || !uuid(imageId)) throw new NotFoundException('survey_not_found');
    const asset = await this.repo.publicSurveyImageAsset(surveyId, imageId);
    if (!asset || !['SCHEDULED', 'OPEN', 'CLOSED'].includes(surveyState(asset.survey as never, new Date()))) {
      throw new NotFoundException('survey_not_found');
    }
    const configuration = this.assetConfiguration();
    try {
      const provider = await fetch(`${configuration.url}${surveyImageProviderDownloadPath(asset.image.objectKey)}`, {
        headers: { authorization: `Bearer ${configuration.token}` },
        redirect: 'error',
        signal: AbortSignal.timeout(30_000),
      });
      const contentType = provider.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase();
      const contentLength = Number(provider.headers.get('content-length'));
      if (
        provider.status !== 200
        || !provider.body
        || contentType !== asset.image.contentType.toLowerCase()
        || !Number.isSafeInteger(contentLength)
        || contentLength < 1
        || contentLength !== asset.image.byteSize
        || contentLength > MAX_SURVEY_IMAGE_BYTES
      ) {
        throw new Error('asset_provider_download_invalid');
      }
      return { body: provider.body, contentType, contentLength };
    } catch {
      throw new ServiceUnavailableException('asset_provider_unavailable');
    }
  }
  async imageMembershipPage(actor: string | undefined, surveyId: string, blockId: string, input: unknown, requestedLocale: ContentLocale = 'ko') {
    if (actor) await this.manage(actor);
    if (!uuid(surveyId) || !uuid(blockId) || !own(input) || !exact(input, ['set', 'limit', 'cursor']) || !['SHARED', 'KO', 'EN'].includes(String(input.set))) throw new UnprocessableEntityException('invalid_image_membership_page');
    const limit = input.limit === undefined ? 25 : input.limit; if (typeof limit !== 'number' || !Number.isInteger(limit) || limit < 1 || limit > MAX_IMAGE_MEMBERSHIP_PAGE_SIZE) throw new UnprocessableEntityException('invalid_image_membership_page');
    let after: { orderKey: number; id: string } | null = null; if (input.cursor !== undefined) { if (typeof input.cursor !== 'string') throw new UnprocessableEntityException('invalid_image_membership_page'); try { const value = JSON.parse(Buffer.from(input.cursor, 'base64url').toString('utf8')); if (!own(value) || value.surveyId !== surveyId || value.blockId !== blockId || value.set !== input.set || value.definitionVersion === undefined || !Number.isInteger(value.orderKey) || !uuid(value.id)) throw new Error(); after = { orderKey: value.orderKey as number, id: value.id as string }; } catch { throw new UnprocessableEntityException('invalid_image_membership_page'); } }
    const page = await this.repo.imageMembershipPage(surveyId, blockId, input.set as 'SHARED' | 'KO' | 'EN', limit, after); if (!page) throw new NotFoundException('survey_not_found'); if (input.cursor) { const parsed = JSON.parse(Buffer.from(input.cursor as string, 'base64url').toString('utf8')) as { definitionVersion: number }; if (parsed.definitionVersion !== page.survey.definitionVersion) throw new ConflictException('stale_definition'); } const visible = Boolean(actor) || ['SCHEDULED', 'OPEN', 'CLOSED'].includes(surveyState(page.survey as never, new Date())); if (!visible) throw new NotFoundException('survey_not_found'); const rows = page.rows.slice(0, limit); const last = rows.at(-1)?.membership; return { requestedLocale, effectiveContentLocale: page.survey.onlyForKoreanSpeaker && requestedLocale === 'en' ? 'ko' as const : requestedLocale, items: rows.map(({ membership, image }) => ({ id: membership.id, asset: { id: image.id, src: `/api/surveys/${surveyId}/images/${image.id}`, contentType: image.contentType, byteSize: image.byteSize, width: image.width!, height: image.height! } })), nextCursor: page.rows.length > limit && last ? Buffer.from(JSON.stringify({ surveyId, blockId, set: input.set, definitionVersion: page.survey.definitionVersion, orderKey: last.orderKey, id: last.id })).toString('base64url') : null, membershipCount: page.membershipCount, definitionVersion: page.survey.definitionVersion };
  }
  async addImageMembership(actor: string, surveyId: string, blockId: string, input: unknown, correlationId: string): Promise<SurveyImageBlockMutationResponse> {
    await this.manage(actor); if (!uuid(surveyId) || !uuid(blockId) || !own(input) || !exact(input, ['expectedDefinitionVersion', 'clientMutationId', 'set', 'assetId', 'afterMembershipId']) || typeof input.expectedDefinitionVersion !== 'number' || !Number.isSafeInteger(input.expectedDefinitionVersion) || !uuid(input.clientMutationId) || !['SHARED', 'KO', 'EN'].includes(String(input.set)) || !uuid(input.assetId) || (input.afterMembershipId !== undefined && input.afterMembershipId !== null && !uuid(input.afterMembershipId))) throw new UnprocessableEntityException('invalid_image_membership');
    const result = await this.repo.mutateImageMembership(surveyId, actor, input.expectedDefinitionVersion, input.clientMutationId, blockId, { type: 'ADD', set: input.set as 'SHARED' | 'KO' | 'EN', assetId: input.assetId as string, afterId: (input.afterMembershipId as string | null | undefined) ?? null }, correlationId); if (typeof result === 'string') { if (result === 'MISSING') throw new NotFoundException('survey_not_found'); if (result === 'STALE') throw new ConflictException('stale_definition'); if (result === 'IDEMPOTENCY_MISMATCH') throw new ConflictException('idempotency_mismatch'); if (result === 'INVALID_NEIGHBOR') throw new UnprocessableEntityException('invalid_image_membership_neighbor'); throw new UnprocessableEntityException('invalid_image_membership'); } return { definitionVersion: result.definitionVersion, membership: await this.membershipDto(surveyId, result.membership), membershipCount: result.membershipCount };
  }
  async removeImageMembership(actor: string, surveyId: string, blockId: string, membershipId: string, input: unknown, correlationId: string): Promise<SurveyImageBlockMutationResponse> {
    await this.manage(actor); if (!uuid(surveyId) || !uuid(blockId) || !uuid(membershipId) || !own(input) || !exact(input, ['expectedDefinitionVersion', 'clientMutationId']) || typeof input.expectedDefinitionVersion !== 'number' || !Number.isSafeInteger(input.expectedDefinitionVersion) || !uuid(input.clientMutationId)) throw new UnprocessableEntityException('invalid_image_membership');
    const result = await this.repo.mutateImageMembership(surveyId, actor, input.expectedDefinitionVersion, input.clientMutationId, blockId, { type: 'REMOVE', membershipId }, correlationId); if (typeof result === 'string') { if (result === 'MISSING') throw new NotFoundException('survey_not_found'); if (result === 'STALE') throw new ConflictException('stale_definition'); if (result === 'IDEMPOTENCY_MISMATCH') throw new ConflictException('idempotency_mismatch'); if (result === 'INVALID_NEIGHBOR') throw new UnprocessableEntityException('invalid_image_membership_neighbor'); throw new UnprocessableEntityException('invalid_image_membership'); } return { definitionVersion: result.definitionVersion, membership: null, membershipCount: result.membershipCount };
  }
  async moveImageMembership(actor: string, surveyId: string, blockId: string, membershipId: string, input: unknown, correlationId: string): Promise<SurveyImageBlockMutationResponse> {
    await this.manage(actor); if (!uuid(surveyId) || !uuid(blockId) || !uuid(membershipId) || !own(input) || !exact(input, ['expectedDefinitionVersion', 'clientMutationId', 'afterMembershipId']) || typeof input.expectedDefinitionVersion !== 'number' || !Number.isSafeInteger(input.expectedDefinitionVersion) || !uuid(input.clientMutationId) || (input.afterMembershipId !== undefined && input.afterMembershipId !== null && !uuid(input.afterMembershipId))) throw new UnprocessableEntityException('invalid_image_membership'); const result = await this.repo.mutateImageMembership(surveyId, actor, input.expectedDefinitionVersion, input.clientMutationId, blockId, { type: 'MOVE', membershipId, afterId: (input.afterMembershipId as string | null | undefined) ?? null }, correlationId); if (typeof result === 'string') { if (result === 'MISSING') throw new NotFoundException('survey_not_found'); if (result === 'STALE') throw new ConflictException('stale_definition'); if (result === 'IDEMPOTENCY_MISMATCH') throw new ConflictException('idempotency_mismatch'); if (result === 'INVALID_NEIGHBOR') throw new UnprocessableEntityException('invalid_image_membership_neighbor'); throw new UnprocessableEntityException('invalid_image_membership'); } return { definitionVersion: result.definitionVersion, membership: await this.membershipDto(surveyId, result.membership), membershipCount: result.membershipCount };
  }
  async changeImageBlockMode(actor: string, surveyId: string, blockId: string, input: unknown, correlationId: string) {
    await this.manage(actor); if (!uuid(surveyId) || !uuid(blockId) || !own(input) || !exact(input, ['expectedDefinitionVersion', 'clientMutationId', 'mode', 'retainSet']) || typeof input.expectedDefinitionVersion !== 'number' || !Number.isSafeInteger(input.expectedDefinitionVersion) || !uuid(input.clientMutationId) || (input.mode !== 'SHARED' && input.mode !== 'LOCALIZED') || (input.retainSet !== undefined && input.retainSet !== 'KO' && input.retainSet !== 'EN')) throw new UnprocessableEntityException('invalid_image_block_mode'); const result = await this.repo.changeImageBlockMode(surveyId, actor, input.expectedDefinitionVersion, input.clientMutationId, blockId, input.mode, input.retainSet as 'KO' | 'EN' | undefined, correlationId); if (typeof result === 'string') { if (result === 'MISSING') throw new NotFoundException('survey_not_found'); if (result === 'STALE') throw new ConflictException('stale_definition'); if (result === 'IDEMPOTENCY_MISMATCH') throw new ConflictException('idempotency_mismatch'); throw new UnprocessableEntityException('invalid_image_block_mode'); } return { definitionVersion: result.definitionVersion, mode: result.mode, membershipCounts: result.membershipCounts };
  }
  private async membershipDto(surveyId: string, membership: SurveyImageMembershipMutationMembership | null): Promise<SurveyImageBlockMembershipDto | null> {
    if (!membership) return null;
    const asset = await this.repo.surveyImageAsset(membership.assetId);
    if (!asset || asset.status !== 'COMPLETED' || asset.deletedAt !== null || typeof asset.width !== 'number' || !Number.isInteger(asset.width) || typeof asset.height !== 'number' || !Number.isInteger(asset.height)) {
      throw new Error('survey_image_membership_asset_invariant');
    }
    return {
      id: membership.id,
      asset: {
        id: asset.id,
        src: `/api/surveys/${surveyId}/images/${asset.id}`,
        contentType: asset.contentType,
        byteSize: asset.byteSize,
        width: asset.width,
        height: asset.height,
      },
    };
  }
  async cleanupSurveyImages(now = new Date(), graceMs = 3_600_000, limit = 25) {
    const claimResult = await this.repo.claimImageCleanupCandidates(now, graceMs, limit);
    const claims = claimResult.claims;
    if (!claims.length) return { claimed: 0, deleted: 0, retried: 0, exhausted: claimResult.exhaustedAssetIds.length };
    const configuration = this.assetConfiguration();
    let deleted = 0;
    let retried = 0;
    for (const claim of claims) {
      const prepared = await this.repo.beginImageCleanupDeletion(claim.asset.id, claim.claimToken, now);
      if (!prepared) continue;
      try {
        const response = await fetch(`${configuration.url}/uploads/${encodeURIComponent(prepared.objectKey)}`, { method: 'DELETE', headers: { authorization: `Bearer ${configuration.token}` }, signal: AbortSignal.timeout(30_000) });
        if (!response.ok && response.status !== 404) throw new Error(`provider_${response.status}`);
        if (await this.repo.completeImageCleanupClaim(prepared.id, claim.claimToken, now)) deleted += 1;
      } catch {
        await this.repo.completeImageCleanupClaim(prepared.id, claim.claimToken, now, 'provider_delete_failed');
        retried += 1;
      }
    }
    return { claimed: claims.length, deleted, retried, exhausted: claimResult.exhaustedAssetIds.length };
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
    return this.publicDto({ ...created, sections: [], questions: [], choices: [], items: [], descriptionItems: [], imageBlocks: [] }, 'ko');
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
      body.expectedDefinitionVersion as number | undefined,
      correlationId,
    );
    if (!result) throw new NotFoundException('survey_not_found');
    if (result === 'IMMUTABLE') throw new UnprocessableEntityException('survey_immutable');
    if (result === 'STALE') throw new ConflictException('stale_definition');
    if (result === 'INVALID_SETTINGS') throw new UnprocessableEntityException('invalid_survey');
    if (result === 'INVALID_LOCALIZED_CONTENT') throw new UnprocessableEntityException('korean_only_localized_content_mismatch');
    return this.admin(id);
  }
  async publish(actor: string, id: string, correlationId: string) { await this.manage(actor); const result = await this.repo.publish(id, actor, new Date(), correlationId); if (!result) throw new NotFoundException('survey_not_found'); if (result === 'IMMUTABLE') throw new UnprocessableEntityException('survey_immutable'); if (result === 'INVALID_SETTINGS') throw new UnprocessableEntityException('invalid_survey'); if (result === 'INCOMPLETE_ASSET') throw new UnprocessableEntityException('incomplete_image_asset'); return { survey: await this.admin(id) }; }
  async initiateImageAssetV2(actor: string, input: unknown) {
    await this.manage(actor);
    if (!exact(input, ['contentType', 'byteSize', 'checksumSha256']) || typeof input.contentType !== 'string' || !/^image\/(png|jpeg|webp|gif|avif)$/i.test(input.contentType) || typeof input.byteSize !== 'number' || !Number.isSafeInteger(input.byteSize) || input.byteSize < 1 || input.byteSize > 20 * 1024 * 1024 || typeof input.checksumSha256 !== 'string' || !/^[a-f0-9]{64}$/i.test(input.checksumSha256)) throw new UnprocessableEntityException('invalid_image_asset');
    const configuration = this.assetConfiguration();
    try {
      const response = await fetch(`${configuration.url}/uploads/initiate`, { method: 'POST', headers: { authorization: `Bearer ${configuration.token}`, 'content-type': 'application/json' }, body: JSON.stringify({ scope: 'survey-image', contentType: input.contentType, byteSize: input.byteSize, checksumSha256: input.checksumSha256 }), signal: AbortSignal.timeout(10_000) });
      const provider: unknown = response.ok ? await response.json() : null;
      const objectKey = (provider as { objectKey?: unknown })?.objectKey;
      const uploadUrl = (provider as { uploadUrl?: unknown })?.uploadUrl;
      const uploadHeaders = (provider as { uploadHeaders?: unknown })?.uploadHeaders;
      if (typeof objectKey !== 'string' || typeof uploadUrl !== 'string' || !own(uploadHeaders) || !Object.values(uploadHeaders).every((value) => typeof value === 'string')) throw new Error();
      const image = await this.repo.createSurveyImageAsset({ ownerUserId: actor, provider: 'http', objectKey, contentType: input.contentType, byteSize: input.byteSize, checksumSha256: input.checksumSha256.toLowerCase() });
      return { image: { id: image.id, contentType: image.contentType, byteSize: image.byteSize, width: null, height: null, status: image.status }, uploadUrl, uploadHeaders: uploadHeaders as Record<string, string> };
    } catch { throw new ServiceUnavailableException('asset_provider_unavailable'); }
  }
  async completeImageAssetV2(actor: string, imageId: string, input: unknown) {
    await this.manage(actor);
    if (!uuid(imageId) || !exact(input, ['checksumSha256']) || typeof input.checksumSha256 !== 'string' || !/^[a-f0-9]{64}$/i.test(input.checksumSha256)) throw new UnprocessableEntityException('invalid_image_asset');
    const image = await this.repo.surveyImageAsset(imageId);
    if (!image) throw new NotFoundException('image_asset_not_found');
    if (image.ownerUserId !== actor) throw new ForbiddenException('insufficient_permission');
    if (image.status !== 'INITIATED') throw new ConflictException('image_asset_not_initiated');
    const configuration = this.assetConfiguration();
    try {
      const response = await fetch(`${configuration.url}/uploads/${encodeURIComponent(image.objectKey)}/complete`, { method: 'POST', headers: { authorization: `Bearer ${configuration.token}`, 'content-type': 'application/json' }, body: JSON.stringify({ checksumSha256: input.checksumSha256 }), signal: AbortSignal.timeout(30_000) });
      const payload: unknown = response.ok ? await response.json() : null;
      const width = (payload as { width?: unknown })?.width;
      const height = (payload as { height?: unknown })?.height;
      const checksum = (payload as { checksumSha256?: unknown })?.checksumSha256;
      if (!response.ok || (payload as { clean?: unknown })?.clean !== true || typeof width !== 'number' || typeof height !== 'number' || !Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1 || checksum !== input.checksumSha256.toLowerCase()) throw new Error();
      const completed = await this.repo.completeSurveyImageAsset(imageId, checksum, width, height, new Date());
      if (!completed) throw new ConflictException('image_asset_not_initiated');
      return { id: completed.id, contentType: completed.contentType, byteSize: completed.byteSize, width: completed.width, height: completed.height, status: completed.status };
    } catch (error) { if (error instanceof ConflictException) throw error; throw new ServiceUnavailableException('asset_provider_unavailable'); }
  }
  async definition(actor: string, id: string, input: unknown, correlationId: string) {
    await this.manage(actor);
    this.requireDefinitionCapacityApproval();
    if (!exact(input, ['expectedDefinitionVersion', 'sections']) || typeof input.expectedDefinitionVersion !== 'number' || !Number.isSafeInteger(input.expectedDefinitionVersion) || input.expectedDefinitionVersion < 1 || !Array.isArray(input.sections) || input.sections.length > MAX_SECTIONS) {
      throw new UnprocessableEntityException('invalid_definition');
    }
    const definitionBytes = Buffer.byteLength(canonicalJson(canonicalSurveyDefinition(input)), 'utf8');
    const definitionMaxBytes = this.config.get<number>('SURVEY_DEFINITION_MAX_BYTES') ?? 262_144;
    if (definitionBytes > definitionMaxBytes) {
      throw new PayloadTooLargeException('payload_too_large');
    }
    for (const [sectionIndex, section] of input.sections.entries()) {
      if (!exact(section, ['id', 'ordinal', 'title', 'items']) && !exact(section, ['ordinal', 'title', 'items']) || section.ordinal !== sectionIndex || !this.localized(section.title) || !Array.isArray(section.items) || section.items.length > MAX_QUESTIONS) throw new UnprocessableEntityException('invalid_definition');
      for (const [itemIndex, item] of section.items.entries()) {
        if (!own(item) || item.ordinal !== itemIndex || (item.id !== undefined && !uuid(item.id))) throw new UnprocessableEntityException('invalid_definition');
        if (item.kind === 'QUESTION' && (exact(item, ['id', 'ordinal', 'kind', 'question']) || exact(item, ['ordinal', 'kind', 'question'])) && item.question) this.question(item.question);
        else if (item.kind === 'DESCRIPTION' && (exact(item, ['id', 'ordinal', 'kind', 'body']) || exact(item, ['ordinal', 'kind', 'body'])) && this.localized(item.body)) continue;
        else if (item.kind === 'IMAGE_BLOCK' && (exact(item, ['id', 'ordinal', 'kind', 'mode']) || exact(item, ['ordinal', 'kind', 'mode'])) && (item.mode === 'SHARED' || item.mode === 'LOCALIZED')) continue;
        else throw new UnprocessableEntityException('invalid_definition');
      }
    }
    const result = await this.repo.replaceDefinition(id, actor, input.expectedDefinitionVersion, input.sections as never[], correlationId);
    if (result === 'MISSING') throw new NotFoundException('survey_not_found');
    if (result === 'IMMUTABLE') throw new UnprocessableEntityException('survey_immutable');
    if (result === 'STALE') throw new ConflictException('stale_definition');
    if (result === 'INVALID_ITEMS') throw new UnprocessableEntityException('invalid_definition');
    if (result === 'QUESTION_DELETE_FORBIDDEN') throw new UnprocessableEntityException('question_delete_forbidden');
    if (result === 'CHOICE_DELETE_FORBIDDEN') throw new UnprocessableEntityException('choice_delete_forbidden');
    if (result === 'IMAGE_BLOCK_MODE_CHANGE_FORBIDDEN') throw new UnprocessableEntityException('image_block_mode_change_requires_endpoint');
    return { survey: await this.admin(id) };
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
  async mineAll(actor: string, locale: 'ko' | 'en') {
    const rows = await this.repo.myResponses(actor);
    return {
      locale,
      items: await Promise.all(rows.map(async (row) => ({
        survey: this.publicDto((await this.repo.detail(row.surveyId))!, locale),
        response: this.response(row, await this.repo.answers(row.id)),
      }))),
    };
  }
  async responses(actor: string, surveyId: string, query: { state: 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'WAITLISTED'; limit: number; cursor?: string; locale: 'ko' | 'en' }) {
    await this.reviewPerm(actor);
    const cursor = query.cursor ? this.responseCursor(query.cursor, surveyId, query.state) : undefined;
    const page = await this.repo.responsePage(surveyId, query.state, query.limit, cursor);
    if (!page) throw new NotFoundException('survey_not_found');
    const hasNext = page.items.length > query.limit;
    const items = page.items.slice(0, query.limit);
    const last = items.at(-1);
    return {
      surveyId, locale: query.locale, state: query.state, limit: query.limit, matchingCount: page.count,
      items: items.map(({ response, revision }) => ({ responseId: response.id, surveyId: response.surveyId, surveyRevisionId: response.surveyRevisionId, revision: revision.revision, state: response.state as 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'WAITLISTED', submittedAt: this.reviewableSubmittedAt(response.submittedAt).toISOString(), reviewedAt: date(response.reviewedAt) })),
      nextCursor: hasNext && last ? this.encodeResponseCursor(surveyId, query.state, this.reviewableSubmittedAt(last.response.submittedAt), last.response.id) : null,
    };
  }
  async responseDetail(actor: string, surveyId: string, responseId: string, locale: 'ko' | 'en') {
    await this.reviewPerm(actor);
    const row = await this.repo.responseDetail(surveyId, responseId);
    if (!row) throw new NotFoundException('survey_response_not_found');
    return this.adminResponseDetail(row, locale);
  }
  async review(actor: string, surveyId: string, id: string, input: unknown, locale: 'ko' | 'en', correlationId: string) {
    await this.reviewPerm(actor);
    if (!exact(input, ['expectedSurveyRevisionId', 'state', 'reason']) || !uuid(input.expectedSurveyRevisionId) || !['APPROVED', 'REJECTED', 'WAITLISTED'].includes(String(input.state))) throw new UnprocessableEntityException('invalid_response_transition');
    const reason = input.reason;
    if ((input.state === 'REJECTED' && (typeof reason !== 'string' || !reason.trim() || reason.trim().length > 500)) || (input.state !== 'REJECTED' && reason !== undefined)) throw new UnprocessableEntityException('invalid_response_transition');
    const result = await this.repo.review(surveyId, id, input.expectedSurveyRevisionId, actor, input.state as 'APPROVED' | 'REJECTED' | 'WAITLISTED', input.state === 'REJECTED' ? (reason as string).trim() : null, correlationId);
    if (!result) throw new NotFoundException('survey_response_not_found');
    if (result === 'STALE') throw new ConflictException('stale_response_target');
    if (result === 'INVALID') throw new UnprocessableEntityException('invalid_response_transition');
    const detail = await this.repo.responseDetail(surveyId, id);
    if (!detail) throw new Error('survey_response_invariant');
    return this.adminResponseDetail(detail, locale);
  }
  async aggregate(actor: string, id: string, locale: 'ko' | 'en') {
    await this.reviewPerm(actor);
    const result = await this.repo.aggregate(id);
    if (!result) throw new NotFoundException('survey_not_found');
    const surveySuppressed = result.responseCount < 5;
    return {
      surveyId: id, locale, surveySuppressed,
      revisions: result.revisions.map((revision) => {
        const suppressed = surveySuppressed || revision.responseCount < 5;
        return {
          surveyRevisionId: revision.surveyRevisionId, revision: revision.revision, suppressed,
          responseCount: suppressed ? null : revision.responseCount,
          questions: revision.questions.map((question) => ({
            questionId: question.questionId,
            prompt: this.localizedDto(question.promptKr, question.promptEn, locale),
            responseCount: suppressed ? null : question.responseCount,
            choices: question.choices.map((choice) => ({
              choiceOptionId: choice.choiceOptionId,
              label: this.localizedDto(choice.valueKr, choice.valueEn, locale),
              count: suppressed ? null : choice.count,
            })),
          })),
        };
      }),
    };
  }
  async aggregateV2(actor: string, id: string, locale: 'ko' | 'en') {
    await this.reviewPerm(actor);
    const result = await this.repo.aggregate(id);
    if (!result) throw new NotFoundException('survey_not_found');
    return {
      surveyId: id, locale,
      revisions: result.revisions.map((revision) => ({
        surveyRevisionId: revision.surveyRevisionId, revision: revision.revision, responseCount: revision.responseCount,
        questions: revision.questions.map((question) => ({
          questionId: question.questionId,
          prompt: this.localizedDto(question.promptKr, question.promptEn, locale),
          responseCount: question.responseCount,
          choices: question.choices.map((choice) => ({
            choiceOptionId: choice.choiceOptionId,
            label: this.localizedDto(choice.valueKr, choice.valueEn, locale),
            count: choice.count,
          })),
        })),
      })),
    };
  }
  async export(actor: string, id: string, input: unknown, correlationId: string) {
    await this.reviewPerm(actor);
    if (!exact(input, ['format', 'locale']) || input.format !== 'CSV' || (input.locale !== undefined && input.locale !== 'ko' && input.locale !== 'en')) throw new UnprocessableEntityException('invalid_export');
    const recorded = await this.repo.export(id, actor, correlationId);
    if (!recorded) throw new NotFoundException('survey_not_found');
    if (recorded === 'INVALID') throw new UnprocessableEntityException('invalid_export_lifecycle');
    const locale = (input as { locale?: 'ko' | 'en' }).locale ?? 'ko';
    const escape = (raw: unknown) => {
      let value = raw === null || raw === undefined ? '' : String(raw);
      if (/^[=+\-@\t\r]/.test(value)) value = `'${value}`;
      return `"${value.replaceAll('"', '""')}"`;
    };
    const header = ['survey_id', 'survey_revision_id', 'revision', 'response_id', 'state', 'submitted_at', 'question_id', 'question_label', 'question_translation_unavailable', 'answer_kind', 'answer_value', 'choice_option_id', 'choice_label', 'choice_translation_unavailable'];
    return {
      filename: `survey-${id}.csv`,
      chunks: this.exportChunks(id, locale, recorded.upperBoundary, header, escape),
    };
  }
  private async *exportChunks(
    id: string,
    locale: 'ko' | 'en',
    upperBoundary: { submittedAt: string; responseId: string } | null,
    header: string[],
    escape: (raw: unknown) => string,
  ): AsyncGenerator<string> {
    yield `\uFEFF${header.map(escape).join(',')}\r\n`;
    if (!upperBoundary) return;
    let cursor: { submittedAt: string; responseId: string } | undefined;
    const pageSize = 100;
    do {
      const rows = await this.repo.exportPage(id, pageSize, cursor, upperBoundary) as Array<Record<string, unknown>>;
      if (!rows.length) break;
      const responses = new Map<string, { revisionId: string; revision: number; state: string; submittedAt: Date; submittedAtCursor: string; answers: Map<string, { questionId: string; promptKr: string; promptEn: string; textValue: unknown; numberValue: unknown; dateValue: unknown; choiceOptionIds: string | null; choices: Map<string, { valueKr: string; valueEn: string }> }> }>();
      for (const row of rows) {
        const responseId = row.response_id as string;
        let response = responses.get(responseId);
        if (!response) {
          response = {
            revisionId: row.survey_revision_id as string, revision: Number(row.revision), state: row.state as string,
            submittedAt: new Date(row.submitted_at as string | Date), submittedAtCursor: row.submitted_at_cursor as string, answers: new Map(),
          };
          responses.set(responseId, response);
        }
        if (!row.answer_id) continue;
        const answerId = row.answer_id as string;
        let answer = response.answers.get(answerId);
        if (!answer) {
          if (!row.question_id || row.prompt_kr === null || row.prompt_en === null) throw new Error('survey_response_invariant');
          answer = {
            questionId: row.question_id as string, promptKr: row.prompt_kr as string, promptEn: row.prompt_en as string,
            textValue: row.text_value, numberValue: row.number_value, dateValue: row.date_value, choiceOptionIds: row.choice_option_ids as string | null, choices: new Map(),
          };
          response.answers.set(answerId, answer);
        }
        if (row.selected_choice_id && !row.choice_id) throw new Error('survey_response_invariant');
        if (row.choice_id) answer.choices.set(row.choice_id as string, { valueKr: row.value_kr as string, valueEn: row.value_en as string });
      }
      for (const [responseId, response] of responses) {
        const provenance = [id, response.revisionId, response.revision, responseId, response.state, this.reviewableSubmittedAt(response.submittedAt).toISOString()];
        if (!response.answers.size) {
          yield `${[...provenance, '', '', '', '', '', '', '', ''].map(escape).join(',')}\r\n`;
          continue;
        }
        for (const answer of response.answers.values()) {
          const prompt = this.localizedDto(answer.promptKr, answer.promptEn, locale);
          if (answer.textValue !== null || answer.numberValue !== null || answer.dateValue !== null) {
            const value = answer.textValue ?? answer.numberValue ?? answer.dateValue;
            const kind = answer.textValue !== null ? 'text' : answer.numberValue !== null ? 'number' : 'date';
            yield `${[...provenance, answer.questionId, prompt.value, prompt.translationUnavailable, kind, value, '', '', ''].map(escape).join(',')}\r\n`;
            continue;
          }
          for (const choiceId of choiceIds(answer.choiceOptionIds)) {
            const choice = answer.choices.get(choiceId);
            if (!choice) continue;
            const label = this.localizedDto(choice.valueKr, choice.valueEn, locale);
            yield `${[...provenance, answer.questionId, prompt.value, prompt.translationUnavailable, 'choices', '', choiceId, label.value, label.translationUnavailable].map(escape).join(',')}\r\n`;
          }
        }
      }
      const last = [...responses.entries()].at(-1);
      cursor = last ? { submittedAt: last[1].submittedAtCursor, responseId: last[0] } : undefined;
    } while (cursor);
  }
  async related(query: Record<string, unknown>) {
    if (!Object.keys(query).every((key) => ['articleId', 'eventId', 'surveyId', 'locale'].includes(key))) throw new UnprocessableEntityException('invalid_content_relation_query');
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
  async materializeEvent(actor: string, surveyId: string, input: unknown, correlationId: string) {
    await this.manage(actor);
    if (!exact(input, ['location', 'visibility']) || typeof input.location !== 'string' || !input.location.trim()
      || !['PUBLIC', 'AUTHENTICATED', 'COMMITTEE'].includes(input.visibility as string)) {
      throw new UnprocessableEntityException('invalid_survey_event');
    }
    const result = await this.repo.materializeEvent(surveyId, actor, input.location.trim(), input.visibility as 'PUBLIC' | 'AUTHENTICATED' | 'COMMITTEE', correlationId);
    if (!result) throw new NotFoundException('survey_not_found');
    if (result === 'INVALID') throw new ConflictException('survey_period_required');
    return { eventId: result.event.id, relation: this.matcherDto(result.relation) };
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
  async adminRequestedLocale(actor: string, id: string, locale: ContentLocale) {
    await this.manage(actor);
    const detail = await this.repo.detail(id);
    if (!detail) throw new NotFoundException('survey_not_found');
    return this.publicDto(detail, locale, true);
  }
  private async admin(id: string) {
    const detail = await this.repo.detail(id);
    if (!detail) throw new NotFoundException('survey_not_found');
    return this.publicDto(detail, 'ko');
  }
  private async manage(id: string) { if (!await this.permissions.hasPermission(id, 'SURVEY_MANAGE', 'GLOBAL')) throw new ForbiddenException('insufficient_permission'); }
  private async reviewPerm(id: string) { if (!await this.permissions.hasPermission(id, 'SURVEY_REVIEW', 'GLOBAL')) throw new ForbiddenException('insufficient_permission'); }
  private requireDefinitionCapacityApproval(): void {
    if (this.config.get<string>('NODE_ENV') !== 'production') return;

    const maxBytes = this.config.get<number>('SURVEY_DEFINITION_MAX_BYTES');
    const parserMaxBytes = this.config.get<number>('SURVEY_DEFINITION_PARSER_MAX_BYTES');
    const hardMaxBytes = this.config.get<number>('SURVEY_DEFINITION_HARD_MAX_BYTES');
    const reportHash = this.config.get<string>('SURVEY_DEFINITION_INVENTORY_REPORT_SHA256');
    const reportPayload = this.config.get<string>('SURVEY_DEFINITION_INVENTORY_REPORT_JSON');
    const inventorySchema = this.config.get<string>('SURVEY_DEFINITION_INVENTORY_SCHEMA');
    const inventorySerializer = this.config.get<string>('SURVEY_DEFINITION_INVENTORY_SERIALIZER');
    const approver = this.config.get<string>('SURVEY_DEFINITION_INVENTORY_APPROVER');
    const expectedDatabaseIdentity = this.config.get<string>('SURVEY_DEFINITION_EXPECTED_DATABASE_IDENTITY');
    const expectedMigrationIdentity = this.config.get<string>('SURVEY_DEFINITION_EXPECTED_MIGRATION_IDENTITY');
    let report = null;
    try { report = parseInventoryReport(typeof reportPayload === 'string' ? JSON.parse(reportPayload) : null); } catch {}
    if (
      !Number.isSafeInteger(maxBytes)
      || !Number.isSafeInteger(parserMaxBytes)
      || !Number.isSafeInteger(hardMaxBytes)
      || maxBytes! < 1
      || maxBytes! > parserMaxBytes!
      || parserMaxBytes! > hardMaxBytes!
      || typeof reportHash !== 'string'
      || !/^[a-f0-9]{64}$/i.test(reportHash)
      || !report
      || sha256Canonical(report) !== reportHash
      || inventorySchema !== SURVEY_DEFINITION_INVENTORY_SCHEMA
      || inventorySerializer !== SURVEY_DEFINITION_CANONICAL_SERIALIZER
      || report.selected.maxBytes !== maxBytes
      || report.selected.parserMaxBytes !== parserMaxBytes
      || report.selected.hardMaxBytes !== hardMaxBytes
      || report.schema !== inventorySchema
      || report.serializer !== inventorySerializer
      || typeof approver !== 'string'
      || approver.length === 0
      || typeof expectedDatabaseIdentity !== 'string'
      || typeof expectedMigrationIdentity !== 'string'
      || report.databaseIdentity !== expectedDatabaseIdentity
      || report.migrationIdentity !== expectedMigrationIdentity
    ) {
      throw new ServiceUnavailableException('survey_definition_capacity_not_approved');
    }
  }
  private settings(input: unknown, required: boolean): Partial<typeof surveys.$inferInsert> {
    if (!own(input) || (required && !this.localized(input.title))) {
      throw new UnprocessableEntityException('invalid_survey');
    }
    const allowed = ['title', 'description', 'onlyForKoreanSpeaker', 'expectedDefinitionVersion', 'guestAllowed', 'phoneRequired', 'feeRestriction', 'cap', 'opensAt', 'closesAt', 'editDeadlineAt', 'responseRetentionDays'];
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
    if (input.expectedDefinitionVersion !== undefined && (typeof input.expectedDefinitionVersion !== 'number' || !Number.isSafeInteger(input.expectedDefinitionVersion) || input.expectedDefinitionVersion < 1)) throw new UnprocessableEntityException('invalid_survey');
    if (input.onlyForKoreanSpeaker !== undefined && input.expectedDefinitionVersion === undefined) throw new UnprocessableEntityException('expected_definition_version_required');
    if (input.onlyForKoreanSpeaker !== undefined) { if (typeof input.onlyForKoreanSpeaker !== 'boolean') throw new UnprocessableEntityException('invalid_survey'); value.onlyForKoreanSpeaker = input.onlyForKoreanSpeaker; }
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
    if (!own(value) || !exact(value, ['id', 'ordinal', 'type', 'prompt', 'helpText', 'required', 'validationRegex', 'numberMin', 'numberMax', 'dateMin', 'dateMax', 'choices']) && !exact(value, ['ordinal', 'type', 'prompt', 'helpText', 'required', 'validationRegex', 'numberMin', 'numberMax', 'dateMin', 'dateMax', 'choices'])) {
      throw new UnprocessableEntityException('invalid_question');
    }
    const ordinal = value.ordinal;
    if (
      typeof ordinal !== 'number'
      || !Number.isInteger(ordinal)
      || ordinal < 0
      || (value.id !== undefined && !uuid(value.id))
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
          if (!exact(choice, ['id', 'ordinal', 'value']) && !exact(choice, ['ordinal', 'value'])) return true;
          const choiceOrdinal = choice.ordinal;
          return typeof choiceOrdinal !== 'number'
            || !Number.isInteger(choiceOrdinal)
            || (choice.id !== undefined && !uuid(choice.id))
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
  private reviewableSubmittedAt(value: Date | null): Date {
    if (!value) throw new Error('survey_response_submitted_at_invariant');
    return value;
  }
  private encodeResponseCursor(surveyId: string, state: string, submittedAt: Date, responseId: string) {
    return Buffer.from(JSON.stringify({ v: 1, surveyId, state, submittedAt: submittedAt.toISOString(), responseId })).toString('base64url');
  }
  private responseCursor(cursor: string, surveyId: string, state: string) {
    try {
      const parsed: unknown = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
      if (!own(parsed) || Object.keys(parsed).length !== 5 || parsed.v !== 1 || parsed.surveyId !== surveyId || parsed.state !== state || !uuid(parsed.surveyId) || !uuid(parsed.responseId) || typeof parsed.submittedAt !== 'string') throw new Error();
      const submittedAt = new Date(parsed.submittedAt);
      if (!Number.isFinite(submittedAt.getTime()) || submittedAt.toISOString() !== parsed.submittedAt) throw new Error();
      return { submittedAt, responseId: parsed.responseId };
    } catch { throw new UnprocessableEntityException('invalid_survey_response_query'); }
  }
  private adminResponseDetail(row: { response: Record<string, unknown>; revision: Record<string, unknown>; questions: Record<string, unknown>[]; choices: Record<string, unknown>[]; answers: Record<string, unknown>[] }, locale: 'ko' | 'en') {
    const labels = (kr: unknown, en: unknown) => this.localizedDto(kr, en, locale);
    const questions = new Map(row.questions.map((question) => [String(question.id), question]));
    const choices = new Map(row.choices.map((choice) => [String(choice.id), choice]));
    return {
      responseId: String(row.response.id), surveyId: String(row.response.surveyId), surveyRevisionId: String(row.response.surveyRevisionId), revision: Number(row.revision.revision), locale,
      state: row.response.state as 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'WAITLISTED', submittedAt: date(row.response.submittedAt)!, reviewedAt: date(row.response.reviewedAt), reviewReason: row.response.reviewReason as string | null,
      answers: row.answers.map<AdminSurveyResponseDetail['answers'][number]>((answer): AdminSurveyResponseDetail['answers'][number] => {
        const question = questions.get(String(answer.questionId));
        if (!question) throw new Error('survey_response_invariant');
        const prompt = labels(question.promptKr, question.promptEn);
        if (typeof answer.textValue === 'string') return { questionId: String(answer.questionId), prompt, value: { kind: 'text' as const, textValue: answer.textValue } };
        if (typeof answer.numberValue === 'number') return { questionId: String(answer.questionId), prompt, value: { kind: 'number' as const, numberValue: answer.numberValue } };
        if (typeof answer.dateValue === 'string') return { questionId: String(answer.questionId), prompt, value: { kind: 'date' as const, dateValue: answer.dateValue } };
        const ids = answer.choiceOptionIds ? choiceIds(answer.choiceOptionIds) : [];
        return {
          questionId: String(answer.questionId),
          prompt,
          value: {
            kind: 'choices' as const,
            choices: ids.map((choiceOptionId) => {
              const choice = choices.get(choiceOptionId);
              if (!choice) throw new Error('survey_response_invariant');
              return { choiceOptionId, label: labels(choice.valueKr, choice.valueEn) };
            }),
          },
        };
      }),
    };
  }
  private localizedDto(kr: unknown, en: unknown, locale: ContentLocale) {
    const primary = locale === 'ko' ? kr : en;
    if (typeof primary === 'string' && primary.trim().length > 0) {
      return { value: primary, translationUnavailable: false };
    }
    const fallback = locale === 'ko' ? en : kr;
    if (typeof fallback === 'string' && fallback.trim().length > 0) {
      return { value: fallback, translationUnavailable: true };
    }
    throw new Error('survey_translation_invariant');
  }
  private assetConfiguration() {
    const enabled = this.config.get<boolean>('ASSET_PROVIDER_ENABLED') === true;
    const url = this.config.get<string>('ASSET_PROVIDER_URL');
    const token = this.config.get<string>('ASSET_PROVIDER_TOKEN');
    if (!enabled || !url || !token) throw new ServiceUnavailableException('asset_provider_unavailable');
    return { url, token };
  }
  private publicDto(detail: { survey: Record<string, unknown>; revision: Record<string, unknown>; sections: Record<string, unknown>[]; questions: Record<string, unknown>[]; choices: Record<string, unknown>[]; items: Record<string, unknown>[]; descriptionItems: Record<string, unknown>[]; imageBlocks: Record<string, unknown>[] }, locale: ContentLocale, adminAuthoring = false) {
    const survey = detail.survey;
    const contentLocale: ContentLocale = !adminAuthoring && survey.onlyForKoreanSpeaker && locale === 'en' ? 'ko' : locale;
    const localized = (kr: unknown, en: unknown) => this.localizedDto(kr, en, contentLocale);
    return {
      id: survey.id,
      revision: survey.currentRevision,
      definitionVersion: survey.definitionVersion,
      locale,
      requestedLocale: locale,
      effectiveContentLocale: !adminAuthoring && survey.onlyForKoreanSpeaker && locale === 'en' ? 'ko' : locale,
      onlyForKoreanSpeaker: survey.onlyForKoreanSpeaker,
      title: this.localizedDto(detail.revision.titleKr, detail.revision.titleEn, contentLocale),
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
        items: detail.items.filter((item) => item.sectionId === section.id).map((item) => {
          if (item.kind === 'DESCRIPTION') { const description = detail.descriptionItems.find((value) => value.itemId === item.id); if (!description) throw new Error('survey_description_item_invariant'); return { id: item.id, ordinal: item.ordinal, kind: 'DESCRIPTION' as const, body: localized(description.bodyKr, description.bodyEn) }; }
          if (item.kind === 'IMAGE_BLOCK') { const block = detail.imageBlocks.find((value) => value.itemId === item.id); if (!block) throw new Error('survey_image_block_invariant'); return { id: item.id, ordinal: item.ordinal, kind: 'IMAGE_BLOCK' as const, mode: block.mode, membershipCounts: { shared: block.sharedMembershipCount, ko: block.koMembershipCount, en: block.enMembershipCount } }; }
          const question = detail.questions.find((value) => value.id === item.questionId); if (!question) throw new Error('survey_question_item_invariant'); return { id: item.id, ordinal: item.ordinal, kind: 'QUESTION' as const, question: { id: question.id, ordinal: question.ordinal, type: question.type, prompt: localized(question.promptKr, question.promptEn), helpText: question.helpTextKr === null && question.helpTextEn === null ? null : localized(question.helpTextKr, question.helpTextEn), required: question.required, validationRegex: question.validationRegex ?? null, numberMin: question.numberMin ?? null, numberMax: question.numberMax ?? null, dateMin: question.dateMin ?? null, dateMax: question.dateMax ?? null, choices: detail.choices.filter((choice) => choice.questionId === question.id).map((choice) => ({ id: choice.id, ordinal: choice.ordinal, value: localized(choice.valueKr, choice.valueEn) })) } };
        }),
      })),
      updatedAt: date(survey.updatedAt),
    };
  }
  private response(response: Record<string, unknown>, answers: Record<string, unknown>[]) { const submittedAt = date(response.submittedAt); return { id: response.id, state: response.state, answers: answers.map((answer) => ({ questionId: answer.questionId, textValue: answer.textValue ?? undefined, numberValue: answer.numberValue ?? undefined, dateValue: answer.dateValue ?? undefined, choiceOptionIds: answer.choiceOptionIds ? choiceIds(answer.choiceOptionIds) : undefined })), submittedAt, reviewedAt: date(response.reviewedAt), reviewReason: response.reviewReason ?? null, phonePresent: !!response.guestPhoneCiphertext, maskedPhone: response.guestPhoneCiphertext ? '***' : null }; }
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
