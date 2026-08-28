import type { SurveyAnswerRecord, SurveyQuestionRecord } from "@soc/contracts";
import { formatKoreanDateTime } from "@soc/shared";

function localizedLabel(
  option: { labelKo: string; labelEn?: string | null } | undefined,
  lang: "ko" | "en",
) {
  if (!option) return "";
  return lang === "en" ? option.labelEn || option.labelKo : option.labelKo;
}

export function formatSurveyAnswer(
  answer: SurveyAnswerRecord | undefined,
  question: SurveyQuestionRecord,
  lang: "ko" | "en" = "ko",
): string {
  if (!answer?.content) return "";
  const content = answer.content;
  const options = question.options ?? [];
  const optionByValue = new Map(options.map((option) => [option.value, option]));

  if (question.questionType === "single_choice" || question.questionType === "dropdown") {
    const value = typeof content.value === "string" ? content.value : "";
    return localizedLabel(optionByValue.get(value), lang) || value;
  }

  if (question.questionType === "multiple_choice") {
    const values = Array.isArray(content.values) ? content.values.filter((value): value is string => typeof value === "string") : [];
    return values.map((value) => localizedLabel(optionByValue.get(value), lang) || value).join(", ");
  }

  if (question.questionType === "rating") {
    const value = content.rating;
    return typeof value === "string" || typeof value === "number" ? String(value) : "";
  }

  if (question.questionType === "grid_single" || question.questionType === "grid_multiple") {
    const rows = question.config?.rows ?? [];
    const columns = question.config?.columns ?? [];
    const columnByValue = new Map(columns.map((column) => [column.value, column]));
    const grid = content.grid && typeof content.grid === "object"
      ? content.grid as Record<string, unknown>
      : {};
    return rows.flatMap((row) => {
      const selected = grid[row.value];
      const values = Array.isArray(selected) ? selected : typeof selected === "string" ? [selected] : [];
      if (values.length === 0) return [];
      const labels = values.map((value) => localizedLabel(columnByValue.get(String(value)), lang) || String(value));
      return [`${localizedLabel(row, lang)}: ${labels.join(", ")}`];
    }).join(" | ");
  }

  if (question.questionType === "file_upload") {
    if (Array.isArray(content.files)) {
      const names = content.files
        .filter((file): file is Record<string, unknown> => typeof file === "object" && file !== null)
        .map((file) => typeof file.fileName === "string" ? file.fileName : "첨부 파일");
      if (names.length > 0) return names.join(", ");
    }
    if (Array.isArray(content.assetIds)) {
      const count = content.assetIds.filter((assetId) => typeof assetId === "string").length;
      if (count > 0) return lang === "ko" ? `첨부 파일 ${count}개` : `${count} attached files`;
    }
    return typeof content.fileName === "string" ? content.fileName : lang === "ko" ? "첨부 파일" : "Attached file";
  }

  if (typeof content.text === "string") return content.text;
  if (typeof content.date === "string") return content.date;
  if (typeof content.time === "string") return content.time;
  if (typeof content.datetime === "string") {
    try {
      return formatKoreanDateTime(content.datetime);
    } catch {
      return content.datetime;
    }
  }
  return "";
}
