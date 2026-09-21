import { isSurveyDisplayBlock, type SurveyQuestionRecord } from "@soc/contracts";
import { isAnswerFilled, type AnswerValue } from "./survey-answer-utils";

function testPattern(pattern: string, text: string): Promise<boolean> {
  return new Promise(resolve => {
    let worker: Worker;
    try { worker = new Worker(new URL("./survey-regex.worker.ts", import.meta.url), { type: "module" }); }
    catch { resolve(false); return; }
    const finish = (valid: boolean) => { clearTimeout(timer); worker.terminate(); resolve(valid); };
    const timer = setTimeout(() => finish(false), 1000);
    worker.onmessage = event => finish(event.data === true);
    worker.onerror = () => finish(false);
    worker.postMessage({ pattern, text });
  });
}
function numeric(value: number, operator: string | undefined, threshold?: number, maximum?: number) {
  if (!Number.isFinite(value)) return false;
  if (operator === "is_number") return true;
  if (operator === "integer") return Number.isInteger(value);
  if (!Number.isFinite(threshold)) return false;
  switch (operator) {
    case "equal": return value === threshold;
    case "not_equal": return value !== threshold;
    case "greater": return value > threshold!;
    case "less": return value < threshold!;
    case "max": case "max_length": case "less_or_equal": return value <= threshold!;
    case "between": return Number.isFinite(maximum) && value >= threshold! && value <= maximum!;
    case "not_between": return Number.isFinite(maximum) && (value < threshold! || value > maximum!);
    default: return value >= threshold!;
  }
}
export async function getResponseError(question: Pick<SurveyQuestionRecord, "questionType" | "isRequired" | "config"> & Partial<Pick<SurveyQuestionRecord, "answerRegex">>, value: AnswerValue | undefined, lang: string): Promise<string | null> {
  if (isSurveyDisplayBlock(question.questionType)) return null;
  if (!isAnswerFilled(question.questionType, value)) return question.isRequired ? (lang === "ko" ? "필수 질문입니다." : "This question is required.") : null;
  const config = question.config;
  const type = config?.validationType === "text" ? config.validationTextType ?? "length" : config?.validationType ?? (question.answerRegex ? "regex" : undefined);
  const operator = config?.validationOperator ?? "min";
  const conditionLabel: Record<string, string> = { min: "최소", min_length: "최소", greater_or_equal: "이상", max: "최대", max_length: "최대", less_or_equal: "이하", equal: "정확히", not_equal: "제외", greater: "초과", less: "미만", between: "범위", not_between: "범위 밖", integer: "정수", is_number: "숫자" };
  const condition = `${conditionLabel[operator] ?? operator} ${config?.validationValue ?? ""}${config?.validationValueMax !== undefined ? ` ~ ${config.validationValueMax}` : ""}`.trim();
  let valid = true;
  let hint = lang === "ko" ? "안내된 형식에 맞게 입력해 주세요." : "Please use the requested format.";
  if (typeof value === "string" && (question.questionType === "short_text" || question.questionType === "long_text")) {
    if (value.length > 10000) return lang === "ko" ? "10,000자 이하로 입력해 주세요." : "Please enter no more than 10,000 characters.";
    if (type === "regex" && question.answerRegex) valid = value.length <= 10000 && await testPattern(question.answerRegex, value);
    if (type === "length" || type === "number") {
      valid = numeric(type === "length" ? value.length : Number(value.trim()), config?.validationOperator, config?.validationValue, config?.validationValueMax);
      hint = lang === "ko" ? `입력 ${type === "length" ? "길이" : "숫자"} 조건을 확인해 주세요 (${condition}).` : "Please check the required length or number range.";
    }
  }
  if (Array.isArray(value) && type === "checkbox_count") {
    valid = numeric(value.length, config?.validationOperator, config?.validationValue);
    hint = lang === "ko" ? `선택 개수 조건을 확인해 주세요 (${condition}).` : "Please check the required number of selections.";
  }
  if (question.isRequired && typeof value === "object" && value !== null && "kind" in value && value.kind === "grid") {
    valid = (config?.rows ?? []).every(row => { const selection = value.values[row.value]; return Array.isArray(selection) ? selection.length > 0 : Boolean(selection); });
    hint = lang === "ko" ? "각 행에 응답해 주세요." : "Please answer every row.";
  }
  return valid ? null : config?.validationErrorMessage?.trim() || hint;
}
