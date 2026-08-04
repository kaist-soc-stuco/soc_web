import { ServiceUnavailableException, UnprocessableEntityException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { describe, expect, it, vi } from 'vitest';

import { PermissionsService } from '../src/features/permissions/permissions.service';
import { SurveysRepository } from '../src/features/surveys/surveys.repository';
import { SurveysService } from '../src/features/surveys/surveys.service';
import { PiiCipherService } from '../src/shared/security/pii-cipher.service';
import { canonicalJson, canonicalSurveyDefinition, sha256Canonical, SURVEY_DEFINITION_CANONICAL_SERIALIZER, SURVEY_DEFINITION_INVENTORY_SCHEMA } from '../src/features/surveys/survey-definition-canonical';

const serviceFor = (values: Record<string, unknown>) => new SurveysService(
  {} as SurveysRepository,
  { hasPermission: vi.fn().mockResolvedValue(true) } as unknown as PermissionsService,
  {} as PiiCipherService,
  { get: <T>(key: string): T | undefined => values[key] as T | undefined } as ConfigService,
);
const approvedReport = {
  schema: SURVEY_DEFINITION_INVENTORY_SCHEMA,
  serializer: SURVEY_DEFINITION_CANONICAL_SERIALIZER,
  reportDate: '2026-08-03',
  databaseIdentity: 'soc_web',
  migrationIdentity: 'c'.repeat(64),
  counts: { definitions: 1 },
  maxima: { inventoryUtf8Bytes: 1, localizedTextUtf8Bytes: 1 },
  topology: {},
  contentSha256: 'b'.repeat(64),
  selected: { maxBytes: 262_144, parserMaxBytes: 266_240, hardMaxBytes: 1_048_576, marginBytes: 1024 },
};
const approvedCapacity = {
  SURVEY_DEFINITION_MAX_BYTES: 262_144,
  SURVEY_DEFINITION_PARSER_MAX_BYTES: 266_240,
  SURVEY_DEFINITION_HARD_MAX_BYTES: 1_048_576,
  SURVEY_DEFINITION_INVENTORY_REPORT_SHA256: sha256Canonical(approvedReport),
  SURVEY_DEFINITION_INVENTORY_REPORT_JSON: JSON.stringify(approvedReport),
  SURVEY_DEFINITION_INVENTORY_SCHEMA: SURVEY_DEFINITION_INVENTORY_SCHEMA,
  SURVEY_DEFINITION_INVENTORY_SERIALIZER: SURVEY_DEFINITION_CANONICAL_SERIALIZER,
  SURVEY_DEFINITION_INVENTORY_APPROVER: 'release-approver',
  SURVEY_DEFINITION_EXPECTED_DATABASE_IDENTITY: 'soc_web',
  SURVEY_DEFINITION_EXPECTED_MIGRATION_IDENTITY: 'c'.repeat(64),
};

describe('Survey definition production capacity approval', () => {
  it('fails closed only for the full definition endpoint when production evidence is missing', async () => {
    const service = serviceFor({ NODE_ENV: 'production' });

    await expect(service.definition('actor', 'survey', {}, 'request')).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('does not treat development defaults as a production approval', async () => {
    const service = serviceFor({
      NODE_ENV: 'production',
      SURVEY_DEFINITION_MAX_BYTES: 262_144,
      SURVEY_DEFINITION_PARSER_MAX_BYTES: 266_240,
      SURVEY_DEFINITION_HARD_MAX_BYTES: 1_048_576,
    });

    await expect(service.definition('actor', 'survey', {}, 'request')).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
  it.each([
    ['missing B', { SURVEY_DEFINITION_MAX_BYTES: undefined }],
    ['missing P', { SURVEY_DEFINITION_PARSER_MAX_BYTES: undefined }],
    ['missing H', { SURVEY_DEFINITION_HARD_MAX_BYTES: undefined }],
    ['noninteger B', { SURVEY_DEFINITION_MAX_BYTES: 1.5 }],
    ['zero P', { SURVEY_DEFINITION_PARSER_MAX_BYTES: 0 }],
    ['negative H', { SURVEY_DEFINITION_HARD_MAX_BYTES: -1 }],
    ['reversed B/P', { SURVEY_DEFINITION_MAX_BYTES: 266_241 }],
    ['reversed P/H', { SURVEY_DEFINITION_PARSER_MAX_BYTES: 1_048_577 }],
  ])('fails closed for invalid production B/P/H capacity: %s', async (_case, invalidCapacity) => {
    const service = serviceFor({
      NODE_ENV: 'production',
      ...approvedCapacity,
      ...invalidCapacity,
    });

    await expect(service.definition('actor', 'survey', {}, 'request'))
      .rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('accepts complete production evidence before applying normal definition validation', async () => {
    const service = serviceFor({
      NODE_ENV: 'production',
      ...approvedCapacity,
    });

    await expect(service.definition('actor', 'survey', {}, 'request')).rejects.toBeInstanceOf(UnprocessableEntityException);
  });
  it('rejects a matching-looking hash when its report payload or selected limits do not match', async () => {
    const service = serviceFor({
      NODE_ENV: 'production',
      ...approvedCapacity,
      SURVEY_DEFINITION_INVENTORY_REPORT_JSON: JSON.stringify({
        ...approvedReport,
        selected: { ...approvedReport.selected, maxBytes: 1 },
      }),
    });

    await expect(service.definition('actor', 'survey', {}, 'request')).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
  it.each([
    ['database identity', { SURVEY_DEFINITION_EXPECTED_DATABASE_IDENTITY: 'other_database' }],
    ['migration identity', { SURVEY_DEFINITION_EXPECTED_MIGRATION_IDENTITY: 'd'.repeat(64) }],
  ])('rejects a report with a mismatched production %s', async (_case, expectedIdentity) => {
    const service = serviceFor({
      NODE_ENV: 'production',
      ...approvedCapacity,
      ...expectedIdentity,
    });

    await expect(service.definition('actor', 'survey', {}, 'request')).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
describe('Survey definition canonical serializer', () => {
  it('round-trips the largest sanitized fixture without changing property order or null defaults', () => {
    const fixture = {
      expectedDefinitionVersion: 1,
      sections: Array.from({ length: 100 }, (_, sectionOrdinal) => ({
        id: '11111111-1111-4111-8111-111111111111',
        ordinal: sectionOrdinal,
        title: { kr: '가'.repeat(4_000), en: 'a'.repeat(4_000) },
        items: [
          { id: '22222222-2222-4222-8222-222222222222', ordinal: 0, kind: 'DESCRIPTION', body: { kr: '설명'.repeat(4_000), en: 'description'.repeat(4_000) } },
          ...Array.from({ length: 100 }, (_, questionOrdinal) => ({
            id: '33333333-3333-4333-8333-333333333333',
            ordinal: questionOrdinal + 1,
            kind: 'QUESTION',
            question: {
              id: '44444444-4444-4444-8444-444444444444',
              ordinal: questionOrdinal,
              type: 'SINGLE_CHOICE',
              prompt: { kr: '질문', en: 'Question' },
              required: true,
              choices: Array.from({ length: 100 }, (_, choiceOrdinal) => ({
                id: '55555555-5555-4555-8555-555555555555',
                ordinal: choiceOrdinal,
                value: { kr: '선택', en: 'Choice' },
              })),
            },
          })),
          { id: '66666666-6666-4666-8666-666666666666', ordinal: 101, kind: 'IMAGE_BLOCK', mode: 'LOCALIZED', membershipCounts: { shared: 0, ko: 2, en: 3 } },
        ],
      })),
    };
    const serialized = canonicalJson(canonicalSurveyDefinition(fixture));
    const resaved = canonicalJson(canonicalSurveyDefinition(JSON.parse(serialized)));

    expect(resaved).toBe(serialized);
    expect(JSON.parse(serialized).sections[0].items[1]).toEqual({
      id: '33333333-3333-4333-8333-333333333333',
      ordinal: 1,
      kind: 'QUESTION',
      question: {
        id: '44444444-4444-4444-8444-444444444444',
        ordinal: 0,
        type: 'SINGLE_CHOICE',
        prompt: { kr: '질문', en: 'Question' },
        helpText: null,
        required: true,
        validationRegex: null,
        numberMin: null,
        numberMax: null,
        dateMin: null,
        dateMax: null,
        choices: [{ id: '55555555-5555-4555-8555-555555555555', ordinal: 0, value: { kr: '선택', en: 'Choice' } }, ...Array.from({ length: 99 }, (_, ordinal) => ({ id: '55555555-5555-4555-8555-555555555555', ordinal: ordinal + 1, value: { kr: '선택', en: 'Choice' } }))],
      },
    });
  });
});
