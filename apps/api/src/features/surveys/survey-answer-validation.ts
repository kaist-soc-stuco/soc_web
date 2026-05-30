import { BadRequestException, ConflictException } from "@nestjs/common";

import type { SubmitResponseDto } from "./dto/submit-response.dto";
import type { SurveyQuestionRecord } from "./entities/survey-question.entity";

function isEmptyAnswer(
  question: SurveyQuestionRecord,
  content: Record<string, unknown>,
): boolean {
  if (question.questionType === "multiple_choice") {
    return !Array.isArray(content.values) || content.values.length === 0;
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
  if (!question.isRequired && isEmptyAnswer(question, content)) {
    return;
  }

  if (question.isRequired && isEmptyAnswer(question, content)) {
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
        !content.values.every((value) => typeof value === "string" && optionValues.has(value))
      ) {
        throw new BadRequestException("answer_option_invalid");
      }
      break;
    }
    case "date": {
      if (typeof content.date !== "string") {
        throw new BadRequestException("answer_content_invalid");
      }
      break;
    }
    case "time": {
      if (typeof content.time !== "string") {
        throw new BadRequestException("answer_content_invalid");
      }
      break;
    }
    case "datetime": {
      if (typeof content.datetime !== "string") {
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
  currentMs: number,
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

    if (question.editDeadlineAt && Date.parse(question.editDeadlineAt) <= currentMs) {
      throw new ConflictException("question_edit_deadline_passed");
    }

    validateAnswerContent(question, answerInput.content);
    answerByQuestionId.set(answerInput.questionId, answerInput.content);
  }

  for (const question of questions) {
    if (
      question.isRequired &&
      (!answerByQuestionId.has(question.id) ||
        isEmptyAnswer(question, answerByQuestionId.get(question.id) ?? {}))
    ) {
      throw new BadRequestException("required_answer_missing");
    }
  }
}
