import { createHash } from 'node:crypto';

export const SURVEY_DEFINITION_INVENTORY_SCHEMA = 'survey-definition-inventory-v3';
export const SURVEY_DEFINITION_CANONICAL_SERIALIZER = 'survey-definition-canonical-v3';

type ObjectValue = Record<string, unknown>;
const object = (value: unknown): ObjectValue => value !== null && typeof value === 'object' && !Array.isArray(value)
  ? value as ObjectValue
  : {};
const nullable = (value: unknown): unknown => value === undefined ? null : value;
const localized = (value: unknown) => {
  const input = object(value);
  return { kr: nullable(input.kr), en: nullable(input.en) };
};

export const canonicalSurveyDefinition = (value: unknown) => {
  const input = object(value);
  const canonicalQuestion = (value: unknown) => {
    const question = object(value);
    return {
      id: nullable(question.id),
      ordinal: nullable(question.ordinal),
      type: nullable(question.type),
      prompt: localized(question.prompt),
      helpText: nullable(question.helpText) === null ? null : localized(question.helpText),
      required: nullable(question.required),
      validationRegex: nullable(question.validationRegex),
      numberMin: nullable(question.numberMin),
      numberMax: nullable(question.numberMax),
      dateMin: nullable(question.dateMin),
      dateMax: nullable(question.dateMax),
      choices: Array.isArray(question.choices) ? question.choices.map((rawChoice) => {
        const choice = object(rawChoice);
        return { id: nullable(choice.id), ordinal: nullable(choice.ordinal), value: localized(choice.value) };
      }) : [],
    };
  };
  return {
    expectedDefinitionVersion: nullable(input.expectedDefinitionVersion),
    sections: Array.isArray(input.sections) ? input.sections.map((rawSection) => {
      const section = object(rawSection);
      const legacyQuestions = Array.isArray(section.questions) ? section.questions.map((question) => ({
        ordinal: nullable(object(question).ordinal),
        kind: 'QUESTION',
        question: canonicalQuestion(question),
      })) : [];
      return {
        id: nullable(section.id),
        ordinal: nullable(section.ordinal),
        title: localized(section.title),
        items: Array.isArray(section.items) ? section.items.map((rawItem) => {
          const item = object(rawItem);
          const kind = nullable(item.kind);
          if (kind === 'QUESTION') return {
            id: nullable(item.id),
            ordinal: nullable(item.ordinal),
            kind,
            question: canonicalQuestion(item.question),
          };
          if (kind === 'DESCRIPTION') return {
            id: nullable(item.id),
            ordinal: nullable(item.ordinal),
            kind,
            body: localized(item.body),
          };
          return {
            id: nullable(item.id),
            ordinal: nullable(item.ordinal),
            kind,
            mode: nullable(item.mode),
            membershipCounts: nullable(item.membershipCounts) === null ? null : {
              shared: nullable(object(item.membershipCounts).shared),
              ko: nullable(object(item.membershipCounts).ko),
              en: nullable(object(item.membershipCounts).en),
            },
          };
        }) : legacyQuestions,
      };
    }) : [],
  };
};

export const canonicalJson = (value: unknown): string => JSON.stringify(value);
export const sha256Canonical = (value: unknown): string => createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex');

export type DefinitionInventoryReport = {
  schema: typeof SURVEY_DEFINITION_INVENTORY_SCHEMA;
  serializer: typeof SURVEY_DEFINITION_CANONICAL_SERIALIZER;
  reportDate: string;
  databaseIdentity: string;
  migrationIdentity: string;
  counts: Record<string, number>;
  maxima: Record<string, number>;
  topology: Record<string, number>;
  contentSha256: string;
  selected: { maxBytes: number; parserMaxBytes: number; hardMaxBytes: number; marginBytes: number };
};
export const canonicalInventoryReport = (report: DefinitionInventoryReport): DefinitionInventoryReport => ({
  schema: report.schema,
  serializer: report.serializer,
  reportDate: report.reportDate,
  databaseIdentity: report.databaseIdentity,
  migrationIdentity: report.migrationIdentity,
  counts: Object.fromEntries(Object.entries(report.counts).sort(([left], [right]) => left.localeCompare(right))),
  maxima: Object.fromEntries(Object.entries(report.maxima).sort(([left], [right]) => left.localeCompare(right))),
  topology: Object.fromEntries(Object.entries(report.topology).sort(([left], [right]) => left.localeCompare(right))),
  contentSha256: report.contentSha256,
  selected: {
    maxBytes: report.selected.maxBytes,
    parserMaxBytes: report.selected.parserMaxBytes,
    hardMaxBytes: report.selected.hardMaxBytes,
    marginBytes: report.selected.marginBytes,
  },
});
const recordOfNumbers = (value: unknown): value is Record<string, number> =>
  value !== null
  && typeof value === 'object'
  && !Array.isArray(value)
  && Object.values(value).every((entry) => Number.isSafeInteger(entry) && entry >= 0);

export const parseInventoryReport = (value: unknown): DefinitionInventoryReport | null => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
  const report = value as Partial<DefinitionInventoryReport>;
  const selected = report.selected;
  if (
    report.schema !== SURVEY_DEFINITION_INVENTORY_SCHEMA
    || report.serializer !== SURVEY_DEFINITION_CANONICAL_SERIALIZER
    || typeof report.reportDate !== 'string'
    || typeof report.databaseIdentity !== 'string'
    || typeof report.migrationIdentity !== 'string'
    || !recordOfNumbers(report.counts)
    || !recordOfNumbers(report.maxima)
    || !recordOfNumbers(report.topology)
    || typeof report.contentSha256 !== 'string'
    || !/^[a-f0-9]{64}$/i.test(report.contentSha256)
    || !/^\d{4}-\d{2}-\d{2}$/.test(report.reportDate)
    || !selected
    || !Number.isSafeInteger(selected.maxBytes)
    || !Number.isSafeInteger(selected.parserMaxBytes)
    || !Number.isSafeInteger(selected.hardMaxBytes)
    || !Number.isSafeInteger(selected.marginBytes)
    || selected.maxBytes < 1
    || selected.maxBytes > selected.parserMaxBytes
    || selected.parserMaxBytes > selected.hardMaxBytes
    || selected.marginBytes < 0
  ) return null;
  return canonicalInventoryReport(report as DefinitionInventoryReport);
};
