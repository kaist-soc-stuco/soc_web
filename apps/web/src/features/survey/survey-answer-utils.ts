import type {
  QuestionType,
  SurveyAnswerRecord,
  SurveyDetailResponse,
} from "@soc/contracts";
import { isoToDate } from "@soc/shared";

export type GridAnswer = Record<string, string | string[]>;
export interface FileAnswer {
  assetId: string;
  fileName: string;
  sizeBytes?: number;
  mimeType?: string;
}
export type AnswerValue =
  | string
  | string[]
  | { kind: "grid"; values: GridAnswer }
  | { kind: "file"; file: FileAnswer | null };

export function emptyAnswerValue(type: QuestionType): AnswerValue {
  if (type === "multiple_choice") return [];
  if (type === "grid_single" || type === "grid_multiple") {
    return { kind: "grid", values: {} };
  }
  if (type === "file_upload") return { kind: "file", file: null };
  return "";
}

export function toAnswerContent(
  type: QuestionType,
  value: AnswerValue,
): Record<string, unknown> {
  switch (type) {
    case "short_text":
    case "long_text":
      return { text: value as string };
    case "single_choice":
    case "dropdown":
      return { value: value as string };
    case "multiple_choice":
      return { values: value as string[] };
    case "grid_single":
    case "grid_multiple":
      return { grid: (value as { kind: "grid"; values: GridAnswer }).values };
    case "file_upload": {
      const file = (value as { kind: "file"; file: FileAnswer | null }).file;
      return file
        ? {
            assetId: file.assetId,
            fileName: file.fileName,
            sizeBytes: file.sizeBytes,
            mimeType: file.mimeType,
          }
        : {};
    }
    case "date":
      return { date: value as string };
    case "time":
      return { time: value as string };
    case "datetime":
      return { datetime: value as string };
    default:
      return { value };
  }
}

export function answerContentToValue(
  type: QuestionType,
  answer: SurveyAnswerRecord | undefined,
): AnswerValue {
  if (!answer) {
    if (type === "multiple_choice") return [];
    if (type === "grid_single" || type === "grid_multiple") {
      return { kind: "grid", values: {} };
    }
    if (type === "file_upload") return { kind: "file", file: null };
    return "";
  }
  const content = answer.content;

  if (type === "multiple_choice") {
    return Array.isArray(content.values)
      ? content.values.filter(
          (value): value is string => typeof value === "string",
        )
      : [];
  }
  if (type === "grid_single" || type === "grid_multiple") {
    const grid = content.grid;
    return grid && typeof grid === "object"
      ? { kind: "grid", values: grid as GridAnswer }
      : { kind: "grid", values: {} };
  }
  if (type === "file_upload") {
    return typeof content.assetId === "string"
      ? {
          kind: "file",
          file: {
            assetId: content.assetId,
            fileName:
              typeof content.fileName === "string"
                ? content.fileName
                : "uploaded-file",
            sizeBytes:
              typeof content.sizeBytes === "number"
                ? content.sizeBytes
                : undefined,
            mimeType:
              typeof content.mimeType === "string" ? content.mimeType : undefined,
          },
        }
      : { kind: "file", file: null };
  }
  if (type === "short_text" || type === "long_text") {
    return typeof content.text === "string" ? content.text : "";
  }
  if (type === "single_choice" || type === "dropdown") {
    return typeof content.value === "string" ? content.value : "";
  }
  if (type === "date") {
    return typeof content.date === "string" ? content.date : "";
  }
  if (type === "time") {
    return typeof content.time === "string" ? content.time : "";
  }
  if (type === "datetime") {
    return typeof content.datetime === "string" ? content.datetime : "";
  }
  return "";
}

export function isAnswerFilled(
  type: QuestionType,
  value: AnswerValue | undefined,
) {
  if (type === "multiple_choice") {
    return Array.isArray(value) && value.length > 0;
  }
  if (type === "grid_single" || type === "grid_multiple") {
    return (
      typeof value === "object" &&
      value !== null &&
      "kind" in value &&
      value.kind === "grid" &&
      Object.keys(value.values).length > 0
    );
  }
  if (type === "file_upload") {
    return (
      typeof value === "object" &&
      value !== null &&
      "kind" in value &&
      value.kind === "file" &&
      Boolean(value.file?.assetId)
    );
  }
  return typeof value === "string" && value.trim().length > 0;
}

export function formatSurveyDateTime(iso: string) {
  const date = isoToDate(iso);
  if (Number.isNaN(date.getTime())) return "";

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");

  return `${year}.${month}.${day} ${hour}:${minute}`;
}

export function getLocalizedText(
  lang: string,
  ko: string | null | undefined,
  en: string | null | undefined,
) {
  return lang === "ko" ? (ko ?? "") : en || ko || "";
}

export function getSurveyKindLabel(kind: string, lang: string) {
  if (kind === "VOTE") return lang === "ko" ? "투표" : "Vote";
  if (kind === "APPLICATION") {
    return lang === "ko" ? "신청서/행사 접수" : "Event application";
  }
  return lang === "ko" ? "일반 설문" : "Survey";
}

export function getAudienceLabel(survey: SurveyDetailResponse, lang: string) {
  if (survey.feePayersOnly) {
    return lang === "ko" ? "과비 납부자" : "Paid members";
  }
  return lang === "ko" ? "로그인 회원" : "Signed-in members";
}

export function getResponsePolicyLabel(
  survey: SurveyDetailResponse,
  lang: string,
) {
  const countPolicy = survey.allowMultipleResponses
    ? lang === "ko"
      ? "복수 응답 가능"
      : "Multiple submissions allowed"
    : lang === "ko"
      ? "1회만 응답 가능"
      : "One submission per user";
  const resultPolicy =
    survey.resultVisibility === "PUBLIC"
      ? lang === "ko"
        ? "결과 공개"
        : "Public results"
      : lang === "ko"
        ? "결과 비공개"
        : "Private results";

  return `${countPolicy} · ${resultPolicy}`;
}

export function getScheduleLabel(survey: SurveyDetailResponse, lang: string) {
  if (!survey.opensAt) {
    return lang === "ko" ? "상시 응답 가능" : "Always open";
  }

  const opensAt = formatSurveyDateTime(survey.opensAt);
  return lang === "ko" ? `${opensAt}부터` : `From ${opensAt}`;
}
