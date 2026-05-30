const assert = require("node:assert/strict");
const test = require("node:test");

const {
  getVisibleTextResponses,
  sortChoiceResults,
} = require("../dist/test-src/lib/survey-results-display.js");

test("shows first 10 short text answers for long dummy survey results", () => {
  const longTitle =
    "2026 전산학부 학생회 행사 만족도 및 향후 프로그램 선호도 조사 - 매우 긴 제목 렌더링 검증";
  const longDescription =
    "이 설문은 행사 운영 품질, 공지 전달 방식, 참여 장벽, 향후 프로그램 주제 선호를 함께 확인하기 위한 긴 설명입니다. 실제 서비스에서 구글 폼을 대체할 수 있도록 긴 안내문과 긴 답변을 안정적으로 다루는지 검증합니다.";
  const longAnswers = Array.from({ length: 13 }, (_, index) =>
    `${index + 1}. 행사 안내가 충분히 명확했고, 다만 신청 마감 알림과 장소 안내가 조금 더 일찍 제공되면 좋겠습니다.`,
  );

  assert.ok(longTitle.length > 40);
  assert.ok(longDescription.length > 80);

  const result = getVisibleTextResponses(longAnswers, "short_text", false);

  assert.equal(result.visibleTexts.length, 10);
  assert.equal(result.hiddenCount, 3);
  assert.match(result.visibleTexts[0], /행사 안내/);
});

test("shows all long text answers as paragraph responses", () => {
  const longAnswers = [
    "첫 번째 장문 응답입니다.\n운영진의 안내가 좋았고 다음에는 네트워킹 시간이 더 길면 좋겠습니다.",
    "두 번째 장문 응답입니다. 긴 문단이 카드 내부 박스 없이 문단 리스트로 표시되는 상황을 검증합니다.",
  ];

  const result = getVisibleTextResponses(longAnswers, "long_text", false);

  assert.deepEqual(result.visibleTexts, longAnswers);
  assert.equal(result.hiddenCount, 0);
});

test("sorts choice rows without changing respondent-based percentages", () => {
  const choices = [
    { value: "a", labelKo: "긴 선택지 A", labelEn: null, count: 4, percentage: 40 },
    { value: "b", labelKo: "긴 선택지 B", labelEn: null, count: 9, percentage: 90 },
    { value: "c", labelKo: "긴 선택지 C", labelEn: null, count: 1, percentage: 10 },
  ];

  const result = sortChoiceResults(choices);

  assert.deepEqual(result.map((choice) => choice.value), ["b", "a", "c"]);
  assert.equal(result[0].percentage, 90);
});
