const messages: Record<string, string> = {
  survey_english_title_required: "설문의 영문 제목을 입력하거나 설정에서 한국어 전용을 선택해 주세요.",
  survey_question_english_title_required: "모든 질문의 영문 제목을 입력하거나 설정에서 한국어 전용을 선택해 주세요.",
  survey_requires_section: "게시하려면 섹션을 하나 이상 추가해 주세요.",
  survey_requires_question: "게시하려면 응답을 받는 질문을 하나 이상 추가해 주세요.",
  survey_choice_requires_option: "선택형 질문에 선택지를 하나 이상 추가해 주세요.",
  survey_grid_requires_rows: "그리드 질문에 행을 하나 이상 추가해 주세요.",
  survey_grid_requires_columns: "그리드 질문에 열을 하나 이상 추가해 주세요.",
  survey_invalid_schedule: "종료 시각은 시작 시각 이후로 설정해 주세요.",
  survey_question_has_answers: "응답이 있는 질문은 삭제할 수 없습니다. 설문을 복제해 수정해 주세요.",
  survey_section_has_answers: "응답이 있는 섹션은 삭제할 수 없습니다. 설문을 복제해 수정해 주세요.",
  survey_branch_must_target_later_section: "섹션 이동 경로는 현재 섹션보다 뒤에 있는 섹션만 선택할 수 있습니다.",
  survey_branch_target_section_in_use: "다른 문항의 이동 경로에서 사용 중인 섹션은 삭제할 수 없습니다.",
};

export function surveyEditorErrorMessage(code: string | undefined, status: number | undefined, fallback: string): string {
  if (code && messages[code]) return messages[code];
  if (status === 401) return "로그인 세션이 만료되었습니다. 다시 로그인해 주세요.";
  if (status === 403) return "이 설문을 수정하거나 게시할 권한이 없습니다.";
  if (status === 429) return "요청이 잠시 집중되었습니다. 잠시 후 다시 시도해 주세요.";
  return fallback;
}
