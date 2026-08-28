import { BadRequestException } from "@nestjs/common";

import type { SubmitResponseDto } from "./dto/submit-response.dto";
import type { SurveyQuestionRecord } from "./entities/survey-question.entity";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d(?:[:][0-5]\d)?$/;

function isValidDateOnly(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  if (month < 1 || month > 12) return false;
  const isLeapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, isLeapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  return day >= 1 && day <= daysInMonth;
}

function hasDuplicateValues(values: readonly string[]): boolean {
  return new Set(values).size !== values.length;
}

function parseRating(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value)) return value;
  if (typeof value === "string" && /^\d+$/.test(value)) return Number(value);
  return null;
}

function ratingMax(question: SurveyQuestionRecord): number {
  const configured = question.config?.ratingMax ?? 5;
  return Number.isInteger(configured) && configured >= 2 && configured <= 10 ? configured : 5;
}

export function isSurveyAnswerEmpty(
  question: SurveyQuestionRecord,
  content: Record<string, unknown>,
): boolean {
  if (question.questionType === "multiple_choice") {
    return !Array.isArray(content.values) || content.values.length === 0;
  }

  if (question.questionType === "grid_single" || question.questionType === "grid_multiple") {
    return (
      typeof content.grid !== "object" ||
      content.grid === null ||
      Object.keys(content.grid as Record<string, unknown>).length === 0
    );
  }

  if (question.questionType === "file_upload") {
    const assetIds = Array.isArray(content.assetIds)
      ? content.assetIds
      : typeof content.assetId === "string"
        ? [content.assetId]
        : [];
    return assetIds.length === 0;
  }

  if (question.questionType === "rating") {
    const value = content.rating;
    return value === undefined || value === null || (typeof value === "string" && value.trim().length === 0);
  }

  const value =
    content.text ??
    content.value ??
    content.date ??
    content.time ??
    content.datetime;

  return typeof value !== "string" || value.trim().length === 0;
}

function validateAnswerContent(
  question: SurveyQuestionRecord,
  content: Record<string, unknown>,
): void {
  if (!question.isRequired && isSurveyAnswerEmpty(question, content)) {
    return;
  }

  if (question.isRequired && isSurveyAnswerEmpty(question, content)) {
    throw new BadRequestException("required_answer_missing");
  }

  const optionValues = new Set((question.options ?? []).map((option) => option.value));

  switch (question.questionType) {
    case "short_text":
    case "long_text": {
      if (typeof content.text !== "string") {
        throw new BadRequestException("answer_content_invalid");
      }
      if (question.answerRegex) {
        try {
          if (!new RegExp(question.answerRegex).test(content.text)) {
            throw new BadRequestException("answer_regex_mismatch");
          }
        } catch (error) {
          if (error instanceof BadRequestException) throw error;
          throw new BadRequestException("answer_regex_invalid");
        }
      }
      break;
    }
    case "single_choice":
    case "dropdown": {
      if (typeof content.value !== "string" || !optionValues.has(content.value)) {
        throw new BadRequestException("answer_option_invalid");
      }
      break;
    }
    case "multiple_choice": {
      if (
        !Array.isArray(content.values) ||
        !content.values.every((value) => typeof value === "string" && optionValues.has(value)) ||
        hasDuplicateValues(content.values as string[])
      ) {
        throw new BadRequestException("answer_option_invalid");
      }
      break;
    }
    case "rating": {
      const value = parseRating(content.rating);
      if (value === null || value < 1 || value > ratingMax(question)) {
        throw new BadRequestException("answer_rating_invalid");
      }
      break;
    }
    case "grid_single":
    case "grid_multiple": {
      const rows = question.config?.rows ?? [];
      const columns = new Set((question.config?.columns ?? []).map((option) => option.value));
      const grid = content.grid;
      if (typeof grid !== "object" || grid === null) {
        throw new BadRequestException("answer_grid_invalid");
      }
      const values = grid as Record<string, unknown>;
      const rowValues = new Set(rows.map((row) => row.value));
      for (const [rowValue, answer] of Object.entries(values)) {
        if (!rowValues.has(rowValue)) {
          throw new BadRequestException("answer_grid_invalid");
        }
        if (question.questionType === "grid_single") {
          if (typeof answer !== "string" || !columns.has(answer)) {
            throw new BadRequestException("answer_grid_invalid");
          }
        } else if (
          !Array.isArray(answer) ||
          !answer.every((value) => typeof value === "string" && columns.has(value)) ||
          hasDuplicateValues(answer as string[])
        ) {
          throw new BadRequestException("answer_grid_invalid");
        }
      }
      if (
        question.isRequired &&
        rows.some((row) => {
          const answer = values[row.value];
          return answer === undefined || (Array.isArray(answer) && answer.length === 0);
        })
      ) {
        throw new BadRequestException("required_answer_missing");
      }
      break;
    }
    case "file_upload": {
      const assetIds = Array.isArray(content.assetIds)
        ? content.assetIds
        : typeof content.assetId === "string"
          ? [content.assetId]
          : [];
      if (
        !assetIds.every((assetId) => typeof assetId === "string" && /^\d+$/.test(assetId)) ||
        hasDuplicateValues(assetIds as string[]) ||
        assetIds.length > (question.config?.maxFiles ?? 1)
      ) {
        throw new BadRequestException("survey_file_upload_invalid");
      }
      break;
    }
    case "date": {
      if (typeof content.date !== "string" || !isValidDateOnly(content.date)) {
        throw new BadRequestException("answer_content_invalid");
      }
      break;
    }
    case "time": {
      if (typeof content.time !== "string" || !TIME_PATTERN.test(content.time)) {
        throw new BadRequestException("answer_content_invalid");
      }
      break;
    }
    case "datetime": {
      if (
        typeof content.datetime !== "string" ||
        !Number.isFinite(Date.parse(content.datetime))
      ) {
        throw new BadRequestException("answer_content_invalid");
      }
      break;
    }
    default:
      throw new BadRequestException("question_type_invalid");
  }
}

export function validateSurveyAnswers(
  questions: SurveyQuestionRecord[],
  answers: SubmitResponseDto["answers"],
): void {
  const questionById = new Map(questions.map((question) => [question.id, question]));
  const answerByQuestionId = new Map<string, Record<string, unknown>>();

  for (const answerInput of answers) {
    if (answerByQuestionId.has(answerInput.questionId)) {
      throw new BadRequestException("duplicate_answer");
    }

    const question = questionById.get(answerInput.questionId);
    if (!question) {
      throw new BadRequestException("question_not_found");
    }

    validateAnswerContent(question, answerInput.content);
    answerByQuestionId.set(answerInput.questionId, answerInput.content);
  }

  for (const question of questions) {
    if (
      question.isRequired &&
      (!answerByQuestionId.has(question.id) ||
        isSurveyAnswerEmpty(question, answerByQuestionId.get(question.id) ?? {}))
    ) {
      throw new BadRequestException("required_answer_missing");
    }
  }
}
