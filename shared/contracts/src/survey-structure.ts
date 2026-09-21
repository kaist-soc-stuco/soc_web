import { z } from "zod";
import { CreateQuestionSchema, CreateSectionSchema } from "./schemas.js";
import type { SurveyDetailResponse } from "./http/survey.js";

const nullableText = z.string().nullable().optional();
const question = CreateQuestionSchema.extend({
  id: z.string().uuid(), titleEn: nullableText,
  descriptionKo: CreateQuestionSchema.shape.descriptionKo.nullable(), descriptionEn: CreateQuestionSchema.shape.descriptionEn.nullable(),
  options: CreateQuestionSchema.shape.options.nullable(),
  config: CreateQuestionSchema.shape.config.nullable(),
  answerRegex: CreateQuestionSchema.shape.answerRegex.nullable(),
});
const section = CreateSectionSchema.extend({
  id: z.string().uuid(), titleEn: nullableText,
  descriptionKo: CreateSectionSchema.shape.descriptionKo.nullable(), descriptionEn: CreateSectionSchema.shape.descriptionEn.nullable(),
  questions: z.array(question).max(200),
});
export const SurveyStructureSchema = z.array(section).max(200).superRefine((sections, ctx) => {
  const ids = sections.flatMap(section => [section.id, ...section.questions.map(question => question.id)]);
  if (new Set(ids).size !== ids.length) ctx.addIssue({ code: "custom", message: "Duplicate structure ID" });
});
const header = z.object({ titleKo: z.string().min(1).max(255), titleEn: z.string().max(255), descriptionKo: z.string().max(50_000), descriptionEn: z.string().max(50_000) }).strict();
export type SurveyHistoryHeader = z.infer<typeof header>;
export const RestoreSurveyStructureSchema = z.object({
  expected: SurveyStructureSchema,
  sections: SurveyStructureSchema,
  header: z.object({ expected: header, value: header }).optional(),
}).strict();
export type SurveyStructure = z.infer<typeof SurveyStructureSchema>;
export type RestoreSurveyStructureRequest = z.infer<typeof RestoreSurveyStructureSchema>;

/** Only editable fields participate in history; server timestamps and publication do not. */
export function surveyStructureSnapshot(sections: SurveyDetailResponse["sections"] | SurveyStructure): SurveyStructure {
  return sections.map((s, sortOrder) => ({
    id: s.id, titleKo: s.titleKo, titleEn: s.titleEn ?? null,
    descriptionKo: s.descriptionKo ?? null, descriptionEn: s.descriptionEn ?? null,
    nextSectionId: s.nextSectionId ?? null, sortOrder,
    questions: s.questions.map((q, index) => ({
      id: q.id, titleKo: q.titleKo, titleEn: q.titleEn ?? null,
      descriptionKo: q.descriptionKo ?? null, descriptionEn: q.descriptionEn ?? null,
      questionType: q.questionType, options: q.options ?? null, config: q.config ?? null,
      answerRegex: q.answerRegex ?? null, isRequired: q.isRequired ?? true, sortOrder: index,
    })),
  }));
}

export function surveyStructuresEqual(left: SurveyStructure, right: SurveyStructure) {
  // JSON object key order in jsonb can differ from the browser's insertion order.
  const stable = (value: unknown): unknown => Array.isArray(value) ? value.map(stable)
    : value && typeof value === "object" ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, stable(item)])) : value;
  return JSON.stringify(stable(surveyStructureSnapshot(left))) === JSON.stringify(stable(surveyStructureSnapshot(right)));
}
