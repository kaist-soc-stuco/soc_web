import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';
import { sql } from 'drizzle-orm';

import { AppModule } from '../app.module';
import { canonicalInventoryReport, canonicalJson, canonicalSurveyDefinition, sha256Canonical, SURVEY_DEFINITION_CANONICAL_SERIALIZER, SURVEY_DEFINITION_INVENTORY_SCHEMA, type DefinitionInventoryReport } from '../features/surveys/survey-definition-canonical';
import { DRIZZLE_DB, type PostgresDatabase } from '../infrastructure/postgres/postgres.provider';

type Row = Record<string, unknown>;
const number = (value: unknown): number => typeof value === 'number' ? value : Number(value);
const text = (value: unknown): string | null => typeof value === 'string' ? value : null;
const localizedTextMax = (value: unknown): number => {
  if (Array.isArray(value)) return Math.max(0, ...value.map(localizedTextMax));
  if (value === null || typeof value !== 'object') return 0;
  return Math.max(0, ...Object.entries(value as Row).map(([key, nested]) =>
    (key === 'kr' || key === 'en') && typeof nested === 'string'
      ? Buffer.byteLength(nested, 'utf8')
      : localizedTextMax(nested)));
};
const requiredHardMaxBytes = (value: unknown): number => {
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) {
    throw new Error('SURVEY_DEFINITION_HARD_MAX_BYTES is required');
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) throw new Error('SURVEY_DEFINITION_HARD_MAX_BYTES is invalid');
  return parsed;
};
const roundUpKiB = (value: number): number => Math.ceil(value / 1024) * 1024;

const main = async (): Promise<void> => {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  try {
    const database = app.get<PostgresDatabase>(DRIZZLE_DB);
    const [rows, identity] = await Promise.all([
      database.execute(sql`
        SELECT survey.id AS survey_id, survey.definition_version, section.id AS section_id, section.ordinal AS section_ordinal, section.title_kr, section.title_en,
          item.id AS item_id, item.ordinal AS item_ordinal, item.kind AS item_kind,
          question.id AS question_id, question.ordinal AS question_ordinal, question.type, question.prompt_kr, question.prompt_en, question.help_text_kr, question.help_text_en, question.required,
          question.validation_regex, question.number_min, question.number_max, question.date_min, question.date_max,
          description.body_kr, description.body_en,
          image_block.mode AS image_mode, image_block.shared_membership_count, image_block.ko_membership_count, image_block.en_membership_count,
          choice_option.id AS choice_id, choice_option.ordinal AS choice_ordinal, choice_option.value_kr, choice_option.value_en
        FROM surveys AS survey
        JOIN survey_revisions AS revision ON revision.survey_id = survey.id AND revision.revision = survey.current_revision
        LEFT JOIN survey_sections AS section ON section.survey_revision_id = revision.id
        LEFT JOIN survey_section_items AS item ON item.section_id = section.id
        LEFT JOIN survey_questions AS question ON question.id = item.question_id
        LEFT JOIN survey_section_description_items AS description ON description.item_id = item.id
        LEFT JOIN survey_image_blocks AS image_block ON image_block.item_id = item.id
        LEFT JOIN survey_choice_options AS choice_option ON choice_option.question_id = question.id
        ORDER BY survey.id, section.ordinal, item.ordinal, choice_option.ordinal
      `),
      database.execute(sql`SELECT current_database() AS database_identity, COALESCE((SELECT MAX(hash) FROM drizzle.__drizzle_migrations), '') AS migration_identity`),
    ]);
    const definitions: unknown[] = [];
    let current: Record<string, unknown> | undefined;
    let section: Record<string, unknown> | undefined;
    let item: Record<string, unknown> | undefined;
    for (const row of rows.rows as Row[]) {
      if (current?.surveyId !== row.survey_id) {
        current = { surveyId: row.survey_id, expectedDefinitionVersion: number(row.definition_version), sections: [] };
        definitions.push(current);
        section = undefined;
        item = undefined;
      }
      if (row.section_ordinal === null) continue;
      if (section?.ordinal !== number(row.section_ordinal)) {
        section = { id: text(row.section_id), ordinal: number(row.section_ordinal), title: { kr: text(row.title_kr), en: text(row.title_en) }, items: [] };
        (current!.sections as unknown[]).push(section);
        item = undefined;
      }
      if (row.item_ordinal === null) continue;
      if (item?.id !== text(row.item_id)) {
        const kind = text(row.item_kind);
        if (kind === 'QUESTION') {
          item = {
            id: text(row.item_id),
            ordinal: number(row.item_ordinal),
            kind,
            question: {
              id: text(row.question_id),
              ordinal: number(row.question_ordinal),
              type: text(row.type),
              prompt: { kr: text(row.prompt_kr), en: text(row.prompt_en) },
              helpText: text(row.help_text_kr) === null ? null : { kr: text(row.help_text_kr), en: text(row.help_text_en) },
              required: row.required,
              validationRegex: text(row.validation_regex),
              numberMin: row.number_min,
              numberMax: row.number_max,
              dateMin: text(row.date_min),
              dateMax: text(row.date_max),
              choices: [],
            },
          };
        } else if (kind === 'DESCRIPTION') {
          item = { id: text(row.item_id), ordinal: number(row.item_ordinal), kind, body: { kr: text(row.body_kr), en: text(row.body_en) } };
        } else if (kind === 'IMAGE_BLOCK') {
          item = {
            id: text(row.item_id),
            ordinal: number(row.item_ordinal),
            kind,
            mode: text(row.image_mode),
            membershipCounts: { shared: number(row.shared_membership_count), ko: number(row.ko_membership_count), en: number(row.en_membership_count) },
          };
        } else {
          throw new Error('Inventory encountered an unknown section item kind');
        }
        (section.items as unknown[]).push(item);
      }
      if (row.choice_ordinal !== null && item.kind === 'QUESTION') {
        ((item.question as Record<string, unknown>).choices as unknown[]).push({ id: text(row.choice_id), ordinal: number(row.choice_ordinal), value: { kr: text(row.value_kr), en: text(row.value_en) } });
      }
    }
    const canonicalDefinitions = definitions.map((definition) => {
      const { surveyId: _surveyId, ...request } = definition as Record<string, unknown>;
      return canonicalSurveyDefinition(request);
    });
    const bytes = canonicalDefinitions.map((definition) => Buffer.byteLength(canonicalJson(definition), 'utf8'));
    const inventoryMax = Math.max(0, ...bytes);
    const hardMaxBytes = requiredHardMaxBytes(process.env.SURVEY_DEFINITION_HARD_MAX_BYTES);
    const marginBytes = Math.max(4096, Math.ceil(inventoryMax * 0.2));
    const maxBytes = roundUpKiB(inventoryMax + marginBytes);
    const parserMaxBytes = Math.min(hardMaxBytes, maxBytes + 4096);
    if (maxBytes > hardMaxBytes || parserMaxBytes < maxBytes) {
      throw new Error('Inventory selected limits exceed SURVEY_DEFINITION_HARD_MAX_BYTES');
    }
    const localizedTextUtf8Bytes = localizedTextMax(canonicalDefinitions);
    const identityRow = identity.rows[0] as Row | undefined;
    const databaseIdentity = text(identityRow?.database_identity);
    const migrationIdentity = text(identityRow?.migration_identity);
    if (!databaseIdentity || databaseIdentity === 'unknown' || !migrationIdentity || migrationIdentity === 'unknown') {
      throw new Error('Inventory database or migration identity is missing');
    }
    const questionTypes = [...new Set(
      canonicalDefinitions.flatMap((definition) =>
        definition.sections.flatMap((section) =>
          section.items
            .filter((item) => item.kind === 'QUESTION')
            .map((item) => String(item.question?.type)),
        ),
      ),
    )].sort();
    const topology = Object.fromEntries(questionTypes.map((type) => [
      type,
      canonicalDefinitions.reduce(
        (total, definition) => total + definition.sections.reduce(
          (sectionTotal, section) =>
            sectionTotal + section.items.filter((item) => item.kind === 'QUESTION' && String(item.question?.type) === type).length,
          0,
        ),
        0,
      ),
    ]));
    const report: DefinitionInventoryReport = {
      schema: SURVEY_DEFINITION_INVENTORY_SCHEMA,
      serializer: SURVEY_DEFINITION_CANONICAL_SERIALIZER,
      reportDate: new Date().toISOString().slice(0, 10),
      databaseIdentity,
      migrationIdentity,
      counts: {
        definitions: canonicalDefinitions.length,
        sections: canonicalDefinitions.reduce((total, definition) => total + definition.sections.length, 0),
        items: canonicalDefinitions.reduce((total, definition) => total + definition.sections.reduce((sectionTotal, section) => sectionTotal + section.items.length, 0), 0),
        questions: canonicalDefinitions.reduce((total, definition) => total + definition.sections.reduce((sectionTotal, section) => sectionTotal + section.items.filter((item) => item.kind === 'QUESTION').length, 0), 0),
        descriptions: canonicalDefinitions.reduce((total, definition) => total + definition.sections.reduce((sectionTotal, section) => sectionTotal + section.items.filter((item) => item.kind === 'DESCRIPTION').length, 0), 0),
        imageBlocks: canonicalDefinitions.reduce((total, definition) => total + definition.sections.reduce((sectionTotal, section) => sectionTotal + section.items.filter((item) => item.kind === 'IMAGE_BLOCK').length, 0), 0),
        choices: canonicalDefinitions.reduce((total, definition) => total + definition.sections.reduce((sectionTotal, section) => sectionTotal + section.items.reduce((itemTotal, item) => itemTotal + (item.kind === 'QUESTION' ? item.question?.choices.length ?? 0 : 0), 0), 0), 0),
      },
      maxima: { inventoryUtf8Bytes: inventoryMax, localizedTextUtf8Bytes },
      topology,
      contentSha256: sha256Canonical(canonicalDefinitions),
      selected: { maxBytes, parserMaxBytes, hardMaxBytes, marginBytes },
    };
    const canonicalReport = canonicalInventoryReport(report);
    process.stdout.write(`${canonicalJson({ ...canonicalReport, reportSha256: sha256Canonical(canonicalReport) })}\n`);
  } finally { await app.close(); }
};

void main();
