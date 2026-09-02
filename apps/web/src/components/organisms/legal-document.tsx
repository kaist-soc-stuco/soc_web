import { Header } from "@/components/organisms/header";
import { Footer } from "@/components/organisms/footer";
import { useLanguage, type Language } from "@/hooks/use-language";
import { PageContainer, PageHeader, PageMain, PageShell } from "@/components/ui/page-layout";
import { useLayoutEffect } from "react";

type LegalText = Readonly<{
  ko: string;
  en: string;
}>;

type LegalGroup = Readonly<{
  kind?: "required" | "optional";
  label: LegalText;
  value: LegalText;
}>;

type LegalSection = Readonly<{
  id: string;
  number: number;
  title: LegalText;
  paragraphs?: readonly LegalText[];
  bullets?: readonly LegalText[];
  groups?: readonly LegalGroup[];
}>;

type LegalDocument = Readonly<{
  title: LegalText;
  summary: LegalText;
  versionLabel: LegalText;
  sectionsLabel: LegalText;
  sections: readonly LegalSection[];
}>;

const t = (ko: string, en: string): LegalText => ({ ko, en });

const EFFECTIVE_DATE = "2026.08.29";
const OPERATOR_NAME = "KAIST 전산학부 집행위원회";
const OPERATOR_NAME_EN = "SoC Student Council, School of Computing, KAIST";
const CONTACT_EMAIL = "kaist.helloworld@gmail.com";

/*
 * 본 문서는 현재 저장소의 서비스 흐름을 기준으로 작성한 참고용 문안입니다.
 * 실제 공개 전 운영 주체, 처리위탁자, 보존기간과 법률 검토를 확정해야 합니다.
 */

const termsSections: readonly LegalSection[] = [
  {
    id: "purpose",
    number: 1,
    title: t("목적과 서비스의 범위", "Purpose and scope"),
    paragraphs: [
      t(
        "이 약관은 KAIST 전산학부 집행위원회(이하 ‘운영자’)가 운영하는 웹사이트와 관련 기능(이하 ‘서비스’)의 이용 조건과 절차, 이용자와 운영자의 권리·의무를 정합니다.",
        "These Terms define the conditions and procedures for using the website and related features operated by the SoC Student Council of KAIST (the “Operator”), as well as the rights and responsibilities of the Operator and users.",
      ),
      t(
        "서비스에는 게시판, 공지, 행사·일정, 설문·투표, 댓글, 좋아요·스크랩, 학생회비 납부 관리, 운영자용 콘텐츠·구성원·메일·권한 관리 기능이 포함됩니다. 공개 열람 기능은 로그인 없이 제공될 수 있고, 작성·응답·투표·마이페이지 등 일부 기능은 로그인과 자격 확인이 필요합니다.",
        "The Service includes boards, notices, events and schedules, surveys and votes, comments, likes and scraps, student-fee administration, and operator tools for content, members, email, and permissions. Public browsing may be available without signing in, while posting, responding, voting, and account features may require sign-in and eligibility checks.",
      ),
    ],
  },
  {
    id: "definitions",
    number: 2,
    title: t("용어의 정의", "Definitions"),
    paragraphs: [
      t(
        "이 약관에서 사용하는 용어의 뜻은 다음과 같습니다.",
        "The following terms have the meanings set out below.",
      ),
    ],
    bullets: [
      t(
        "‘이용자’란 서비스에 접속하여 서비스를 이용하는 모든 사람을 말합니다.",
        "A ‘User’ is anyone who accesses or uses the Service.",
      ),
      t(
        "‘회원’이란 KAIST SSO로 로그인하고 필요한 개인정보 저장에 동의하여 서비스 이용을 위해 계정이 저장된 이용자를 말합니다.",
        "A “Member” is a User who signs in through KAIST SSO and agrees to the storage of the information needed to use Member features.",
      ),
      t(
        "‘콘텐츠’란 이용자가 작성한 게시글, 댓글·대댓글, 설문 응답, 투표 참여 정보, 첨부파일 및 운영자가 게시한 공지·행사·안내를 말합니다.",
        "“Content” means posts, comments and replies, survey responses, voting participation information, attachments created or submitted by Users, and notices, events, and guidance published by the Operator.",
      ),
    ],
  },
  {
    id: "effect-change",
    number: 3,
    title: t("약관의 효력과 변경", "Effect and changes to these Terms"),
    paragraphs: [
      t(
        "운영자는 서비스 화면과 이 페이지에 약관을 게시하여 이용자가 쉽게 확인할 수 있도록 합니다. 약관은 게시한 날 또는 별도로 정한 시행일부터 효력이 발생합니다.",
        "The Operator makes these Terms available through the Service and this page so that Users can review them easily. They take effect on the date of publication or on the separately stated effective date.",
      ),
      t(
        "운영자는 관련 법령, 서비스 운영상 필요 또는 기능 변경에 따라 약관을 변경할 수 있습니다. 중요한 변경은 적용일과 변경 사유를 미리 알리고, 변경 내용이 이용자에게 불리한 경우 합리적인 기간 동안 별도로 안내합니다.",
        "The Operator may amend these Terms when required by law, for Service operations, or because of feature changes. Material changes will be announced in advance with the effective date and reason, and changes unfavorable to Users will be separately highlighted for a reasonable period.",
      ),
      t(
        "변경된 약관에 동의하지 않는 이용자는 서비스 이용을 중단하고 문의할 수 있습니다. 변경 시행 후 서비스를 계속 이용하면 변경된 약관에 동의한 것으로 볼 수 있습니다.",
        "Users who do not agree to amended Terms may stop using the Service and contact the Operator. Continued use after the effective date may be treated as acceptance of the amended Terms.",
      ),
    ],
  },
  {
    id: "account",
    number: 4,
    title: t("회원 계정과 SSO 로그인", "Member accounts and SSO sign-in"),
    paragraphs: [
      t(
        "서비스는 KAIST SSO의 인증 결과를 이용해 회원을 식별합니다. 최초 로그인 시 개인정보 저장 동의를 선택할 수 있으며, 동의하지 않은 경우에는 개인정보를 장기 저장하지 않는 제한된 임시 세션만 제공될 수 있습니다.",
        "The Service identifies Members using authentication results from KAIST SSO. At the first sign-in, a User may choose whether to allow storage of personal information. Without consent, only a limited temporary session that does not persist a Member profile may be available.",
      ),
      t(
        "회원은 자신의 로그인 정보를 안전하게 관리하고, 계정을 다른 사람에게 양도하거나 공유해서는 안 됩니다. SSO에서 갱신된 프로필 정보가 있는 경우 운영자는 서비스 제공에 필요한 범위에서 계정 정보를 갱신할 수 있습니다.",
        "Members must keep their sign-in information secure and must not transfer or share their account. When SSO provides updated profile information, the Operator may update the account to the extent needed to provide the Service.",
      ),
      t(
        "회원은 본인의 정보가 사실과 다르거나 계정 사용이 정지된 사실을 알게 되면 지체 없이 운영자에게 알려야 합니다.",
        "Members must promptly notify the Operator if their information is inaccurate or if they learn that their account has been misused or suspended.",
      ),
    ],
  },
  {
    id: "service",
    number: 5,
    title: t("서비스 제공과 변경", "Provision and changes to the Service"),
    paragraphs: [
      t(
        "운영자는 게시판·행사·일정·설문·투표 등 학생자치 활동에 필요한 서비스를 운영합니다. 운영자는 유지보수, 보안, 장애 대응, 운영 정책 변경을 위해 서비스의 전부 또는 일부를 일시 중단하거나 기능을 변경할 수 있습니다.",
        "The Operator provides boards, events, schedules, surveys, votes, and other features needed for student council activities. The Operator may temporarily suspend all or part of the Service or change features for maintenance, security, incident response, or operational policy changes.",
      ),
      t(
        "행사 일정, 설문 기간, 투표 자격과 결과 공개 범위는 각 화면에 표시된 설정을 따릅니다. 서비스에 표시된 정보와 실제 운영 내용이 다를 때에는 운영자에게 확인해 주세요.",
        "Event schedules, survey periods, voting eligibility, and result visibility follow the settings shown on each page. If information shown in the Service differs from the actual operation, please confirm it with the Operator.",
      ),
    ],
  },
  {
    id: "duties",
    number: 6,
    title: t("이용자의 의무와 금지행위", "User duties and prohibited conduct"),
    paragraphs: [
      t(
        "이용자는 관련 법령, 이 약관, 화면에 표시된 이용 안내와 운영자의 합리적인 요청을 준수해야 합니다.",
        "Users must comply with applicable law, these Terms, instructions shown in the Service, and reasonable requests from the Operator.",
      ),
    ],
    bullets: [
      t(
        "타인의 개인정보·명예·저작권·상표권 등 권리를 침해하거나 타인을 사칭하는 행위",
        "Infringing another person’s privacy, reputation, copyright, trademark, or other rights, or impersonating another person",
      ),
      t(
        "허위 정보, 불법·차별·혐오·음란·협박·스팸 또는 서비스 목적에 맞지 않는 내용을 게시·전송하는 행위",
        "Posting or transmitting false, unlawful, discriminatory, hateful, obscene, threatening, spam, or otherwise inappropriate material",
      ),
      t(
        "권한 없이 관리자 기능·계정·데이터에 접근하거나 취약점을 악용하고, 정상적인 서비스 이용을 방해하는 행위",
        "Accessing operator features, accounts, or data without authorization, exploiting vulnerabilities, or disrupting normal operation",
      ),
      t(
        "투표·설문 참여를 조작하거나 자동화 도구로 반복 요청을 보내고, 다른 이용자의 참여를 방해하는 행위",
        "Manipulating votes or survey participation, sending repeated automated requests, or interfering with another User’s participation",
      ),
      t(
        "운영자의 사전 허가 없이 서비스의 데이터나 연락처를 수집하여 영리·홍보·제3자 제공에 이용하는 행위",
        "Collecting Service data or contact information without permission and using it for commercial purposes, promotion, or disclosure to a third party",
      ),
    ],
  },
  {
    id: "content",
    number: 7,
    title: t("이용자 콘텐츠와 공개 범위", "User Content and visibility"),
    paragraphs: [
      t(
        "이용자가 작성한 콘텐츠에 대한 권리는 원칙적으로 해당 이용자에게 있습니다. 이용자는 자신이 게시하거나 제출하는 콘텐츠에 필요한 권리를 보유하고 있으며, 제3자의 권리를 침해하지 않음을 보장해야 합니다.",
        "Users generally retain the rights to the Content they create. Users represent that they have the rights needed for Content they post or submit and that the Content does not infringe another person’s rights.",
      ),
      t(
        "이용자는 운영자에게 서비스 제공에 필요한 범위에서 콘텐츠를 저장·복제·전송·표시하고 형식을 변환할 수 있는 비독점적 이용 권한을 부여합니다. 이 권한은 콘텐츠가 서비스에 게시되거나 운영·분쟁 대응을 위해 필요한 기간 동안만 행사되며, 운영자가 콘텐츠의 소유권을 취득한다는 뜻은 아닙니다.",
        "Users grant the Operator a non-exclusive right to store, reproduce, transmit, display, and reformat Content as necessary to provide the Service. This right is exercised only while the Content is published or needed for operations and dispute handling; it does not transfer ownership of the Content to the Operator.",
      ),
      t(
        "공개 게시판의 콘텐츠는 다른 이용자에게 표시될 수 있습니다. 비밀글, 익명글, 설문 응답, 투표 참여 정보는 각 기능의 설정과 개인정보처리방침에 따라 공개 범위가 달라지며, 법령상 의무나 권리 보호를 위해 필요한 경우 제한적으로 확인될 수 있습니다.",
        "Content on a public board may be shown to other Users. Secret or anonymous posts, survey responses, and voting participation information have different visibility depending on feature settings and the Privacy Policy, and may be accessed on a limited basis when required by law or necessary to protect rights.",
      ),
    ],
  },
  {
    id: "moderation",
    number: 8,
    title: t("콘텐츠 관리와 이용 제한", "Content moderation and restrictions"),
    paragraphs: [
      t(
        "운영자는 신고, 법령 위반, 권리 침해, 보안 위험, 서비스 운영 방해 또는 운영 정책 위반이 확인되거나 합리적으로 의심되는 경우 해당 콘텐츠를 숨김·삭제·보관하거나 계정의 일부 기능을 제한할 수 있습니다.",
        "When a report, legal violation, rights infringement, security risk, disruption of the Service, or breach of operating policy is confirmed or reasonably suspected, the Operator may hide, remove, or archive the Content or restrict some account features.",
      ),
      t(
        "긴급한 피해 방지나 법령상 의무 이행이 필요한 경우에는 사전 통지 없이 조치할 수 있으며, 가능한 경우 조치 사유와 이의 제기 방법을 안내합니다. 운영자는 콘텐츠의 사전 검토나 항상 이용 가능한 상태를 보장하지 않습니다.",
        "The Operator may act without prior notice when necessary to prevent imminent harm or comply with law, and will explain the reason and an objection process where practicable. The Operator does not guarantee pre-screening of all Content or uninterrupted availability.",
      ),
    ],
  },
  {
    id: "participation",
    number: 9,
    title: t("설문·투표·행사 참여", "Surveys, votes, and events"),
    paragraphs: [
      t(
        "설문과 투표는 게시자가 설정한 기간, 응답 횟수, 주전공·학적상태·학생회비 납부 여부 등 참여 조건에 따라 이용할 수 있습니다. 이용자는 참여 전에 본인의 자격과 입력 내용을 확인해야 하며, 조건을 충족하지 못한 경우 참여가 제한될 수 있습니다.",
        "Surveys and votes are available according to the period, response limit, and eligibility rules set by their publisher, including primary-major, academic-status, and student-fee conditions. Users must check their eligibility and entries before participating; participation may be restricted when requirements are not met.",
      ),
      t(
        "투표의 비밀성과 결과의 신뢰성을 위해 투표자격 명부와 실제 투표 내용은 분리하여 관리될 수 있습니다. 설문 결과는 게시자가 정한 공개 범위에 따라 집계·표시됩니다.",
        "To protect ballot secrecy and result integrity, voter eligibility records and actual ballots may be managed separately. Survey results are aggregated and displayed according to the visibility selected by the publisher.",
      ),
      t(
        "행사 정보와 일정은 운영자의 사정 또는 주최자의 변경에 따라 달라질 수 있으므로, 이용자는 행사 참여 전에 최신 안내를 확인해야 합니다.",
        "Event information and schedules may change because of the Operator or host. Users should check the latest notice before attending an event.",
      ),
    ],
  },
  {
    id: "fees",
    number: 10,
    title: t("학생회비 납부 관리", "Student-fee administration"),
    paragraphs: [
      t(
        "서비스의 학생회비 기능은 총무 운영을 위한 수납 원장과 혜택 자격 확인을 관리하는 도구입니다. 실제 계좌이체·현금 납부 등 결제 행위 자체가 서비스 안에서 처리되는 것은 아니며, 운영자가 확인한 금액·납부일·납부 유형·결제 수단·적용 학기·비고가 기록될 수 있습니다.",
        "The student-fee feature is an administrative ledger used to verify payments and benefit eligibility. The actual bank-transfer or cash payment is not processed inside the Service; the Operator may record the verified amount, payment date, payment type, payment method, applicable semester, and notes.",
      ),
      t(
        "납부 기록에 오류가 있거나 차액·감면 사유를 확인해야 하는 경우 이용자는 운영자에게 문의해야 합니다. 납부 기록의 정정은 확인 절차와 회계·감사상 필요한 보존 범위를 고려하여 처리됩니다.",
        "If a payment record is inaccurate or a difference or reduction needs to be verified, the User should contact the Operator. Corrections are handled after verification and with regard to accounting, audit, and legally required retention.",
      ),
    ],
  },
  {
    id: "ip-links",
    number: 11,
    title: t("지식재산권과 외부 링크", "Intellectual property and external links"),
    paragraphs: [
      t(
        "운영자가 작성한 공식 문구, 로고, 디자인, 데이터베이스 구성과 서비스 소프트웨어에 관한 권리는 운영자 또는 정당한 권리자에게 있습니다. 이용자는 법령이나 운영자의 허용 범위를 벗어나 이를 복제·배포·변형·상업적으로 이용할 수 없습니다.",
        "Rights in official copy, logos, design, database structure, and Service software created by the Operator belong to the Operator or the relevant rights holder. Users may not copy, distribute, modify, or commercially use them beyond what law or the Operator permits.",
      ),
      t(
        "서비스에서 외부 사이트나 서비스로 연결되는 링크는 편의를 위한 것입니다. 외부 사이트의 운영, 콘텐츠, 개인정보 처리와 거래에 대해서는 해당 사이트의 정책이 적용되며 운영자가 이를 보증하지 않습니다.",
        "Links to external sites or services are provided for convenience. The external site’s policies govern its operation, Content, privacy practices, and transactions, which the Operator does not guarantee.",
      ),
    ],
  },
  {
    id: "privacy",
    number: 12,
    title: t("개인정보 보호", "Privacy"),
    paragraphs: [
      t(
        "운영자는 개인정보 보호법 등 관련 법령을 준수하며, 개인정보의 처리 목적·항목·보유기간·권리 행사 방법은 별도로 공개한 개인정보처리방침에 따릅니다.",
        "The Operator complies with applicable privacy laws. The purposes, data items, retention periods, and rights procedures for personal information are described in the separately published Privacy Policy.",
      ),
      t(
        "이용자는 다른 사람의 개인정보를 게시하거나 서비스 밖으로 수집·이용할 때에도 관련 법령을 지켜야 합니다.",
        "Users must also comply with applicable privacy laws when posting another person’s personal information or collecting or using it outside the Service.",
      ),
    ],
  },
  {
    id: "termination",
    number: 13,
    title: t("이용 중단과 계정 제한", "Suspension and account restrictions"),
    paragraphs: [
      t(
        "이용자는 언제든 서비스 이용을 중단할 수 있습니다. 운영자는 약관 위반, 법령상 요청, 장기간 미사용, 보안 위험 또는 서비스 운영상 필요한 경우 계정을 비활성화하거나 일부 기능을 제한할 수 있습니다.",
        "Users may stop using the Service at any time. The Operator may deactivate an account or restrict features for a Terms violation, legal request, prolonged inactivity, security risk, or operational necessity.",
      ),
      t(
        "계정이 제한되더라도 법령상 보존이 필요하거나 분쟁·부정 이용 방지를 위해 필요한 정보와 콘텐츠는 개인정보처리방침에 따라 보존될 수 있습니다.",
        "Even after an account is restricted, information and Content may be retained as described in the Privacy Policy when required by law or necessary to prevent abuse or handle disputes.",
      ),
    ],
  },
  {
    id: "liability",
    number: 14,
    title: t("책임의 범위", "Scope of responsibility"),
    paragraphs: [
      t(
        "운영자는 합리적인 보안과 안정적인 서비스 제공을 위해 노력하지만, 천재지변, 통신·호스팅 장애, 제3자 시스템 장애, 이용자의 귀책사유 등 운영자가 합리적으로 통제하기 어려운 사유로 발생한 중단에 대해서는 법령이 허용하는 범위에서 책임을 지지 않습니다.",
        "The Operator makes reasonable efforts to provide a secure and reliable Service, but to the extent permitted by law is not responsible for interruptions caused by events outside its reasonable control, such as force majeure, network or hosting failures, third-party system failures, or a User’s own fault.",
      ),
      t(
        "운영자는 이용자가 게시한 콘텐츠의 정확성·완전성·적법성을 보증하지 않으며, 이용자 간 또는 이용자와 제3자 사이의 분쟁은 당사자가 우선 해결해야 합니다. 다만 운영자는 법령과 운영 정책에 따라 필요한 조치를 취할 수 있습니다.",
        "The Operator does not guarantee the accuracy, completeness, or legality of User Content. Disputes between Users or between a User and a third party should first be resolved by the parties, while the Operator may take measures required by law and operating policy.",
      ),
      t(
        "이 조항은 관련 법령에 따라 제한되거나 배제될 수 없는 이용자의 권리를 제한하지 않습니다.",
        "Nothing in this section limits rights that cannot be limited or excluded under applicable law.",
      ),
    ],
  },
  {
    id: "contact-dispute",
    number: 15,
    title: t("문의와 분쟁 해결", "Contact and dispute resolution"),
    paragraphs: [
      t(
        `서비스 이용, 콘텐츠 처리, 학생회비 기록 또는 약관에 관한 문의는 ${CONTACT_EMAIL}로 보내 주세요. 문의에는 본인 확인과 사실관계 확인에 필요한 최소한의 정보만 포함해 주세요.`,
        `For questions about the Service, Content handling, student-fee records, or these Terms, contact ${CONTACT_EMAIL}. Include only the minimum information needed to verify your identity and the facts of the request.`,
      ),
      t(
        "이 약관은 대한민국 법령에 따라 해석되며, 분쟁은 관계 법령이 정한 절차와 관할에 따릅니다.",
        "These Terms are interpreted under the laws of the Republic of Korea, and disputes are handled under the procedures and jurisdiction provided by applicable law.",
      ),
    ],
  },
];

const privacySections: readonly LegalSection[] = [
  {
    id: "privacy-overview",
    number: 1,
    title: t("개인정보처리자와 적용 범위", "Controller and scope"),
    paragraphs: [
      t(
        `KAIST 전산학부 집행위원회(${OPERATOR_NAME_EN}, 이하 ‘운영자’)는 서비스 이용자의 개인정보를 보호하고 관련 법령을 준수하기 위해 이 개인정보처리방침을 공개합니다. 이 방침은 웹사이트의 게시판, 행사·일정, 설문·투표, 학생회비 관리, 마이페이지와 관리자 기능에 적용됩니다.`,
        `The SoC Student Council of KAIST (the “Operator”) publishes this Privacy Policy to protect Service Users’ personal information and comply with applicable law. It applies to the website’s boards, events and schedules, surveys and votes, student-fee administration, My Page, and operator features.`,
      ),
      t(
        `시행일: ${EFFECTIVE_DATE} · 문의: ${CONTACT_EMAIL}`,
        `Effective date: ${EFFECTIVE_DATE} · Contact: ${CONTACT_EMAIL}`,
      ),
    ],
  },
  {
    id: "privacy-items",
    number: 2,
    title: t("처리하는 개인정보 항목과 수집 방법", "Personal information items and collection methods"),
    paragraphs: [
      t(
        "운영자는 서비스 제공에 필요한 범위에서 다음 정보를 처리합니다. SSO 응답에 포함되어 제공되는 선택 정보는 실제 서비스 목적에 필요한 범위에서만 사용하며, 운영 환경이나 기능이 변경되면 이 방침도 함께 갱신합니다.",
        "The Operator processes the following information to the extent needed to provide the Service. Optional information included in an SSO response is used only for actual Service purposes, and this Policy is updated when the operating environment or features change.",
      ),
    ],
    groups: [
      {
        kind: "required",
        label: t("필수 항목", "Required items"),
        value: t(
          "KAIST UID, 성명(한글·영문), 학번, 이메일, 소속 학과, 주전공, 학적 상태(SSO 연동 및 권한·회원 식별용). 수집 방법: KAIST SSO 로그인과 동의 후 계정 연계.",
          "KAIST UID, Korean and English names, student number, email address, department, primary major, and academic status (for SSO linking and Member or permission identification). Method: KAIST SSO sign-in and account linking after consent.",
        ),
      },
      {
        kind: "optional",
        label: t("선택 항목", "Optional items"),
        value: t(
          "휴대전화번호, 성별(SSO에서 제공되고 이용자가 동의한 경우에만 프로필·연락망 처리에 사용).",
          "Mobile number and gender (used for profile or contact-directory operations only when provided by SSO and consented to by the User).",
        ),
      },
      {
        label: t("동의·세션 정보", "Consent and session information"),
        value: t(
          "개인정보 저장 동의 시각, 로그인 진행 상태, 로그인·세션 쿠키 식별자, 임시 로그인 토큰, 최근 로그인 시각. 수집 방법: 로그인·동의·세션 유지 과정에서 자동 생성.",
          "Privacy-consent timestamp, login-in-progress state, session and login cookie identifiers, temporary login token, and last-login time. Method: generated during sign-in, consent, and session maintenance.",
        ),
      },
      {
        label: t("게시판·커뮤니티 정보", "Board and community information"),
        value: t(
          "게시글·댓글·대댓글의 제목, 본문, 작성자 식별 정보, 공개·비밀·익명 설정, 좋아요·스크랩·조회 기록, 신고·숨김 처리에 관한 내용, 임시저장글과 첨부파일. 수집 방법: 이용자가 직접 작성·선택·업로드.",
          "Titles and bodies of posts, comments, and replies; author identifiers; public, secret, and anonymous settings; like, scrap, and view records; report or moderation details; drafts; and attachments. Method: entered, selected, or uploaded by the User.",
        ),
      },
      {
        label: t("설문·투표 정보", "Survey and voting information"),
        value: t(
          "설문 응답·문항별 답변·응답 상태·제출 시각, 투표 참여 자격 명부의 이름·학번·이메일·주전공·학적상태·회비 상태, 암호화된 투표용지와 집계 결과. 수집 방법: 이용자의 설문·투표 참여 및 운영자의 자격 명부 생성.",
          "Survey responses, question-level answers, response status, and submission time; name, student number, email, primary major, academic status, and fee status in voter-eligibility lists; encrypted ballots; and tallies. Method: User participation and eligibility-list creation by the Operator.",
        ),
      },
      {
        label: t("학생회비 납부 정보", "Student-fee information"),
        value: t(
          "수납액, 납부 유형, 결제 수단, 적용 시작 학기, 적용 학기 수, 납부 일자, 비고, 확인 담당자와 확인 시각. 수집 방법: 운영자가 계좌이체·현금 등 외부 납부 내역을 확인하여 입력·수정.",
          "Amount received, payment type, payment method, effective starting semester, covered semesters, payment date, notes, verifying administrator, and verification time. Method: entered or corrected by the Operator after checking external transfers or cash payments.",
        ),
      },
      {
        label: t("운영·보안 기록", "Operational and security records"),
        value: t(
          "관리자 변경·실행 내역, 대상·변경 내용, 접속 IP 주소, 생성 시각, 계정 및 권한 변경 기록, 파일 업로드 메타데이터. 수집 방법: 관리자 기능과 보안·감사 로그에서 자동 생성.",
          "Administrator changes and actions, target and change details, IP address, creation time, account and permission changes, and file-upload metadata. Method: generated by operator features and security or audit logs.",
        ),
      },
      {
        label: t("메일 발송 정보", "Email delivery information"),
        value: t(
          "관리자가 선택한 수신 대상의 이메일, 메일 제목·본문, 첨부파일 식별자, 발송 상태·예약 시각·오류 내용. 수집 방법: 관리자용 일괄 메일 작성·예약·발송 기능.",
          "Recipient email addresses selected by an administrator, email subject and body, attachment identifiers, delivery status, scheduled time, and error details. Method: administrator bulk-email composition, scheduling, and delivery.",
        ),
      },
    ],
  },
  {
    id: "privacy-purposes",
    number: 3,
    title: t("개인정보의 처리 목적", "Purposes of processing"),
    bullets: [
      t("KAIST SSO 기반 본인 확인, 회원 계정 생성·갱신·로그인·로그아웃 및 세션 관리", "Identity verification through KAIST SSO, account creation and updates, sign-in, sign-out, and session management"),
      t("게시글·댓글·첨부파일·좋아요·스크랩·신고 등 커뮤니티 기능 제공과 공개 범위 적용", "Providing community features such as posts, comments, attachments, likes, scraps, and reports, and applying visibility settings"),
      t("행사·일정 안내, 설문·투표 참여 자격 확인, 응답·투표 저장·집계·결과 제공", "Providing event and schedule information, checking survey and voting eligibility, storing and tallying responses and ballots, and presenting results"),
      t("학생회비 납부 상태와 학기별 혜택 자격 확인, 수납·회계·감사 원장 관리", "Checking student-fee status and semester benefit eligibility, and managing payment, accounting, and audit ledgers"),
      t("관리자 권한, 구성원, 사이트 콘텐츠, 일정, 메일 및 보안·운영 로그 관리", "Managing administrator permissions, members, site content, schedules, email, and security or operational logs"),
      t("문의·민원·분쟁·권리 침해 신고 대응, 부정 이용 방지와 서비스 보안 유지", "Responding to inquiries, complaints, disputes, and rights reports, preventing abuse, and maintaining Service security"),
      t("법령상 의무 이행과 권리·재산 보호에 필요한 조치", "Taking measures required by law and necessary to protect rights and property"),
    ],
  },
  {
    id: "privacy-retention",
    number: 4,
    title: t("보유 및 이용 기간", "Retention and use periods"),
    paragraphs: [
      t(
        "운영자는 개인정보를 수집·이용 목적이 달성될 때까지 보유하며, 목적이 달성되거나 이용자가 삭제를 요청하면 지체 없이 파기합니다. 다만 다른 법령, 회계·감사, 분쟁 해결, 부정 이용 방지 또는 권리 보호를 위해 보존할 필요가 있는 정보는 해당 사유가 끝날 때까지 별도로 보존할 수 있습니다.",
        "The Operator retains personal information until the purpose of collection and use is achieved and destroys it without undue delay when the purpose is achieved or deletion is requested. Information may be retained separately for as long as required by law, accounting or audit, dispute resolution, abuse prevention, or rights protection.",
      ),
    ],
    groups: [
      {
        label: t("계정·동의 정보", "Account and consent information"),
        value: t("회원 계정이 유지되는 동안. 탈퇴·삭제 후에는 파기하되 법령상 또는 분쟁 대응상 필요한 동의·처리 기록은 해당 기간 동안 보존.", "While the Member account is maintained. Destroyed after withdrawal or deletion, except for consent and processing records retained as required by law or for disputes."),
      },
      {
        label: t("세션·로그인 진행 정보", "Session and login-flow information"),
        value: t("로그아웃·만료·로그인 절차 완료 또는 실패 시까지. 임시 로그인·대기 정보는 목적 달성 또는 만료 시 삭제.", "Until sign-out, expiration, or completion or failure of the login flow. Temporary login and pending information is deleted when its purpose is achieved or it expires."),
      },
      {
        label: t("게시글·댓글·설문·투표", "Posts, comments, surveys, and votes"),
        value: t("서비스에 게시·보관되는 동안 및 분쟁·운영 대응에 필요한 기간. 삭제·탈퇴 시에도 법령·권리 보호·집계 무결성에 필요한 최소 정보는 별도 보존될 수 있음.", "While published or stored in the Service and for as long as needed for disputes or operations. After deletion or withdrawal, minimum information may be retained for law, rights protection, or tally integrity."),
      },
      {
        label: t("초안·첨부파일", "Drafts and attachments"),
        value: t("이용자가 삭제하거나 작성 목적이 달성될 때까지. 미사용 파일은 고아 파일 정리 정책에 따라 삭제될 수 있음.", "Until the User deletes them or the writing purpose is achieved. Unused files may be deleted under the orphan-file cleanup policy."),
      },
      {
        label: t("학생회비·감사·메일 기록", "Fee, audit, and email records"),
        value: t("수납 확인·회계·감사·보안·분쟁 대응에 필요한 기간 및 관련 법령이나 내부 보존 기준에서 정한 기간. 실제 운영 기준이 변경되면 이 방침에 반영.", "For the period needed for payment verification, accounting, audit, security, and disputes, or the period required by law or internal retention standards. The Policy will be updated when the actual operating standard changes."),
      },
    ],
  },
  {
    id: "privacy-destruction",
    number: 5,
    title: t("개인정보의 파기 절차와 방법", "Destruction procedures and methods"),
    paragraphs: [
      t(
        "보유기간이 끝났거나 처리 목적이 달성된 개인정보는 파기 대상인지 확인한 뒤 지체 없이 파기합니다. 전자 파일은 복구·재생이 어렵도록 삭제하고, 출력물은 분쇄 또는 소각합니다. 법령·분쟁·감사 사유로 보존하는 정보는 별도 보관하여 일반적인 이용과 분리합니다.",
        "When a retention period ends or a processing purpose is achieved, the Operator reviews the information for destruction and destroys it without undue delay. Electronic files are deleted so that restoration or reproduction is difficult, and paper records are shredded or incinerated. Information retained for law, disputes, or audit is segregated from ordinary use.",
      ),
    ],
  },
  {
    id: "privacy-sharing",
    number: 6,
    title: t("개인정보의 제3자 제공", "Disclosure to third parties"),
    paragraphs: [
      t(
        "운영자는 원칙적으로 이용자의 개인정보를 외부에 판매하거나 이용 목적을 벗어나 제공하지 않습니다. 다만 이용자가 동의했거나, 법령에 근거한 요청에 응하거나, 생명·신체·재산 보호를 위해 긴급하게 필요한 경우에는 필요한 최소 범위에서 제공할 수 있습니다.",
        "The Operator does not generally sell or disclose personal information outside the stated purposes. Information may be disclosed to the minimum extent necessary when the User consents, the Operator responds to a lawful request, or disclosure is urgently necessary to protect life, body, or property.",
      ),
      t(
        "공개 게시판에 이용자가 직접 게시한 콘텐츠는 게시 설정에 따라 다른 이용자에게 표시될 수 있습니다. 이는 운영자가 비공개 개인정보를 임의로 제3자에게 제공한다는 의미가 아닙니다.",
        "Content that a User directly posts on a public board may be displayed to other Users according to its visibility setting. This does not mean that the Operator freely discloses private personal information to third parties.",
      ),
    ],
  },
  {
    id: "privacy-outsourcing",
    number: 7,
    title: t("개인정보 처리의 위탁", "Entrusted processing"),
    paragraphs: [
      t(
        "서비스 운영을 위해 다음과 같은 외부 시스템 또는 운영 인프라가 사용될 수 있습니다. 위탁자·재위탁자·보관 국가와 업무 범위는 실제 배포 환경의 계약 및 설정에 맞춰 공개 전에 확정하며, 변경 시 지체 없이 이 방침에 반영합니다.",
        "The following external systems or operating infrastructure may be used to operate the Service. The actual processor, subprocessor, storage country, and scope of work must be finalized before publication to match deployment contracts and settings, and this Policy will be updated promptly when they change.",
      ),
    ],
    groups: [
      {
        label: t("KAIST SSO", "KAIST SSO"),
        value: t("로그인 인증과 계정 연계를 위한 사용자 정보 교환. SSO 제공자의 별도 개인정보 안내가 함께 적용될 수 있음.", "User-information exchange for login authentication and account linking. The SSO provider’s separate privacy notice may also apply."),
      },
      {
        label: t("메일 발송 서비스", "Email delivery service"),
        value: t("관리자 메일 발송·예약·첨부파일 처리. 운영 환경에서는 설정된 SMTP 제공자(예: Dooray SMTP)가 수신자 이메일과 메일 내용을 처리할 수 있음.", "Bulk-email delivery, scheduling, and attachment handling. In production, the configured SMTP provider (for example, Dooray SMTP) may process recipient addresses and email content."),
      },
      {
        label: t("파일 저장소", "File storage"),
        value: t("게시글·행사·설문·프로필 등에 첨부된 파일 저장·조회. 배포 설정에 따라 운영 서버의 저장소 또는 S3 호환 객체 저장소를 사용.", "Storage and retrieval of files attached to posts, events, surveys, and profiles. Depending on deployment settings, the Service uses local server storage or an S3-compatible object store."),
      },
      {
        label: t("채널톡(선택 기능)", "Channel Talk (optional)"),
        value: t("문의 메신저 제공. 기능이 활성화되고 로그인한 경우 이름·이메일·내부 회원 식별자가 채널톡 SDK로 전달될 수 있음.", "Support messenger. When enabled and a User is signed in, name, email, and an internal Member identifier may be sent through the Channel Talk SDK."),
      },
    ],
  },
  {
    id: "privacy-overseas",
    number: 8,
    title: t("개인정보의 국외 이전", "Cross-border transfers"),
    paragraphs: [
      t(
        "운영자는 해외 사업자나 해외 리전에 저장·전송하는 처리 위탁이 실제로 있는 경우 이전 국가, 이전받는 자, 이전 항목, 목적, 보유기간, 이전 방법과 거부 방법을 이 방침에 구체적으로 추가하여 안내합니다. 현재 저장소만으로 확인되지 않는 운영 설정을 근거로 국외 이전의 유무를 단정하지 않습니다.",
        "If an actual processor stores or transfers information to an overseas provider or region, this Policy will specifically identify the destination country, recipient, data items, purpose, retention, transfer method, and how to refuse. The Operator does not assert whether a cross-border transfer exists based only on repository code when deployment settings have not been confirmed.",
      ),
    ],
  },
  {
    id: "privacy-rights",
    number: 9,
    title: t("정보주체의 권리와 행사 방법", "Data-subject rights and how to exercise them"),
    paragraphs: [
      t(
        `이용자는 자신의 개인정보에 대해 열람, 정정·삭제, 처리정지, 동의 철회 및 개인정보 전송 요구 등 관련 법령이 정한 권리를 행사할 수 있습니다. 서비스 화면에서 직접 처리할 수 없는 요청은 ${CONTACT_EMAIL}로 접수해 주세요.`,
        `Users may exercise rights provided by applicable law, including access, correction or deletion, suspension of processing, withdrawal of consent, and data-portability requests where applicable. If a request cannot be handled in the Service, submit it to ${CONTACT_EMAIL}.`,
      ),
      t(
        "운영자는 본인 또는 정당한 대리인인지 확인하기 위해 필요한 최소한의 인증 자료를 요청할 수 있습니다. 다른 사람의 권리, 법령상 의무, 진행 중인 감사·분쟁 또는 서비스 보안을 침해할 우려가 있는 경우 일부 요청을 제한하거나 거절하고 그 사유를 안내할 수 있습니다.",
        "The Operator may request the minimum verification needed to confirm that the requester is the data subject or an authorized representative. A request may be limited or refused, with reasons given, when it would affect another person’s rights, a legal duty, an ongoing audit or dispute, or Service security.",
      ),
      t(
        `권리 행사는 ${CONTACT_EMAIL}로 요청 내용을 보내는 방식으로 할 수 있으며, 운영자는 관련 법령이 정한 절차와 기간에 따라 답변합니다.`,
        `Requests may be made by sending the requested action and relevant details to ${CONTACT_EMAIL}. The Operator responds under the procedures and time limits required by applicable law.`,
      ),
    ],
  },
  {
    id: "privacy-contact",
    number: 10,
    title: t("개인정보 보호책임과 고충 처리", "Privacy contact and complaints"),
    groups: [
      {
        label: t("개인정보 보호책임자 직책", "Privacy officer role"),
        value: t("KAIST 전산학부 집행위원회 전산관리부 부장", "Head of IT Administration, SoC Student Council, School of Computing, KAIST"),
      },
      {
        label: t("개인정보 관련 문의·열람등요구 접수", "Privacy inquiries and rights requests"),
        value: t(CONTACT_EMAIL, CONTACT_EMAIL),
      },
      {
        label: t("외부 구제·상담", "External remedies and advice"),
        value: t("개인정보침해 신고센터 privacy.kisa.or.kr / 국번 없이 118, 개인정보분쟁조정위원회 등 관련 기관", "KISA Privacy Infringement Report Center at privacy.kisa.or.kr / 118, and the Personal Information Dispute Mediation Committee or other relevant authorities"),
      },
    ],
  },
  {
    id: "privacy-safeguards",
    number: 11,
    title: t("개인정보의 안전성 확보조치", "Security safeguards"),
    bullets: [
      t("개인정보 접근 권한을 업무상 필요한 운영자에게만 부여하고 역할·권한별 접근을 관리합니다.", "Access is granted only to operators who need it for their duties, with role-based permission management."),
      t("SSO·세션 토큰과 인증 쿠키를 분리하여 관리하고, 동의 전 임시 세션에는 장기 계정을 만들지 않습니다.", "SSO and session tokens and authentication cookies are managed separately, and no persistent account is created for a pre-consent temporary session."),
      t("운영 변경과 관리자 실행을 감사 로그로 기록하고, 접근 IP와 변경 대상 등 보안 점검에 필요한 정보를 관리합니다.", "Operator changes and administrative actions are recorded in audit logs, including information such as access IP and target needed for security review."),
      t("HTTPS 전송, 비밀값의 환경변수 관리, 입력값 검증, 파일 접근 제어, 백업·복구와 취약점 대응을 적용합니다.", "The Service applies HTTPS transport, environment-based secret management, input validation, file access controls, backup and recovery, and vulnerability response."),
    ],
  },
  {
    id: "privacy-automated",
    number: 12,
    title: t("자동화된 결정과 프로파일링", "Automated decisions and profiling"),
    paragraphs: [
      t(
        "서비스는 현재 이용자에게 법적 효과나 이에 준하는 중대한 영향을 자동으로 발생시키는 결정 또는 광고 목적의 프로파일링을 하지 않습니다. 설문·투표·혜택 자격 확인은 저장된 조건을 화면과 운영자가 확인할 수 있는 방식으로 적용합니다.",
        "The Service currently does not make automated decisions that produce legal or similarly significant effects on Users, nor does it perform advertising profiling. Survey, voting, and benefit eligibility checks apply stored criteria in a way that can be shown in the Service and reviewed by the Operator.",
      ),
      t(
        "향후 자동화된 결정이 도입되면 그 기준, 처리 결과, 이의 제기와 사람의 검토를 요구할 수 있는 방법을 사전에 안내하고 관련 법령에 따라 처리합니다.",
        "If automated decisions are introduced, the Operator will explain the criteria, consequences, and how to object or request human review in advance and will comply with applicable law.",
      ),
    ],
  },
  {
    id: "privacy-cookies",
    number: 13,
    title: t("쿠키와 행태정보", "Cookies and behavioral information"),
    paragraphs: [
      t(
        "서비스는 로그인 유지와 보안에 필요한 httpOnly 세션 쿠키를 사용합니다. 언어 선택과 일부 화면 상태에는 브라우저의 localStorage 또는 sessionStorage가 사용될 수 있습니다. 브라우저 설정으로 쿠키를 제한하면 로그인 등 일부 기능이 정상적으로 동작하지 않을 수 있습니다.",
        "The Service uses httpOnly session cookies needed to maintain sign-in and security. Browser localStorage or sessionStorage may be used for language selection and some screen state. Restricting cookies in the browser may prevent sign-in and other features from working normally.",
      ),
      t(
        "현재 광고 식별자나 이용자 행동을 분석하여 맞춤형 광고를 제공하기 위한 행태정보를 별도로 수집하지 않습니다. 문의 메신저가 활성화되면 채널톡의 자체 쿠키·기술이 적용될 수 있으며, 자세한 내용은 해당 제공자의 정책을 확인해 주세요.",
        "The Service does not currently separately collect behavioral information for advertising identifiers or personalized advertising. If the support messenger is enabled, Channel Talk’s own cookies and technologies may apply; see that provider’s policy for details.",
      ),
    ],
  },
  {
    id: "privacy-changes",
    number: 14,
    title: t("개인정보처리방침의 변경", "Changes to this Privacy Policy"),
    paragraphs: [
      t(
        `이 방침은 서비스 기능, SSO 응답 항목, 처리위탁자, 저장소·보안 방식 또는 관련 법령의 변경을 반영하기 위해 수정될 수 있습니다. 변경 시 시행일과 변경 내용을 이 페이지에 게시하며, 중요한 변경은 서비스 화면 등을 통해 별도로 안내합니다. 현재 방침의 시행일은 ${EFFECTIVE_DATE}입니다.`,
        `This Policy may be revised to reflect changes to Service features, SSO fields, processors, storage or security methods, or applicable law. The effective date and changes will be posted on this page, and material changes will be separately announced through the Service or another appropriate channel. The current effective date is ${EFFECTIVE_DATE}.`,
      ),
    ],
  },
  {
    id: "privacy-remedies",
    number: 15,
    title: t("권익침해 구제 방법", "Remedies for privacy violations"),
    paragraphs: [
      t(
        `개인정보 처리에 관한 문의·불만·권리 행사는 ${CONTACT_EMAIL}로 접수해 주세요. 운영자와의 상담으로 해결되지 않는 경우 개인정보침해 신고센터(privacy.kisa.or.kr, 국번 없이 118), 개인정보분쟁조정위원회 등 관계 기관에 상담이나 분쟁조정을 신청할 수 있습니다.`,
        `For questions, complaints, or rights requests about personal information, contact ${CONTACT_EMAIL}. If the matter is not resolved with the Operator, Users may seek advice or mediation from the KISA Privacy Infringement Report Center (privacy.kisa.or.kr, 118) or the Personal Information Dispute Mediation Committee and other relevant authorities.`,
      ),
    ],
  },
];

const documents: Record<"terms" | "privacy", LegalDocument> = {
  terms: {
    title: t("서비스 이용약관", "Terms of Service"),
    summary: t(
      "게시판·행사·설문·투표·학생회 운영 기능을 이용하기 위한 기본 약관입니다.",
      "The basic terms for using boards, events, surveys, votes, and student council features.",
    ),
    versionLabel: t("버전 1.0", "Version 1.0"),
    sectionsLabel: t("목차", "Contents"),
    sections: termsSections,
  },
  privacy: {
    title: t("개인정보처리방침", "Privacy Policy"),
    summary: t(
      "서비스에서 처리하는 개인정보의 항목·목적·보유기간과 이용자의 권리를 안내합니다.",
      "How the Service processes personal information, including items, purposes, retention, and User rights.",
    ),
    versionLabel: t("버전 1.0", "Version 1.0"),
    sectionsLabel: t("목차", "Contents"),
    sections: privacySections,
  },
};

function localized(value: LegalText, lang: Language): string {
  return value[lang];
}

function LegalSectionView({ lang, section }: { lang: Language; section: LegalSection }) {
  return (
    <section id={section.id} className="scroll-mt-24 break-words select-text px-5 py-7 md:px-8">
      <div className="min-w-0">
        <h2 className="text-lg font-semibold tracking-tight text-app-text-strong">
          {lang === "ko"
            ? `제${section.number}조 (${localized(section.title, lang)})`
            : `Article ${section.number} (${localized(section.title, lang)})`}
        </h2>

        {section.paragraphs?.length ? (
          <div className="mt-3 space-y-3 text-sm leading-7 text-app-text-body">
            {section.paragraphs.map((paragraph, index) => (
              <p key={`${section.id}-paragraph-${index}`}>{localized(paragraph, lang)}</p>
            ))}
          </div>
        ) : null}

        {section.bullets?.length ? (
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-7 text-app-text-body marker:text-brand-primary">
            {section.bullets.map((bullet, index) => (
              <li key={`${section.id}-bullet-${index}`}>{localized(bullet, lang)}</li>
            ))}
          </ul>
        ) : null}

        {section.groups?.length ? (
          <dl className="mt-4 divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200 bg-slate-50/60">
            {section.groups.map((group, index) => (
              <div className="grid gap-1 px-4 py-3 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-5" key={`${section.id}-group-${index}`}>
                <dt className="flex flex-wrap items-center gap-2 text-sm font-semibold text-app-text-strong">
                  {group.kind ? (
                    <span className={group.kind === "required"
                      ? "rounded-md bg-brand-primary-light px-2 py-0.5 text-xs font-semibold text-brand-primary"
                      : "rounded-md bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-700"}>
                      {group.kind === "required"
                        ? lang === "ko" ? "필수" : "Required"
                        : lang === "ko" ? "선택" : "Optional"}
                    </span>
                  ) : null}
                  {localized(group.label, lang)}
                </dt>
                <dd className="min-w-0 whitespace-pre-line break-words text-sm leading-6 text-app-text-body">
                  {localized(group.value, lang)}
                </dd>
              </div>
            ))}
          </dl>
        ) : null}
      </div>
    </section>
  );
}

export function LegalDocumentPage({ kind }: { kind: "terms" | "privacy" }) {
  const { lang } = useLanguage();
  const document = documents[kind];

  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [kind]);

  return (
    <PageShell>
      <Header />
      <PageMain>
        <PageHeader
          title={localized(document.title, lang)}
          containerClassName="max-w-[var(--ui-legal-max-width)]"
        />

        <PageContainer className="max-w-[var(--ui-legal-max-width)] pb-12">
          <article className="break-words overflow-hidden rounded-[var(--ui-card-radius)] border border-slate-200 bg-white shadow-card">
            <header className="border-b border-slate-200 px-5 py-6 md:px-8">
              <p className="text-sm leading-6 text-app-text-strong">
                <span className="font-semibold">[{localized(document.versionLabel, lang)}]</span>
                <span className="mx-2 text-app-text-muted">{lang === "ko" ? "시행일:" : "Effective:"}</span>
                <span className="font-medium">{EFFECTIVE_DATE}</span>
                <span className="mx-2 text-app-text-muted" aria-hidden="true">·</span>
                <span className="text-app-text-muted">{lang === "ko" ? "운영 주체:" : "Operator:"}</span>
                <span className="ml-1 font-medium">{lang === "ko" ? OPERATOR_NAME : OPERATOR_NAME_EN}</span>
              </p>
              <p className="mt-2 text-sm leading-6 text-app-text-body">
                {localized(document.summary, lang)}
              </p>
            </header>

            <nav aria-label={localized(document.sectionsLabel, lang)} className="border-b border-slate-200 bg-slate-50/70 px-5 py-4 md:px-8">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-app-text-muted">
                {localized(document.sectionsLabel, lang)}
              </p>
              <ol className="grid gap-x-8 gap-y-1 text-sm leading-6 text-app-text-body sm:grid-cols-2">
                {document.sections.map((section) => (
                  <li className="list-inside list-decimal marker:text-app-text-muted" key={section.id}>
                    <a
                      className="underline-offset-4 transition-colors hover:text-brand-primary hover:underline"
                      href={`#${section.id}`}
                    >
                      {localized(section.title, lang)}
                    </a>
                  </li>
                ))}
              </ol>
            </nav>

            <div className="divide-y divide-slate-100">
              {document.sections.map((section) => (
                <LegalSectionView key={section.id} lang={lang} section={section} />
              ))}
            </div>

            <footer className="border-t border-slate-200 bg-slate-50/70 px-5 py-5 text-sm leading-6 text-app-text-body md:px-8">
              <p className="font-semibold text-app-text-strong">
                {lang === "ko" ? "문의" : "Contact"}
              </p>
              <a className="mt-1 inline-block text-brand-primary underline-offset-4 hover:underline" href={`mailto:${CONTACT_EMAIL}`}>
                {CONTACT_EMAIL}
              </a>
            </footer>
          </article>
        </PageContainer>
      </PageMain>
      <Footer />
    </PageShell>
  );
}
