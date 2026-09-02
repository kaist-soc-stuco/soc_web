import { BadRequestException } from "@nestjs/common";

import type { SubmitResponseDto } from "./dto/submit-response.dto";
import type { SurveyQuestionRecord } from "./entities/survey-question.entity";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const YEARLESS_DATE_PATTERN = /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const DATETIME_LOCAL_PATTERN =
  /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d(?:\:[0-5]\d)?$/;
const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d(?:[:][0-5]\d)?$/;
const DURATION_PATTERN = /^\d{1,3}:[0-5]\d(?:[:][0-5]\d)?$/;

function isValidDateOnly(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  if (month < 1 || month > 12) return false;
  const isLeapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, isLeapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  return day >= 1 && day <= daysInMonth;
}

function isValidYearlessDate(value: string): boolean {
  if (!YEARLESS_DATE_PATTERN.test(value)) return false;
  const [, monthText, dayText] = value.match(YEARLESS_DATE_PATTERN) ?? [];
  const month = Number(monthText);
  const day = Number(dayText);
  const daysInMonth = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  return day >= 1 && day <= daysInMonth;
}

function isValidDatetimeLocal(value: string): boolean {
  return DATETIME_LOCAL_PATTERN.test(value) && Number.isFinite(Date.parse(value));
}

type ValidationOperator =
  | "min"
  | "max"
  | "equal"
  | "greater"
  | "greater_or_equal"
  | "less"
  | "less_or_equal"
  | "not_equal"
  | "between"
  | "not_between"
  | "is_number"
  | "integer"
  | "min_length"
  | "max_length";

function passesNumericValidation(
  value: number,
  operator: ValidationOperator | undefined,
  threshold: number | undefined,
  thresholdMax?: number,
): boolean {
  switch (operator ?? "min") {
    case "is_number":
      return Number.isFinite(value);
    case "integer":
      return Number.isInteger(value);
    case "greater":
      return Number.isFinite(value) && Number.isFinite(threshold) && value > threshold!;
    case "greater_or_equal":
      return Number.isFinite(value) && Number.isFinite(threshold) && value >= threshold!;
    case "less":
      return Number.isFinite(value) && Number.isFinite(threshold) && value < threshold!;
    case "less_or_equal":
      return Number.isFinite(value) && Number.isFinite(threshold) && value <= threshold!;
    case "not_equal":
      return Number.isFinite(value) && Number.isFinite(threshold) && value !== threshold!;
    case "between":
      return (
        Number.isFinite(value) &&
        Number.isFinite(threshold) &&
        Number.isFinite(thresholdMax) &&
        value >= threshold! &&
        value <= thresholdMax!
      );
    case "not_between":
      return (
        Number.isFinite(value) &&
        Number.isFinite(threshold) &&
        Number.isFinite(thresholdMax) &&
        (value < threshold! || value > thresholdMax!)
      );
    case "min_length":
    case "min":
      return Number.isFinite(value) && Number.isFinite(threshold) && value >= threshold!;
    case "max_length":
    case "max":
      return Number.isFinite(value) && Number.isFinite(threshold) && value <= threshold!;
    case "equal":
      return Number.isFinite(value) && Number.isFinite(threshold) && value === threshold!;
    default:
      return false;
  }
}

function validationError(
  question: SurveyQuestionRecord,
  fallback = "answer_validation_mismatch",
): BadRequestException {
  return new BadRequestException(
    question.config?.validationErrorMessage?.trim() || fallback,
  );
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
      const configuredValidationType = question.config?.validationType ??
        (question.answerRegex ? "regex" : undefined);
      const validationType = configuredValidationType === "text"
        ? question.config?.validationTextType ?? "length"
        : configuredValidationType;
      const validationOperator =
        validationType === "length" && question.config?.validationOperator === "min"
          ? "min_length"
          : validationType === "length" && question.config?.validationOperator === "max"
            ? "max_length"
            : question.config?.validationOperator;
      if (validationType === "regex" && question.answerRegex) {
        try {
          if (!new RegExp(question.answerRegex).test(content.text)) {
            throw validationError(question, "answer_regex_mismatch");
          }
        } catch (error) {
          if (error instanceof BadRequestException) throw error;
          throw new BadRequestException("answer_regex_invalid");
        }
      }
      if (validationType === "length" && !passesNumericValidation(
        content.text.length,
        validationOperator,
        question.config?.validationValue,
      )) {
        throw validationError(question);
      }
      if (validationType === "number") {
        const numericValue = Number(content.text.trim());
        if (!passesNumericValidation(
          numericValue,
          validationOperator,
          question.config?.validationValue,
          question.config?.validationValueMax,
        )) {
          throw validationError(question);
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
      if (
        question.config?.validationType === "checkbox_count" &&
        !passesNumericValidation(
          (content.values as string[]).length,
          question.config.validationOperator,
          question.config.validationValue,
        )
      ) {
        throw validationError(question);
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
      const dateValue = content.date;
      const isValid =
        typeof dateValue === "string" &&
        (question.config?.dateIncludeTime
          ? isValidDatetimeLocal(dateValue)
          : question.config?.dateIncludeYear === false
            ? isValidYearlessDate(dateValue)
            : isValidDateOnly(dateValue));
      if (!isValid) {
        throw new BadRequestException("answer_content_invalid");
      }
      break;
    }
    case "time": {
      const timeValue = content.time;
      const isValid =
        typeof timeValue === "string" &&
        (question.config?.timeAnswerType === "duration"
          ? DURATION_PATTERN.test(timeValue)
          : TIME_PATTERN.test(timeValue));
      if (!isValid) {
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
