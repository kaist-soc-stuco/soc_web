import type {
  QuestionType,
  SurveyAnswerRecord,
  SurveyDetailResponse,
} from "@soc/contracts";
import { isoToDate, nowDate } from "@soc/shared";

import { formatNumericDate } from "@/lib/date-display";

export type GridAnswer = Record<string, string | string[]>;
export interface FileAnswer {
  assetId: string;
  fileName: string;
  sizeBytes?: number;
  mimeType?: string;
}
export interface FileAnswerValue {
  kind: "file";
  files: FileAnswer[];
}
export type AnswerValue =
  | string
  | string[]
  | { kind: "grid"; values: GridAnswer }
  | FileAnswerValue;

export function emptyAnswerValue(type: QuestionType): AnswerValue {
  if (type === "multiple_choice") return [];
  if (type === "rating") return "";
  if (type === "grid_single" || type === "grid_multiple") {
    return { kind: "grid", values: {} };
  }
  if (type === "file_upload") return { kind: "file", files: [] };
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
    case "rating":
      return { rating: value as string };
    case "grid_single":
    case "grid_multiple":
      return { grid: (value as { kind: "grid"; values: GridAnswer }).values };
    case "file_upload": {
      const files = (value as FileAnswerValue).files;
      if (files.length === 0) return {};
      return {
        assetId: files[0]?.assetId,
        assetIds: files.map((file) => file.assetId),
        files: files.map((file) => ({
          assetId: file.assetId,
          fileName: file.fileName,
          sizeBytes: file.sizeBytes,
          mimeType: file.mimeType,
        })),
        fileName: files[0]?.fileName,
        sizeBytes: files[0]?.sizeBytes,
        mimeType: files[0]?.mimeType,
      };
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
    if (type === "file_upload") return { kind: "file", files: [] };
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
  if (type === "rating") {
    return typeof content.rating === "string" ? content.rating : "";
  }
  if (type === "grid_single" || type === "grid_multiple") {
    const grid = content.grid;
    return grid && typeof grid === "object"
      ? { kind: "grid", values: grid as GridAnswer }
      : { kind: "grid", values: {} };
  }
  if (type === "file_upload") {
    const metadata = Array.isArray(content.files)
      ? content.files.filter(
          (file): file is Record<string, unknown> =>
            typeof file === "object" && file !== null,
        )
      : [];
    const assetIds = Array.isArray(content.assetIds)
      ? content.assetIds.filter((assetId): assetId is string => typeof assetId === "string")
      : typeof content.assetId === "string"
        ? [content.assetId]
        : [];
    const files = assetIds.map((assetId, index) => {
      const file = metadata[index];
      return {
        assetId,
        fileName:
          typeof file?.fileName === "string"
            ? file.fileName
            : index === 0 && typeof content.fileName === "string"
              ? content.fileName
              : "uploaded-file",
        sizeBytes:
          typeof file?.sizeBytes === "number"
            ? file.sizeBytes
            : index === 0 && typeof content.sizeBytes === "number"
              ? content.sizeBytes
              : undefined,
        mimeType:
          typeof file?.mimeType === "string"
            ? file.mimeType
            : index === 0 && typeof content.mimeType === "string"
              ? content.mimeType
              : undefined,
      };
    });
    return { kind: "file", files };
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
      Array.isArray(value.files) &&
      value.files.length > 0 &&
      value.files.every((file) => Boolean(file.assetId))
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

function formatSurveyDateWithTime(
  iso: string,
  lang: string,
  referenceDate: Date,
) {
  const date = isoToDate(iso);
  if (Number.isNaN(date.getTime())) return "";

  const dateText = formatNumericDate(date, referenceDate);
  const weekday = new Intl.DateTimeFormat(lang === "ko" ? "ko-KR" : "en-US", {
    weekday: "short",
  }).format(date);
  const time = new Intl.DateTimeFormat(lang === "ko" ? "ko-KR" : "en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);

  return `${dateText} (${weekday}) ${time}`;
}

export function formatSurveyPeriod(
  opensAt: string | null | undefined,
  closesAt: string | null | undefined,
  lang: string,
  referenceDate: Date = nowDate(),
) {
  const start = opensAt
    ? formatSurveyDateWithTime(opensAt, lang, referenceDate)
    : "";
  const end = closesAt
    ? formatSurveyDateWithTime(closesAt, lang, referenceDate)
    : "";

  if (start && end) return `${start} ～ ${end}`;
  if (end) return lang === "ko" ? `${end} 마감` : `Closes ${end}`;
  if (start) return lang === "ko" ? `${start} 시작` : `Opens ${start}`;
  return lang === "ko" ? "상시 응답 가능" : "Always open";
}

export function getLocalizedText(
  lang: string,
  ko: string | null | undefined,
  en: string | null | undefined,
) {
  return lang === "ko" ? (ko ?? "") : en || ko || "";
}

export function getSurveyKindLabel(kind: string, lang: string) {
  if (kind === "APPLICATION") {
    return lang === "ko" ? "행사 신청" : "Event application";
  }
  return lang === "ko" ? "일반 설문" : "Survey";
}

export function getAudienceLabel(survey: SurveyDetailResponse, lang: string) {
  if (survey.allowAnonymous) {
    return lang === "ko" ? "로그인 없이 참여 가능" : "No sign-in required";
  }
  const affiliations = survey.eligibleSocAffiliations.map((item) => {
    return lang !== "ko" ? "primary major" : "주전공";
  });
  const parts: string[] = [];
  if (affiliations.length > 0) {
    parts.push(lang === "ko" ? `전산학부 ${affiliations.join("·")}` : `School of Computing ${affiliations.join(", ")}`);
  }
  if (survey.academicEligibility === "ENROLLED_ONLY") {
    parts.push(lang === "ko" ? "재학생" : "enrolled students");
  } else if (survey.academicEligibility === "ENROLLED_OR_LEAVE") {
    parts.push(lang === "ko" ? "재학생·휴학생" : "enrolled or on leave");
  }
  if (survey.feePayersOnly) {
    parts.push(lang === "ko" ? "과비 납부자" : "fee-paying members");
  }
  return parts.length > 0 ? parts.join(" · ") : lang === "ko" ? "로그인 필요" : "Login required";
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
  return formatSurveyPeriod(survey.opensAt, survey.closesAt, lang);
}
