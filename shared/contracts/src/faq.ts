export const FAQ_CATEGORIES = [
  {
    key: "account",
    titleKo: "계정·이용",
    titleEn: "Account & access",
    titles: new Set([
      "KAIST 계정으로 어떻게 로그인하나요?",
      "게시글·댓글 작성 권한은 어떻게 되나요?",
      "프로필 정보가 잘못 표시되면 어떻게 하나요?",
      "계정 비활성화 안내가 표시되면 어떻게 하나요?",
    ]),
  },
  {
    key: "fees",
    titleKo: "과비 납부",
    titleEn: "Student fees",
    titles: new Set([
      "과비는 어떻게 납부하나요?",
      "제 과비 납부 여부는 어디서 확인하나요?",
      "과비를 환급받을 수 있나요?",
    ]),
  },
  {
    key: "events-surveys",
    titleKo: "행사·설문",
    titleEn: "Events & surveys",
    titles: new Set([
      "행사·일정은 어디서 확인하나요?",
      "행사는 어떻게 신청하나요?",
      "행사 신청을 수정하거나 취소하려면 어떻게 하나요?",
      "설문이나 투표에 참여할 수 없다고 표시되는 이유는 무엇인가요?",
    ]),
  },
  {
    key: "other",
    titleKo: "기타",
    titleEn: "Other",
    titles: new Set([
      "학생회에 사업이나 정책을 건의하려면 어떻게 하나요?",
      "비밀 건의사항과 공식 답변은 누가 볼 수 있나요?",
      "댓글이나 공식 답변 알림은 어디서 확인하나요?",
      "사이트 오류는 어떻게 신고하나요?",
      "행사나 동아리 홍보글 게시를 요청하려면 어떻게 하나요?",
      "학번별 단체 카카오톡방에 참여하려면 어떻게 하나요?",
      "졸업 요건과 교과목 이수 순서는 어디서 확인하나요?",
      "연구실, 교수진, 시설 정보는 어디서 확인하나요?",
      "집행위원회 모집은 언제 하나요?",
      "학생회 활동인증서는 어디에 요청하나요?",
      "기업 후원이나 제휴를 제안하려면 어떻게 하나요?",
      "전산학부 학생회칙은 어디서 확인하나요?",
    ]),
  },
] as const;

export type FaqCategory = (typeof FAQ_CATEGORIES)[number]["key"];

/** Preserve categorization of legacy seed FAQs until a category is explicitly saved. */
export function resolveFaqCategory(item: {
  titleKo: string;
  faqCategory?: FaqCategory | null;
}): FaqCategory {
  return (
    item.faqCategory ??
    FAQ_CATEGORIES.find((category) => category.titles.has(item.titleKo))?.key ??
    "other"
  );
}
