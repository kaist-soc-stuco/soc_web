import { Footer } from "@/components/organisms/footer";
import { SelectDropdown } from "@/components/atoms/select-dropdown";
import { useLanguage, type Language } from "@/hooks/use-language";
import { PageContainer, PageHeader, PageMain, PageShell } from "@/components/ui/page-layout";
import { useLayoutEffect, useState } from "react";

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

type LegalDocumentVersion = Readonly<{
  version: string;
  effectiveDate: string;
  sections: readonly LegalSection[];
}>;

type LegalDocument = Readonly<{
  title: LegalText;
  summary: LegalText;
  sectionsLabel: LegalText;
  // Newest first; each entry retains the complete content of that version.
  versions: readonly [LegalDocumentVersion, ...LegalDocumentVersion[]];
}>;

const t = (ko: string, en: string): LegalText => ({ ko, en });

const EFFECTIVE_DATE = "2026.11.02";
const PRIVACY_EFFECTIVE_DATE = "2026.11.02";
const OPERATOR_NAME = "KAIST 전산학부 집행위원회";
const OPERATOR_NAME_EN = "SoC Student Council, School of Computing, KAIST";
const CONTACT_EMAIL = "kaist.helloworld@gmail.com";

/*
 * 최초 공개하는 서비스 범위를 기준으로 작성합니다.
 * 채널톡 AI 수탁자·처리 지역·문의처·처리 조건의 출처: https://channel.io/kr/privacy
 * 대량 메일 발송과 사용 여부가 미정인 Google Sheets 연동은 공개 범위에 포함하지 않습니다.
 * 파기 작업과 문의·권리 요구 처리의 내부 운영은 privacy-retention/OPERATIONS.md에서 관리합니다.
 */

const termsSections: readonly LegalSection[] = [
  {
    id: "purpose",
    number: 1,
    title: t("목적", "Purpose"),
    paragraphs: [
      t(
        "이 약관은 KAIST 전산학부 집행위원회(이하 ‘운영자’라 합니다)가 운영하는 웹사이트 및 관련 서비스(이하 ‘서비스’라 합니다)의 이용과 관련하여 운영자와 이용자 간의 권리, 의무 및 책임사항, 서비스 이용조건과 절차, 그 밖에 필요한 사항을 규정함을 목적으로 합니다.",
        "These Terms govern the rights, obligations, and responsibilities of the SoC Student Council, School of Computing, KAIST (the ‘Operator’) and Users in connection with the website and related services (the ‘Service’), including the conditions and procedures for use.",
      ),
    ],
  },
  {
    id: "definitions",
    number: 2,
    title: t("정의", "Definitions"),
    paragraphs: [t("이 약관에서 사용하는 용어의 뜻은 다음과 같습니다.", "The following definitions apply to these Terms.")],
    bullets: [
      t("‘이용자’란 이 약관에 따라 서비스를 이용하는 회원 및 비회원을 말합니다.", "‘User’ means a Member or non-member who uses the Service under these Terms."),
      t("‘회원’이란 KAIST 통합인증(이하 ‘SSO’라 합니다)을 거쳐 이 약관에 동의하고, 개인정보 수집·이용에 동의하여 서비스에 계정이 생성된 이용자를 말합니다.", "‘Member’ means a User who completes KAIST single sign-on (‘SSO’), agrees to these Terms and the collection and use of personal information, and has an account created in the Service."),
      t("‘비회원’이란 회원 계정 없이 서비스를 이용하는 자를 말하며, 개인정보 수집·이용에 동의하지 않고 임시 세션으로 접속하는 이용자를 포함합니다.", "‘Non-member’ means a person using the Service without a Member account, including a User accessing a temporary session without consenting to the collection and use of personal information."),
      t("‘게시물’이란 이용자가 서비스에 게시한 글, 댓글, 대댓글 및 첨부파일을 말합니다. 설문 응답 및 투표 정보는 해당 기능에 관한 조항과 개인정보처리방침에 따릅니다.", "‘Post’ means text, comments, replies, and attachments posted by a User. Survey responses and voting information are governed by the provisions for those features and the Privacy Policy."),
    ],
  },
  {
    id: "effect-change",
    number: 3,
    title: t("약관의 명시 및 개정", "Publication and amendment of these Terms"),
    paragraphs: [
      t("운영자는 이용자가 이 약관의 내용과 운영자의 명칭 및 연락처를 쉽게 확인할 수 있도록 서비스 화면에 게시합니다. 서비스 이용 제한, 게시물의 이용허락 및 이용계약의 해지 등 중요한 사항은 동의 전에 확인할 수 있도록 안내합니다.", "The Operator publishes these Terms, its name, and contact details within the Service. Material provisions, including restrictions, the license to Posts, and termination, are made available for review before agreement."),
      t("운영자는 관계 법령을 위반하지 않는 범위에서 이 약관을 개정할 수 있습니다. 약관을 개정하는 경우 적용일자, 개정 사유 및 주요 변경 내용을 명시하여 적용일자 7일 전부터 적용일자 전일까지 서비스에 공지합니다.", "The Operator may amend these Terms within the limits of applicable law. The effective date, reasons, and principal changes will be announced in the Service at least seven days before the effective date and remain available until that date."),
      t("이용자에게 불리하거나 권리·의무에 중대한 영향을 미치는 변경은 적용일자 30일 전부터 공지하고, 회원에게 등록된 이메일 등으로 개별 통지합니다. 이 경우 개정 전후의 내용을 비교하여 알기 쉽게 표시합니다.", "Changes unfavorable to Users or materially affecting their rights or obligations will be announced at least thirty days in advance and individually notified to Members through their registered email or another appropriate channel, with a clear comparison of the provisions."),
      t("운영자는 약관 변경에 대한 이용자의 동의가 필요한 경우 이를 별도로 받습니다. 변경된 약관에 동의하지 않은 이용자에게 그 내용을 임의로 적용하지 않으며, 서비스의 계속 이용 또는 이의를 제기하지 않았다는 사정만으로 동의한 것으로 간주하지 않습니다.", "Where agreement to amended Terms is required, the Operator obtains it separately. Amended provisions will not be imposed on a User who has not agreed, and continued use or silence alone does not constitute agreement."),
      t("이용자는 개정 약관에 동의하지 않는 경우 이용계약을 해지할 수 있습니다. 종전 약관에 따른 서비스 제공이 객관적으로 불가능한 경우 운영자는 그 사유를 설명하고, 상당한 기간을 두어 해지 및 자료 정리 방법을 안내합니다. 개정 약관은 적용일자 전에 발생한 사항에 소급하여 적용하지 않습니다.", "A User who does not agree to amended Terms may terminate the agreement. If provision under the previous Terms is objectively impossible, the Operator explains why and provides reasonable time and instructions for termination and handling stored materials. Amendments do not apply retroactively."),
    ],
  },
  {
    id: "account",
    number: 4,
    title: t("이용계약의 성립 및 계정 관리", "Formation of the agreement and account management"),
    paragraphs: [
      t("회원 이용계약은 가입하려는 이용자가 SSO 인증을 완료하고 이 약관 및 개인정보 수집·이용에 각각 동의한 후, 운영자가 회원 계정을 생성하여 서비스 이용을 승인한 때 성립합니다. SSO 인증만으로 약관 동의 또는 개인정보 수집·이용 동의를 갈음하지 않습니다.", "The Member agreement is formed when a User completes SSO authentication, separately agrees to these Terms and the collection and use of personal information, and the Operator accepts the application by creating an account. SSO authentication alone does not replace either agreement."),
      t("개인정보 수집·이용 동의를 거부한 이용자는 회원 계정을 생성하지 않는 임시 세션을 이용할 수 있습니다. 임시 세션의 유효기간은 최대 10분이며, 마이페이지 등 회원 계정이 필요한 기능은 제한됩니다. 임시 세션의 이용에도 이 약관 중 해당 기능에 관한 사항이 적용됩니다.", "A User who refuses consent to personal information collection and use may access a temporary session without creating an account. The session is valid for at most ten minutes, and features requiring an account, such as My Page, are restricted. Relevant provisions of these Terms also apply to temporary sessions."),
      t("운영자는 타인의 명의를 이용한 신청, 허위 인증, 서비스 이용 자격의 미충족 또는 기술상 서비스 제공이 불가능한 사유가 있는 경우에 한하여 가입을 거절하거나 승낙을 유보할 수 있으며, 그 사유와 해소 방법을 안내합니다.", "The Operator may reject or defer an application only for impersonation, false authentication, failure to meet eligibility requirements, or a technical inability to provide the Service, and explains the reason and available remedies."),
      t("회원은 본인 명의의 SSO 계정을 사용하여야 하며 계정을 양도·대여하거나 타인과 공유하여서는 안 됩니다. 계정 도용 또는 정보 오류를 발견한 경우 운영자에게 알려야 합니다. 운영자는 SSO를 통해 갱신된 정보를 서비스 제공에 필요한 범위에서 반영할 수 있으며, 계정 관리와 관련한 책임은 각 당사자의 귀책사유에 따라 부담합니다.", "Members must use their own SSO account and must not transfer, lend, or share it. Members must notify the Operator of account misuse or inaccurate information. The Operator may reflect updated SSO information as needed to provide the Service. Each party bears responsibility for account management according to its own fault."),
    ],
  },
  {
    id: "notices",
    number: 5,
    title: t("이용자에 대한 통지", "Notices to Users"),
    paragraphs: [
      t("운영자는 회원에 대한 통지를 SSO를 통해 등록된 이메일 또는 서비스 내 개별 안내의 방법으로 합니다. 전체 이용자에게 공통으로 적용되는 사항은 서비스 공지사항에 7일 이상 게시하는 방법으로 통지할 수 있습니다.", "The Operator sends individual notices to the email registered through SSO or provides them individually within the Service. Matters common to all Users may be notified by posting an announcement in the Service for at least seven days."),
      t("회원에게 불리한 약관 변경, 계정 이용 제한, 이용계약 해지 등 회원의 권리·의무에 중대한 영향을 미치는 사항은 공지만으로 개별 통지를 갈음하지 않습니다. 개별 통지가 불가능한 경우 운영자는 서비스 내 확인 가능한 안내 등 합리적인 대체 수단을 제공합니다.", "An announcement alone does not replace individual notice of unfavorable amendments, account restrictions, termination, or other matters materially affecting a Member’s rights or obligations. If individual delivery is impossible, the Operator provides a reasonable alternative, such as a notice accessible within the Service."),
    ],
  },
  {
    id: "service",
    number: 6,
    title: t("서비스의 제공·변경 및 중단", "Provision, modification, and suspension of the Service"),
    paragraphs: [
      t("운영자는 학생자치 활동을 위하여 공지·게시판, 행사·일정, 설문·투표, 댓글·좋아요·스크랩, 학생회비 납부 내역 관리 등의 서비스를 제공합니다. 웹사이트의 기본 이용은 무료이며, 학생회비 또는 별도로 안내한 행사 참가비는 웹사이트 이용료와 구분됩니다.", "The Operator provides notices, boards, events, schedules, surveys, votes, comments, likes, saved Posts, and student-fee records to support student self-governance. Basic website use is free. Student fees and separately announced event fees are distinct from website usage fees."),
      t("서비스의 이용 범위는 로그인 여부, 소속·주전공, 학생회비 납부 상태 및 부여된 권한에 따라 달라질 수 있습니다. 운영자는 기능별 이용 자격과 참여 조건을 해당 화면에 표시하며, 자격 확인 정보에 오류가 있는 경우 이용자의 정정·검토 요청을 처리합니다.", "Access may depend on sign-in status, affiliation, primary major, student-fee status, and permissions. The Operator displays eligibility and participation requirements on the relevant screen and handles requests to correct or review inaccurate eligibility information."),
      t("운영자는 설비 점검·교체, 보안 조치, 장애 또는 서비스 개선 등 합리적인 사유로 서비스를 변경하거나 일시 중단할 수 있습니다. 이 경우 사유, 대상 범위 및 예정 시간을 사전에 공지합니다. 긴급한 보안 위험이나 예측할 수 없는 장애로 사전 공지가 불가능한 경우에는 그 사유와 조치 내용을 사후 지체 없이 공지하고 서비스 복구를 위해 노력합니다.", "The Operator may modify or temporarily suspend the Service for reasonable grounds such as maintenance, security, failures, or improvements. Reasons, scope, and expected timing are announced in advance. If an urgent security risk or unforeseen failure prevents prior notice, the Operator promptly announces the reasons and measures afterward and works to restore the Service."),
      t("운영자가 서비스의 전부 또는 주요 기능을 종료하는 경우에는 종료일 30일 전까지 종료 사유, 일정 및 이용자 자료의 열람·보관·삭제 요청 방법을 공지하고 회원에게 개별 통지합니다. 천재지변 등 불가피한 사유로 사전 안내가 불가능한 경우에는 그 사유를 지체 없이 알립니다. 서비스의 변경·중단·종료에 따른 책임은 제18조에 따릅니다.", "If the Operator terminates the entire Service or a principal feature, it announces the reasons, date, and methods to request access, preservation, or deletion of User materials at least thirty days in advance and individually notifies Members. If unavoidable circumstances prevent advance notice, it promptly explains why. Responsibility for changes, suspension, and termination is governed by Section 18."),
    ],
  },
  {
    id: "operator-duties",
    number: 7,
    title: t("운영자의 의무", "Obligations of the Operator"),
    paragraphs: [
      t("운영자는 관계 법령과 이 약관을 준수하고, 계속적이고 안정적인 서비스 제공을 위하여 노력합니다. 개인정보와 서비스 자료의 보호를 위하여 필요한 관리적·기술적 조치를 취하고, 관리자 권한을 업무에 필요한 범위로 제한합니다.", "The Operator complies with applicable law and these Terms and makes efforts to provide a stable and continuous Service. It implements necessary organizational and technical measures to protect personal information and Service data and limits administrative permissions to work-related needs."),
      t("운영자는 이용자의 의견이나 불만이 정당한 경우 이를 처리하여야 하며, 즉시 처리하기 어려운 경우 그 사유와 처리 일정을 안내합니다. 운영자는 정당한 의견 제시, 비판 또는 이의 제기만을 이유로 이용자에게 불이익을 주지 않습니다.", "The Operator addresses justified comments and complaints and explains the reason and expected schedule if immediate resolution is difficult. Users will not be disadvantaged solely for legitimate feedback, criticism, or objections."),
    ],
  },
  {
    id: "duties",
    number: 8,
    title: t("이용자의 의무", "Obligations of Users"),
    paragraphs: [t("이용자는 관계 법령, 이 약관 및 적법하게 고지된 운영정책을 준수하여야 하며, 다음 각 호의 행위를 하여서는 안 됩니다.", "Users must comply with applicable law, these Terms, and duly notified lawful operating policies and must not engage in any of the following conduct.")],
    bullets: [
      t("타인의 계정·명의를 도용하거나 인증정보를 위조하는 행위", "Using another person’s account or identity without authorization or falsifying authentication information"),
      t("타인의 개인정보를 무단으로 공개하거나 저작권·명예·사생활 등 권리를 침해하는 행위", "Disclosing personal information without authorization or infringing copyright, reputation, privacy, or other rights"),
      t("불법 정보, 협박·괴롭힘, 차별·혐오를 조장하는 내용, 음란물 또는 반복적인 광고·스팸을 게시·전송하는 행위", "Posting or transmitting unlawful information, threats, harassment, material promoting discrimination or hatred, obscene material, or repetitive advertising or spam"),
      t("권한 없이 시스템·계정·자료에 접근하거나 악성코드 유포, 보안조치 우회, 과도한 자동 요청 등으로 서비스의 정상적인 운영을 방해하는 행위", "Accessing systems, accounts, or data without authorization, distributing malware, bypassing security controls, or disrupting normal operation through excessive automated requests or similar conduct"),
      t("타인 명의의 참여, 중복 제출 우회 등으로 설문·투표 결과를 조작하거나 다른 이용자의 정당한 참여를 방해하는 행위", "Manipulating survey or voting results through impersonation or circumvention of duplicate-submission controls, or obstructing legitimate participation"),
      t("타인의 개인정보·연락처 또는 접근이 제한된 자료를 무단으로 수집하거나 이를 영리·홍보·제3자 제공 목적으로 이용하는 행위", "Collecting personal information, contact details, or restricted materials without authorization or using them for commercial purposes, promotion, or disclosure to third parties"),
    ],
  },
  {
    id: "content",
    number: 9,
    title: t("게시물의 권리 및 이용허락", "Rights in Posts and license"),
    paragraphs: [
      t("게시물의 저작권 등 권리는 해당 권리자에게 귀속됩니다. 이용자는 게시물의 게시에 필요한 권리를 확보하여야 하며, 타인의 권리를 침해하여서는 안 됩니다.", "Copyright and other rights in a Post belong to the respective rights holder. Users must obtain the rights necessary to publish their Posts and must not infringe another person’s rights."),
      t("이용자는 게시물을 등록함으로써 운영자에게 해당 게시물을 서비스 내에서 제공하는 데 필요한 저장·복제·전송·표시 및 파일 형식 변환을 비독점적·무상으로 허락합니다. 운영자는 이용자가 설정한 공개 범위를 준수하며, 게시물의 취지나 내용을 임의로 변경하지 않습니다.", "By submitting a Post, a User grants the Operator a non-exclusive, royalty-free license to store, reproduce, transmit, display, and convert its file format as necessary to provide it within the Service. The Operator respects the selected visibility and does not arbitrarily alter its meaning or content."),
      t("운영자는 서비스 외부의 홍보, 제3자 제공 등 서비스 제공에 필요한 범위를 벗어난 목적으로 게시물을 이용하려는 경우 권리자로부터 별도의 동의를 받아야 합니다. 이 약관에 따른 이용허락은 게시물의 권리를 운영자에게 양도하는 것으로 해석되지 않습니다.", "The Operator must obtain separate agreement from the rights holder before using a Post beyond what is necessary to provide the Service, including external promotion or provision to third parties. This license does not transfer ownership of any rights to the Operator."),
      t("이용자는 제공되는 기능을 통해 본인의 게시물을 수정·삭제하거나 운영자에게 그 처리를 요청할 수 있습니다. 게시물 삭제 시 서비스 제공을 위한 이용허락은 종료됩니다. 다만, 법령상 의무 또는 구체적인 분쟁의 해결을 위하여 보존이 필요한 자료는 그 목적과 개인정보처리방침에서 정한 기간 내에서만 제한적으로 보존합니다.", "Users may edit or delete their Posts through available features or request assistance from the Operator. The license for providing a Post ends upon deletion. Materials necessary for statutory obligations or a specific dispute may be retained only for that purpose and within the periods stated in the Privacy Policy."),
    ],
  },
  {
    id: "visibility",
    number: 10,
    title: t("게시물의 공개 범위 및 익명성", "Visibility and anonymity of Posts"),
    paragraphs: [
      t("공개 게시물은 로그인하지 않은 이용자를 포함한 제3자가 열람하거나 검색할 수 있습니다. 이용자는 게시 전에 공개 범위와 개인정보 포함 여부를 확인하여야 합니다. 다른 이용자는 게시물이 공개되었다는 사정만으로 이를 무단으로 복제·배포하거나 개인정보를 수집할 권리를 취득하지 않습니다.", "Public Posts may be viewed or searched by third parties, including visitors who are not signed in. Users must review visibility and personal information before posting. Public availability does not grant others a right to copy or distribute a Post without authorization or to collect personal information."),
      t("익명 설정은 일반 이용자에게 작성자 정보를 표시하지 않는 기능이며, 작성자 정보 자체를 저장하지 않는다는 의미는 아닙니다. 운영자는 신고 처리, 권리침해 대응 또는 법령상 의무 이행에 필요한 경우에 한하여 권한 있는 담당자가 작성자 정보를 확인하도록 하고, 그 접근 내역을 기록합니다.", "Anonymous posting hides author information from ordinary Users; it does not mean that author information is not stored. The Operator permits authorized staff to access it only as needed for reports, rights protection, or statutory obligations and records such access."),
      t("비밀글은 작성자와 답변·콘텐츠 관리 권한을 가진 담당자 등 접근 권한이 있는 자에게만 제공됩니다. 설문 응답과 투표 정보의 공개 범위는 제13조 및 개인정보처리방침에 따릅니다.", "Secret Posts are available only to their author and authorized staff, including those with reply or moderation permissions. Visibility of survey responses and voting information is governed by Section 13 and the Privacy Policy."),
    ],
  },
  {
    id: "moderation",
    number: 11,
    title: t("게시물 관리 및 이용 제한", "Moderation and restrictions on use"),
    paragraphs: [
      t("운영자는 이용자가 제8조의 의무를 위반한 사실이 확인된 경우 위반의 내용, 중대성, 반복 여부 및 피해 정도를 고려하여 시정 요청, 게시물 숨김·삭제, 일정 기간의 기능 제한 또는 이용계약 해지 등의 조치를 할 수 있습니다. 조치는 위반행위와 관련된 범위에서 필요한 최소한으로 하여야 합니다.", "If a violation of Section 8 is established, the Operator may request correction, hide or delete a Post, temporarily restrict features, or terminate the agreement, considering the nature, severity, repetition, and harm of the violation. Measures must be limited to what is necessary and relevant to the violation."),
      t("운영자는 원칙적으로 조치 전에 대상 행위, 근거, 조치 내용·기간 및 이의 제기 방법을 개별 통지하고 소명 기회를 부여합니다. 신고가 접수되었다는 사정만으로 위반 사실이 확정된 것으로 보지 않습니다.", "In principle, before taking action, the Operator individually notifies the User of the conduct, grounds, proposed measure and duration, and objection procedure and provides an opportunity to respond. A report alone does not establish a violation."),
      t("명백한 불법행위, 계정 도용, 긴급한 보안 위험 또는 중대한 피해의 확산을 방지할 필요가 있는 경우에는 사전 통지 없이 임시조치를 할 수 있습니다. 이 경우 법령상 통지가 금지되는 경우를 제외하고 조치 후 지체 없이 사유와 이의 제기 방법을 통지하며, 사유가 해소되거나 조치에 오류가 확인된 경우 지체 없이 해제·복구합니다.", "Temporary action may precede notice to address manifestly unlawful conduct, account theft, urgent security risks, or the spread of serious harm. Unless notice is prohibited by law, the Operator promptly provides reasons and objection instructions afterward and lifts or corrects measures when the grounds cease or an error is established."),
    ],
  },
  {
    id: "reports-objections",
    number: 12,
    title: t("권리침해 신고 및 이의 제기", "Rights-infringement reports and objections"),
    paragraphs: [
      t(`이용자 또는 권리자는 서비스 내 신고 기능이나 ${CONTACT_EMAIL}을 통해 권리침해를 신고하거나 이용 제한에 대한 이의를 제기할 수 있습니다. 신고 또는 요청에는 대상 게시물의 주소나 식별정보, 사유 및 확인에 필요한 최소한의 자료를 포함합니다.`, `Users and rights holders may report infringements or object to restrictions through the reporting feature or ${CONTACT_EMAIL}. Requests must identify the Post or other matter, explain the grounds, and include only the minimum supporting information needed.`),
      t("운영자는 신고 및 이의 제기의 사실관계를 검토하고 처리 결과와 사유를 통지합니다. 원칙적으로 접수일부터 7일 이내에 결과를 안내하되, 추가 확인이 필요한 경우 그 사유와 처리 일정을 같은 기간 내에 안내합니다. 관계 법령에 별도의 절차나 처리기간이 정해진 경우에는 그에 따릅니다.", "The Operator reviews the facts and notifies the requester of the outcome and reasons, ordinarily within seven days of receipt. If further review is needed, it explains the reasons and schedule within the same period. Any specific statutory procedures or time limits take precedence."),
      t("명예훼손·사생활 침해 등에 따른 게시중단 요청, 저작권 침해에 따른 복제·전송 중단 및 재개 요청은 관계 법령에서 정한 요건과 절차에 따라 처리합니다. 이의 제기 절차의 이용은 법령에 따른 권리구제나 소송 제기를 제한하지 않습니다.", "Requests to suspend publication for defamation or privacy infringement and requests to suspend or resume reproduction or transmission for copyright infringement are handled under applicable statutory requirements and procedures. Internal objections do not limit legal remedies or access to courts."),
    ],
  },
  {
    id: "participation",
    number: 13,
    title: t("설문·투표 및 행사 참여", "Participation in surveys, votes, and events"),
    paragraphs: [
      t("운영자는 설문·투표·행사의 주최자, 참여 기간, 대상 및 주요 참여 조건을 해당 화면에 안내합니다. 설문 응답의 수정·철회 여부와 결과의 공개 범위는 기능별 안내에 따르되, 해당 안내로 법령상 개인정보에 관한 권리를 제한하지 않습니다.", "The Operator identifies the organizer, participation period, audience, and principal conditions on the relevant screen. The availability of survey-response editing or withdrawal and result visibility follow the feature-specific notice without limiting statutory privacy rights."),
      t("투표 참여 자격은 게시 시점에 확정된 명부와 해당 투표의 조건에 따릅니다. 명부 누락 또는 자격 정보의 오류가 있는 이용자는 투표 기간 내에 정정·검토를 요청할 수 있으며, 운영자는 해당 투표의 운영 기준과 사실관계에 따라 처리합니다.", "Voting eligibility follows the roster fixed at publication and the conditions for the vote. Users omitted from the roster or affected by incorrect eligibility information may request correction or review during the voting period, and the Operator handles the request under the relevant voting rules and facts."),
      t("투표는 해당 투표별로 1회 제출할 수 있으며, 제출이 완료된 투표 내용은 수정하거나 개별적으로 철회할 수 없습니다. 운영자는 자격·참여 여부를 관리하는 명부와 투표 내용을 분리하고, 결과는 집계 후 정해진 공개 절차에 따라 제공합니다. 접수 확인은 투표의 선택 내용을 증명하는 것으로 보지 않습니다.", "Each vote allows one submission, which cannot be edited or individually withdrawn after completion. The Operator separates eligibility and participation records from ballot contents and releases results after tallying under the designated publication procedure. Confirmation of receipt does not certify ballot choices."),
      t("장애 등으로 참여의 공정성이나 결과의 신뢰성에 중대한 문제가 발생한 경우 운영자는 해당 운영 규정에 따라 기간 연장, 재참여 등 필요한 조치를 하고 그 사유와 처리 내용을 안내합니다. 행사 취소·일정 변경 또는 참가비 환급에 관한 사항은 주최자가 사전에 고지한 조건 및 관계 법령에 따릅니다.", "If an incident materially affects fair participation or result integrity, the Operator takes necessary measures, such as an extension or renewed participation, under the applicable rules and explains the reasons and outcome. Event cancellation, rescheduling, and refunds follow the organizer’s prior terms and applicable law."),
    ],
  },
  {
    id: "fees",
    number: 14,
    title: t("학생회비 납부 내역 관리", "Administration of student-fee records"),
    paragraphs: [
      t("학생회비 관리 기능은 운영자가 확인한 납부금액, 납부일, 적용 학기 등을 기록하고 혜택 자격을 확인하기 위한 기능입니다. 계좌이체·현금 납부 등 실제 결제는 서비스 외부에서 이루어집니다.", "The student-fee feature records verified amounts, payment dates, covered semesters, and related information and supports benefit-eligibility checks. Actual payments, including transfers and cash payments, take place outside the Service."),
      t("학생회비의 금액, 적용 기간, 감면·환급 및 혜택에 관한 사항은 해당 학생자치 규정과 사전에 공지한 납부 안내 및 관계 법령에 따릅니다. 이 약관만으로 납부 의무가 발생하거나 환급을 청구할 권리가 제한되지 않습니다.", "Amounts, coverage periods, reductions, refunds, and benefits follow the relevant student self-governance rules, prior payment notices, and applicable law. These Terms alone do not create a payment obligation or restrict a right to request a refund."),
      t("이용자는 납부 내역이나 자격 정보의 오류에 대하여 정정을 요청할 수 있습니다. 운영자는 필요한 최소한의 증빙으로 사실관계를 확인하고 그 결과를 안내합니다. 웹사이트 탈퇴 또는 계정 제한만을 이유로 이미 성립한 학생회비 관련 권리·의무가 소멸하지 않습니다.", "Users may request correction of payment or eligibility records. The Operator verifies the facts using the minimum necessary supporting documents and informs the User of the result. Website account closure or restriction alone does not extinguish existing rights or obligations concerning student fees."),
    ],
  },
  {
    id: "ip-links",
    number: 15,
    title: t("지식재산권 및 외부 서비스", "Intellectual property and external services"),
    paragraphs: [
      t("서비스의 로고, 디자인, 소프트웨어 및 운영자가 작성한 자료에 관한 권리는 운영자 또는 정당한 권리자에게 귀속됩니다. 이용자는 법령상 허용되거나 권리자로부터 허락받은 범위에서 이를 이용할 수 있습니다. 별도의 오픈소스 라이선스 등이 적용되는 자료는 해당 이용조건에 따릅니다.", "Rights in Service logos, design, software, and Operator-created materials belong to the Operator or their respective rights holders. Users may use them within statutory permissions or the rights holder’s authorization. Materials subject to a separate license, including an open-source license, follow that license."),
      t("SSO, 상담 도구 및 외부 링크로 연결되는 서비스에는 해당 제공자의 약관과 개인정보처리방침이 적용될 수 있습니다. 운영자는 외부 서비스라는 사정만으로 자신의 귀책사유에 따른 책임 또는 법령상 의무를 면하지 않습니다.", "SSO, support tools, and externally linked services may be subject to their providers’ terms and privacy policies. Use of an external service does not release the Operator from liability arising from its own fault or from statutory obligations."),
    ],
  },
  {
    id: "privacy",
    number: 16,
    title: t("개인정보 보호", "Protection of personal information"),
    paragraphs: [
      t("운영자는 「개인정보 보호법」 등 관계 법령에 따라 이용자의 개인정보를 보호하며, 처리 목적·항목·보유기간, 처리위탁·국외이전 및 권리 행사 방법을 개인정보처리방침에 공개합니다. 개인정보의 수집·이용, 제3자 제공 또는 국외이전 등에 별도의 동의가 필요한 경우 이 약관에 대한 동의로 이를 갈음하지 않습니다.", "The Operator protects personal information under applicable law, including the Personal Information Protection Act, and publishes purposes, data items, retention, processing arrangements, overseas transfers, and rights procedures in the Privacy Policy. Agreement to these Terms does not replace any separate consent required for collection, use, third-party provision, or overseas transfer."),
      t("이용자는 개인정보처리방침에 따라 개인정보의 열람, 정정·삭제, 처리정지 및 동의 철회를 요청할 수 있습니다. 이용계약 해지 및 게시물 삭제에 따른 정보의 처리는 제17조와 개인정보처리방침에 따릅니다.", "Users may request access, correction, deletion, suspension of processing, or withdrawal of consent as described in the Privacy Policy. Information following termination or Post deletion is handled under Section 17 and the Privacy Policy."),
    ],
  },
  {
    id: "termination",
    number: 17,
    title: t("회원 탈퇴 및 이용계약 해지", "Account closure and termination"),
    paragraphs: [
      t(`회원은 언제든지 ${CONTACT_EMAIL}으로 회원 탈퇴 또는 동의 철회를 요청하여 이용계약을 해지할 수 있습니다. 운영자는 본인 확인에 필요한 최소한의 절차를 거쳐 지체 없이 처리하고 그 결과를 통지합니다. 회원 탈퇴는 KAIST SSO 계정 자체의 삭제 또는 학생자치단체에서의 탈퇴를 의미하지 않습니다.`, `Members may terminate their agreement at any time by requesting account closure or withdrawal of consent at ${CONTACT_EMAIL}. The Operator processes the request without undue delay after minimal identity verification and notifies the Member of the result. Closure does not delete the KAIST SSO account or constitute withdrawal from the student self-governance organization.`),
      t("회원은 탈퇴 전에 본인의 게시물을 직접 정리하거나 탈퇴 요청 시 함께 삭제를 요청할 수 있습니다. 회원 탈퇴만으로 모든 게시물과 다른 이용자의 답글·인용문이 자동 삭제되는 것은 아닙니다. 탈퇴 후에도 본인 게시물의 삭제를 요청할 수 있으며, 운영자는 개인정보처리방침 및 관계 법령에 따라 처리합니다.", "Members may manage their Posts before closure or include a deletion request with their closure request. Closure alone does not automatically delete every Post or other Users’ replies and quotations. Former Members may still request deletion of their Posts, which the Operator handles under the Privacy Policy and applicable law."),
      t("이용계약 종료 후 개인정보와 이용 기록은 개인정보처리방침에서 정한 기준에 따라 파기합니다. 법령상 의무 또는 구체적인 분쟁 처리에 필요한 정보는 적법한 근거와 정해진 보유기간 내에서만 보존하며, 단순한 운영 편의를 이유로 무기한 보존하지 않습니다. 운영자가 약관 위반을 이유로 이용계약을 해지하는 경우에는 제11조의 통지 및 이의 제기 절차를 따릅니다.", "After termination, personal information and usage records are destroyed under the Privacy Policy. Information needed for statutory obligations or a specific dispute is retained only on a lawful basis and for a defined period, not indefinitely for administrative convenience. Operator-initiated termination for a breach follows the notice and objection procedures in Section 11."),
    ],
  },
  {
    id: "liability",
    number: 18,
    title: t("손해배상 및 책임의 제한", "Damages and limitations of liability"),
    paragraphs: [
      t("운영자 또는 이용자가 관계 법령이나 이 약관을 위반하여 상대방에게 손해를 입힌 경우 귀책사유, 인과관계 등 관계 법령에서 정한 요건에 따라 손해를 배상할 책임을 부담합니다. 서비스가 무료로 제공된다는 사정만으로 운영자의 책임이 면제되지 않습니다.", "If the Operator or a User causes loss to the other party through a violation of law or these Terms, liability for damages follows applicable legal requirements, including fault and causation. The fact that the Service is free does not by itself exempt the Operator from liability."),
      t("운영자는 천재지변 등 불가항력 또는 이용자의 귀책사유로 발생한 손해 중 운영자에게 귀책사유가 없는 부분에 대하여 책임을 부담하지 않습니다. 통신·호스팅·SSO 등 외부 서비스의 장애가 발생한 경우에도 운영자의 선정·관리·대응상 귀책사유가 있는지에 따라 책임을 판단합니다.", "The Operator is not liable for losses caused by force majeure or a User’s fault to the extent that no fault is attributable to the Operator. For failures of network, hosting, SSO, or other external services, responsibility depends on any fault in the Operator’s selection, management, or response."),
      t("운영자는 이용자 게시물이나 외부 정보의 정확성·완전성을 보증하지 않습니다. 다만, 운영자가 부담하는 권리침해 대응 등 법령상 의무는 이로써 배제되지 않습니다. 이 약관의 어떠한 조항도 운영자 또는 그 업무 수행자의 고의·중대한 과실에 따른 책임이나 법령상 제한할 수 없는 이용자의 권리를 배제하지 않습니다.", "The Operator does not warrant the accuracy or completeness of User Posts or external information. This does not exclude statutory duties, including responses to rights infringements. No provision excludes liability for intentional misconduct or gross negligence by the Operator or those acting on its behalf, or limits non-waivable User rights."),
    ],
  },
  {
    id: "contact-dispute",
    number: 19,
    title: t("분쟁 해결 및 약관의 해석", "Dispute resolution and interpretation"),
    paragraphs: [
      t(`서비스 이용, 게시물, 참여 자격, 학생회비 기록 및 이 약관에 관한 문의·불만은 ${CONTACT_EMAIL}으로 접수합니다. 운영자는 제12조의 처리 기준에 따라 답변하며, 분쟁이 발생한 경우 당사자는 해결을 위하여 성실히 협의합니다.`, `Questions and complaints about the Service, Posts, eligibility, student-fee records, or these Terms may be sent to ${CONTACT_EMAIL}. The Operator responds under Section 12. The parties will seek to resolve disputes through good-faith discussions.`),
      t("이 약관에 정하지 않은 사항은 관계 법령 및 적법하게 고지된 개별 이용조건에 따릅니다. 개별 이용조건이나 운영정책으로 이 약관의 개정 절차를 거치지 않고 이용자에게 새로운 의무를 부과하거나 중요한 권리를 제한할 수 없습니다. 약관의 뜻이 명백하지 않은 경우에는 이용자에게 유리하게 해석합니다.", "Matters not addressed in these Terms follow applicable law and duly notified lawful feature-specific conditions. Such conditions or operating policies may not impose new obligations or restrict material rights without the amendment procedure required by these Terms. Ambiguities are interpreted in the User’s favor."),
      t("이 약관은 대한민국 법률에 따라 해석하며, 서비스 이용과 관련한 소송의 관할은 「민사소송법」 등 관계 법령에 따릅니다. 일부 조항이 무효가 되더라도 나머지 조항은 관계 법령에서 허용하는 범위에서 유효합니다. 영문 번역은 이용자의 이해를 돕기 위한 것으로, 국문과 영문 사이에 차이가 있는 경우 관계 법령이 허용하는 범위에서 국문을 기준으로 합니다.", "These Terms are governed by the laws of the Republic of Korea. Jurisdiction follows the Civil Procedure Act and other applicable law. If a provision is invalid, the remaining provisions remain effective to the extent permitted by law. The English translation is provided for convenience; in case of a discrepancy, the Korean text governs to the extent permitted by law."),
    ],
  },
  {
    id: "effective-date",
    number: 20,
    title: t("부칙", "Effective date"),
    paragraphs: [t("이 약관은 서비스 최초 공개일인 2026년 11월 2일부터 시행합니다.", "These Terms take effect on November 2, 2026, the date of the Service’s initial public launch.")],
  },
];

const privacySections: readonly LegalSection[] = [
  {
    id: "privacy-overview",
    number: 1,
    title: t("개인정보처리자 및 적용 범위", "Controller and scope"),
    paragraphs: [
      t(
        "KAIST 전산학부 집행위원회(이하 ‘운영자’)는 「개인정보 보호법」 제30조에 따라 개인정보의 처리 기준과 보호조치를 안내하기 위하여 이 개인정보처리방침을 수립·공개합니다.",
        "The SoC Student Council, School of Computing, KAIST (the “Operator”) establishes and publishes this Privacy Policy under Article 30 of the Personal Information Protection Act to explain its personal information processing standards and safeguards.",
      ),
      t(
        "이 방침은 웹사이트의 회원 관리, 게시판, 행사·일정, 설문·투표, 학생회비(과비) 관리, 집행위원 연락망 및 문의·상담 업무에 적용됩니다.",
        "This Policy applies to account management, boards, events and schedules, surveys and votes, student-fee administration, the executive committee’s internal contact directory, and inquiry and support services provided through the website.",
      ),
    ],
  },
  {
    id: "privacy-items",
    number: 2,
    title: t("처리하는 개인정보의 항목 및 수집 방법", "Personal information and collection methods"),
    paragraphs: [
      t(
        "운영자는 서비스 제공과 학생자치 업무에 필요한 최소한의 개인정보를 다음과 같이 처리합니다.",
        "The Operator processes the following personal information to the minimum extent needed to provide the service and carry out student council activities.",
      ),
    ],
    groups: [
      {
        label: t("SSO 연동 정보", "SSO information"),
        value: t(
          "수집 항목: KAIST UID, 성명(한글·영문), 학번, 이메일 주소, 소속 학과, 주전공, 신분코드(KAIST 구성원 구분 코드)\n수집 방법: KAIST SSO 로그인 과정에서 인증정보를 제공받으며, 개인정보 수집·이용에 동의한 경우 회원 계정에 저장합니다.",
          "Information: KAIST UID, Korean and English names, student number, email address, department, primary major, and member code (KAIST membership classification code).\nMethod: Authentication information is received during KAIST SSO sign-in and saved to a member account when the user consents to collection and use.",
        ),
      },
      {
        label: t("동의·인증 정보", "Consent and authentication information"),
        value: t(
          "수집 항목: 개인정보 수집·이용 동의 시각, 로그인 진행 상태, 인증·세션 쿠키 식별자, 임시 로그인 토큰, 최근 로그인 시각\n수집 방법: 로그인, 동의 처리 및 세션 유지 과정에서 자동으로 생성합니다.",
          "Information: Consent timestamp, sign-in progress, authentication and session cookie identifiers, temporary sign-in tokens, and last sign-in time.\nMethod: Generated during sign-in, consent processing, and session maintenance.",
        ),
      },
      {
        label: t("게시판·커뮤니티 정보", "Board and community information"),
        value: t(
          "수집 항목: 게시글·댓글의 제목과 내용, 작성자 식별정보, 공개·비밀·익명 설정, 좋아요·스크랩·조회 기록, 신고·숨김 처리 내역, 초안, 첨부파일\n수집 방법: 이용자가 직접 작성·선택·업로드하거나 서비스 이용 과정에서 생성합니다.",
          "Information: Post and comment titles and content, author identifiers, visibility and anonymity settings, likes, saved posts, view records, reports, moderation records, drafts, and attachments.\nMethod: Entered, selected, or uploaded by users, or generated during use of the service.",
        ),
      },
      {
        label: t("설문·투표 정보", "Survey and voting information"),
        value: t(
          "수집 항목: 설문 응답과 문항별 답변, 응답 상태, 제출 시각, 투표 참여 자격 명부의 성명·학번·이메일 주소·주전공·학생회비 납부 상태, 투표 참여 기록, 암호화된 투표용지, 집계 결과\n수집 방법: 이용자의 설문·투표 참여와 운영자의 참여 자격 명부 작성 과정에서 수집·생성합니다.",
          "Information: Survey responses and individual answers, response status, submission time, voter-list names, student numbers, email addresses, primary majors, student-fee status, participation records, encrypted ballots, and tally results.\nMethod: Collected or generated through participation in surveys and votes and preparation of eligibility lists.",
        ),
      },
      {
        label: t("학생회비 납부 정보", "Student-fee information"),
        value: t(
          "수집 항목: 납부자 식별정보, 납부금액, 납부 유형·수단, 적용 시작 학기, 적용 학기 수, 납부일, 비고, 확인 담당자, 확인 시각\n수집 방법: 운영자가 계좌이체·현금 납부 내역을 확인하여 입력·수정합니다.",
          "Information: Payer identifiers, payment amount, payment type and method, first covered semester, number of covered semesters, payment date, notes, verifying administrator, and verification time.\nMethod: Entered or updated by administrators after checking bank-transfer or cash-payment records.",
        ),
      },
      {
        label: t("집행위원 연락망 정보", "Executive committee contact information"),
        value: t(
          "수집 항목: 성명, 학번, 이메일 주소, 전화번호, 부서, 직책, 활동 이력\n수집 방법: 집행위원이 제공한 정보를 담당자가 입력하거나 일괄 등록합니다.",
          "Information: Name, student number, email address, phone number, department, position, and activity history.\nMethod: Information supplied by executive committee members is entered or imported by an administrator.",
        ),
      },
      {
        label: t("문의·상담 정보", "Inquiry and support information"),
        value: t(
          "수집 항목: 회원 식별자, 성명, 이메일 주소, 문의 내용, 첨부파일\n수집 방법: 이메일·채널톡을 통해 이용자가 입력·전송한 정보를 수집하며, 채널톡 회원 프로필 연동 시 회원 식별자·성명·이메일 주소를 전달합니다.",
          "Information: Member identifier, name, email address, inquiry content, and attachments.\nMethod: Collected from information entered or sent through email or Channel Talk. Member identifiers, names, and email addresses are also transmitted when member profiles are linked to Channel Talk.",
        ),
      },
      {
        label: t("운영·보안 기록", "Operational and security records"),
        value: t(
          "수집 항목: 개인정보취급자(개인정보 처리 업무를 담당하는 사람)의 식별정보, 접속 시각·IP 주소, 처리 대상·업무 내역, 계정·접근 권한 변경 내역, 파일 업로드 정보\n수집 방법: 관리자 기능 이용과 개인정보 처리 과정에서 자동으로 생성합니다.",
          "Information: Administrator identifiers, access times and IP addresses, affected records and processing actions, account and access-permission changes, and file-upload information.\nMethod: Generated during use of administrator features and processing of personal information.",
        ),
      },
    ],
  },
  {
    id: "privacy-purposes",
    number: 3,
    title: t("개인정보의 처리 목적", "Purposes of processing"),
    paragraphs: [
      t(
        "운영자는 다음의 목적을 위하여 개인정보를 처리합니다. 처리 목적을 변경하는 경우에는 관계 법령에 따라 별도의 동의를 받는 등 필요한 조치를 이행합니다.",
        "The Operator processes personal information for the following purposes. If a purpose changes, the Operator takes the steps required by applicable law, including obtaining separate consent where required.",
      ),
    ],
    bullets: [
      t(
        "회원 관리: KAIST 구성원 확인, 계정 생성·갱신, 로그인·로그아웃, 세션 관리",
        "Account management: verifying KAIST membership, creating and updating accounts, sign-in and sign-out, and session management",
      ),
      t(
        "게시판 운영: 게시글·댓글·첨부파일 제공, 공개 범위 적용, 좋아요·스크랩·신고 처리",
        "Board operation: providing posts, comments, and attachments; applying visibility settings; and processing likes, saved posts, and reports",
      ),
      t(
        "설문·투표 운영: 참여 자격 확인, 응답·투표 접수, 중복 참여 방지, 집계 무결성(참여 기록과 집계 결과의 일관성·정확성) 확인, 결과 제공",
        "Surveys and votes: checking eligibility, accepting submissions, preventing duplicate participation, checking tally integrity (consistency and accuracy of participation records and results), and providing results",
      ),
      t(
        "학생회비 관리: 납부 확인, 학기별 혜택 자격 확인, 수납·회계 결산·감사",
        "Student-fee administration: verifying payments and semester benefits, collecting fees, closing accounts, and conducting audits",
      ),
      t(
        "집행위원 연락망 관리: 업무 연락, 담당자 확인, 인수인계",
        "Executive committee contact management: internal communication, identifying responsible staff, and handover",
      ),
      t(
        "문의·상담 처리: 문의 답변, 민원 처리, 권리 행사 접수·처리",
        "Inquiry and support services: responding to inquiries and complaints and handling privacy rights requests",
      ),
      t(
        "서비스 운영·보안: 운영자 권한 관리, 부정 이용 방지, 보안 점검, 법령상 의무 이행",
        "Service operation and security: managing administrator permissions, preventing misuse, reviewing security, and fulfilling legal obligations",
      ),
    ],
  },
  {
    id: "privacy-retention",
    number: 4,
    title: t("개인정보의 처리 및 보유기간", "Processing and retention periods"),
    paragraphs: [
      t(
        "운영자는 동의받은 기간, 서비스 제공에 필요한 기간 또는 관계 법령에서 정한 기간 내에서 개인정보를 처리·보유합니다. 항목별 보유기간은 다음과 같습니다.",
        "The Operator processes and retains personal information within the period covered by consent, needed to provide the service, or prescribed by applicable law. Retention periods are set out below.",
      ),
    ],
    groups: [
      {
        label: t("회원·SSO·동의 정보", "Account, SSO, and consent information"),
        value: t(
          "회원 탈퇴, 동의 철회 또는 서비스 종료 시까지 보유합니다.",
          "Retained until account closure, withdrawal of consent, or termination of the service.",
        ),
      },
      {
        label: t("로그인 대기·세션 정보", "Pending sign-in and session information"),
        value: t(
          "로그인 대기 정보는 동의 처리 완료 시 또는 생성일부터 최대 10분의 유효기간 만료 시 파기합니다.\n회원 세션은 발급·갱신 후 1시간 동안 유지하며, 최초 발급일부터 최대 14일까지만 갱신합니다.\n임시 접근토큰은 로그인 대기 정보의 남은 유효기간 내에서 최대 10분간 유효합니다.",
          "Pending sign-in information is destroyed when the consent decision is processed or its validity period of at most ten minutes expires.\nMember sessions remain valid for one hour after issuance or renewal and may be renewed for at most fourteen days from initial issuance.\nTemporary access tokens remain valid for at most ten minutes within the remaining validity of the pending sign-in information.",
        ),
      },
      {
        label: t("게시글·댓글·연결 첨부파일", "Posts, comments, and linked attachments"),
        value: t(
          "게시 중인 동안 보유하며, 삭제 요청이 처리되면 지체 없이 파기합니다.",
          "Retained while published and destroyed without undue delay when a deletion request is fulfilled.",
        ),
      },
      {
        label: t("작성 중인 초안", "Drafts"),
        value: t(
          "마지막 수정일부터 30일간 보유합니다. 브라우저에 저장된 초안은 제13조에 따라 관리합니다.",
          "Retained for thirty days from the latest edit. Browser-stored drafts are managed as described in Section 13.",
        ),
      },
      {
        label: t("미연결 업로드 파일", "Unlinked uploads"),
        value: t(
          "게시글·설문·초안에 연결되지 않은 업로드 파일은 업로드 후 24시간이 경과하면 파기 대상으로 처리합니다.",
          "Uploads not linked to a post, survey, or draft are designated for destruction twenty-four hours after upload.",
        ),
      },
      {
        label: t("설문 응답·행사 신청 정보", "Survey responses and event registrations"),
        value: t(
          "설문 응답은 결과 확정일부터 90일간 보유합니다. 행사 신청 정보는 행사 종료일과 정산 완료일 중 늦은 날부터 90일간 보유합니다.",
          "Survey responses are retained for ninety days from confirmation of the results. Event registrations are retained for ninety days from the later of the end of the event and completion of settlement.",
        ),
      },
      {
        label: t("투표 명부·참여 기록·개별 투표 데이터", "Voter lists, participation records, and individual ballots"),
        value: t(
          "결과 확정일과 이의 제기 절차 종료일 중 늦은 날부터 90일간 보유합니다.",
          "Retained for ninety days from the later of confirmation of the results and completion of the objection process.",
        ),
      },
      {
        label: t("학생회비 납부 원장", "Student-fee payment ledger"),
        value: t(
          "최종 적용 학기 종료일과 결산 확정일 중 늦은 날부터 3년간 보유합니다. 납부 확인과 회계 검증에 필요한 최소한의 항목으로 보유 범위를 제한합니다.",
          "Retained for three years from the later of the end of the last covered semester and confirmation of the closing of accounts. Retention is limited to the minimum information needed to verify payments and accounts.",
        ),
      },
      {
        label: t("문의·상담 내역", "Inquiry and support records"),
        value: t(
          "상담 종료일부터 1년간 보유합니다.",
          "Retained for one year from closure of the support inquiry.",
        ),
      },
      {
        label: t("집행위원 연락망", "Executive committee contacts"),
        value: t(
          "임기 또는 담당 업무 종료일부터 90일간 보유합니다.",
          "Retained for ninety days from the end of the term or assigned duties.",
        ),
      },
      {
        label: t("운영·보안 기록", "Operational and security records"),
        value: t(
          "기록 생성일부터 2년간 보유합니다. 개인정보취급자의 접속기록은 「개인정보의 안전성 확보조치 기준」 제8조에 따른 법정 최소 보존기간(원칙 1년, 민감정보·고유식별정보 처리 등 해당 시 2년)을 충족하도록 2년간 보유합니다.",
          "Retained for two years from creation. Administrator access records are retained for two years to meet Article 8 of the Standards for Ensuring the Safety of Personal Information, which requires at least one year, or at least two years in specified cases such as processing sensitive information or statutory unique identifiers.",
        ),
      },
      {
        label: t("접근 권한 변경 기록", "Access-permission records"),
        value: t(
          "개인정보취급자의 권한 부여·변경·말소 내역은 해당 처리일부터 3년간 보존합니다. 근거는 「개인정보의 안전성 확보조치 기준」 제5조제3항입니다.",
          "Records of granting, changing, or revoking administrators’ access permissions are preserved for three years from the action under Article 5(3) of the Standards for Ensuring the Safety of Personal Information.",
        ),
      },
      {
        label: t("복구용 백업", "Recovery backups"),
        value: t(
          "파일 생성일부터 30일간 보관한 후 정기 정리 시 파기합니다. 백업을 이유로 원본 개인정보의 보유기간을 연장하지 않습니다.",
          "Kept for thirty days from file creation and destroyed during scheduled cleanup thereafter. Backups do not extend the retention period of the underlying personal information.",
        ),
      },
    ],
  },
  {
    id: "privacy-destruction",
    number: 5,
    title: t("개인정보의 파기 절차 및 방법", "Destruction procedures and methods"),
    paragraphs: [
      t(
        "운영자는 보유기간이 경과하거나 처리 목적이 달성되어 불필요하게 된 개인정보를 지체 없이 파기합니다. 다른 법령에 따라 보존하여야 하는 경우에는 해당 항목을 다른 개인정보와 분리하여 저장·관리합니다.",
        "The Operator destroys personal information without undue delay when its retention period ends or its processing purpose is achieved and it is no longer needed. Information that must be preserved under other laws is stored and managed separately.",
      ),
      t(
        "전자적 파일은 복구·재생할 수 없는 방법으로 삭제하고, 종이 문서는 분쇄하거나 소각합니다. 삭제 대상 정보가 첨부파일·백업·외부 위탁 서비스에 보관된 경우에는 해당 사본도 파기 절차에 포함합니다.",
        "Electronic files are deleted using methods that prevent recovery or reproduction, and paper documents are shredded or incinerated. Destruction procedures also cover copies held in attachments, backups, and outsourced services.",
      ),
      t(
        "게시글·댓글의 파기는 화면 표시의 제거뿐 아니라 저장된 원문과 작성자 연결정보의 삭제를 포함합니다.",
        "Destruction of posts and comments includes deletion of stored content and links to the author, in addition to removal from display.",
      ),
      t(
        "진행 중인 수사·조사 또는 개별 분쟁으로 보존이 필요한 경우에는 적법한 처리 근거와 보존 범위를 확인한 후 해당 절차가 종료될 때까지 필요한 정보만 보존합니다.",
        "Where an ongoing investigation or individual dispute requires preservation, the Operator verifies the legal basis and scope and preserves only the information needed until that process ends.",
      ),
    ],
  },
  {
    id: "privacy-sharing",
    number: 6,
    title: t("개인정보의 제3자 제공", "Disclosure to third parties"),
    paragraphs: [
      t(
        "운영자는 이용자의 동의 또는 법령상 근거가 있는 경우에 한하여 개인정보를 제3자에게 제공합니다.",
        "The Operator discloses personal information to third parties only with the user’s consent or on a statutory basis.",
      ),
      t(
        "공개 게시판의 게시글·댓글과 첨부파일은 이용자가 선택한 공개 범위에 따라 다른 이용자에게 표시됩니다.",
        "Posts, comments, and attachments on public boards are displayed to other users according to the selected visibility settings.",
      ),
    ],
  },
  {
    id: "privacy-outsourcing",
    number: 7,
    title: t("외부 서비스 이용 및 개인정보 처리위탁", "External services and outsourced processing"),
    paragraphs: [
      t(
        "서비스 운영에 이용하는 외부 기관·서비스와 처리 업무는 다음과 같습니다.",
        "The external organizations and services used to operate the service and their processing tasks are listed below.",
      ),
    ],
    bullets: [
      t(
        "채널톡과 회원 프로필 연동이 활성화된 화면에서는 상담창을 열기 전에도 회원 식별자·성명·이메일 주소를 채널톡에 전달합니다. 문의 내용과 첨부파일은 이용자가 상담 과정에서 입력·전송할 때 처리합니다.",
        "On pages where Channel Talk and member profile linking are enabled, member identifiers, names, and email addresses are transmitted before the messenger is opened. Inquiry content and attachments are processed when users enter or send them during a conversation.",
      ),
      t(
        "AI 상담에 따른 국외 이전은 제8조에 따릅니다.",
        "Cross-border transfers for AI support are described in Section 8.",
      ),
    ],
    groups: [
      {
        label: t("SPARCS", "SPARCS"),
        value: t(
          "서비스 운영 서버 및 데이터베이스 인프라의 호스팅을 관리합니다.",
          "Provides and manages server and database hosting infrastructure.",
        ),
      },
      {
        label: t("KAIST SSO", "KAIST SSO"),
        value: t(
          "로그인 인증과 회원 식별·계정 연계에 필요한 인증정보를 제공합니다.",
          "Provides sign-in authentication and authentication information for member identification and account linking.",
        ),
      },
      {
        label: t("주식회사 채널코퍼레이션(채널톡)", "Channel Corporation (Channel Talk)"),
        value: t(
          "온라인 문의 메신저 및 AI 상담(ALF)을 제공합니다.",
          "Provides the online support messenger and AI-assisted support (ALF).",
        ),
      },
    ],
  },
  {
    id: "privacy-overseas",
    number: 8,
    title: t("개인정보의 국외 이전", "Cross-border transfers"),
    paragraphs: [
      t(
        "운영자는 이용자가 요청한 채널톡 AI 상담(ALF)을 제공하기 위하여 상담 내용에 포함된 개인정보의 처리를 채널톡을 통해 다음의 AI 제공사에 재위탁합니다.",
        "To provide Channel Talk AI support (ALF) requested by users, the Operator uses the following AI subprocessors through Channel Talk to process personal information included in support conversations.",
      ),
      t(
        "이전받는 자의 명칭, 처리 지역, 문의처 및 처리 조건은 채널톡 공식 개인정보처리방침(https://channel.io/kr/privacy)의 AI 수탁자 공시를 기준으로 기재합니다. 글로벌 리전의 실제 처리 지역은 제공사의 동적 라우팅에 따라 달라질 수 있습니다.",
        "Recipient names, processing regions, contacts, and processing terms follow the AI subprocessor disclosures in Channel Talk’s official Privacy Policy (https://channel.io/kr/privacy). The actual processing location within global regions may vary with the provider’s dynamic routing.",
      ),
    ],
    groups: [
      {
        label: t("국외 이전의 법적 근거", "Legal basis for cross-border transfers"),
        value: t(
          "이용자가 요청한 AI 상담의 제공에 필요한 처리위탁·보관으로서 「개인정보 보호법」 제28조의8제1항제3호가목에 따라 국외 이전에 관한 사항을 이 방침에 공개합니다.",
          "These transfers involve outsourced processing or storage necessary to provide AI support requested by users. Transfer details are disclosed in this Policy under Article 28-8(1)(3)(a) of the Personal Information Protection Act.",
        ),
      },
      {
        label: t("Google Cloud(Gemini·Vertex AI)", "Google Cloud (Gemini and Vertex AI)"),
        value: t(
          "이전 국가·지역: 글로벌 리전(전 세계 GCP 리전에서 동적으로 결정되는 처리 지역)\n문의처: googlekrsupport@google.com",
          "Countries and regions: Global regions (processing locations dynamically selected across GCP regions worldwide)\nContact: googlekrsupport@google.com",
        ),
      },
      {
        label: t("Anthropic", "Anthropic"),
        value: t(
          "이전 국가·지역: 글로벌 리전(미국·EU·아시아·호주)\n문의처: privacy@anthropic.com",
          "Countries and regions: Global regions (United States, EU, Asia, and Australia)\nContact: privacy@anthropic.com",
        ),
      },
      {
        label: t("OpenAI(ChatGPT)", "OpenAI (ChatGPT)"),
        value: t(
          "이전 국가·지역: 글로벌 리전(전 세계 Azure 리전에서 동적으로 결정되는 처리 지역)\n문의처: https://aka.ms/privacyresponse",
          "Countries and regions: Global regions (processing locations dynamically selected across Azure regions worldwide)\nContact: https://aka.ms/privacyresponse",
        ),
      },
      {
        label: t("AWS Bedrock", "AWS Bedrock"),
        value: t(
          "이전 국가·지역: 글로벌 리전(전 세계 AWS 상업 리전에서 동적으로 결정되는 처리 지역)\n문의처: aws-korea-privacy@amazon.com",
          "Countries and regions: Global regions (processing locations dynamically selected across AWS commercial regions worldwide)\nContact: aws-korea-privacy@amazon.com",
        ),
      },
      {
        label: t("이전 항목", "Information transferred"),
        value: t(
          "AI 상담에 전송된 메시지와 첨부자료에 포함된 개인정보를 이전합니다. 전송된 정보는 해당 AI 모델의 학습에 이용되지 않습니다.",
          "Personal information included in messages and attachments sent for AI support is transferred. The transferred information is not used to train the AI models.",
        ),
      },
      {
        label: t("이전 목적·시기 및 방법", "Purpose, timing, and method"),
        value: t(
          "AI 상담 답변을 생성하기 위하여 ALF 이용 시 필요한 정보를 암호화된 네트워크(TLS/SSL)로 전송합니다.",
          "When ALF is used, information needed to generate AI support responses is transferred over an encrypted network (TLS/SSL).",
        ),
      },
      {
        label: t("보유·이용 기간", "Retention period"),
        value: t(
          "채널톡이 공시한 처리 조건에 따라 AI 제공사에 전송된 정보는 이용자의 요청을 처리한 후 삭제합니다. 운영자가 채널톡에 보관하는 상담 내역은 상담 종료일부터 1년간 보유합니다.",
          "Under the processing terms disclosed by Channel Talk, information sent to AI providers is deleted after the user’s request is processed. Support records retained by the Operator in Channel Talk are kept for one year from closure of the inquiry.",
        ),
      },
      {
        label: t("이전 거부 및 권리 행사", "Refusal and rights requests"),
        value: t(
          "국외 이전을 원하지 않는 이용자는 AI 상담을 이용하지 않고 이메일(kaist.helloworld@gmail.com)로 문의할 수 있습니다. 이 경우 AI 상담은 제공되지 않으나 다른 웹사이트 기능의 이용에는 영향을 주지 않습니다. 개인정보의 처리정지·삭제 등 권리 요구는 제9조의 방법으로 접수합니다.",
          "Users who do not wish their information to be transferred abroad may avoid AI support and send inquiries to kaist.helloworld@gmail.com. AI support will not be provided in that case, but other website features remain available. Requests to suspend processing, delete information, or exercise other rights may be submitted as described in Section 9.",
        ),
      },
    ],
  },
  {
    id: "privacy-rights",
    number: 9,
    title: t("정보주체의 권리 및 행사 방법", "Data-subject rights and requests"),
    paragraphs: [
      t(
        "이용자는 개인정보의 열람, 정정·삭제, 처리정지(이하 ‘열람등요구’) 및 동의 철회를 요구할 수 있습니다. 열람등요구, 동의 철회 및 회원 탈퇴 요청은 kaist.helloworld@gmail.com으로 접수합니다.",
        "Users may request access, correction, deletion, or suspension of processing and may withdraw consent. These requests and requests to close an account may be submitted to kaist.helloworld@gmail.com.",
      ),
      t(
        "이용자는 법정대리인이나 위임받은 대리인을 통하여 권리를 행사할 수 있습니다. 운영자는 본인 또는 정당한 대리인 여부를 확인하는 데 필요한 최소한의 정보만 요청합니다.",
        "Users may exercise their rights through a legal or authorized representative. The Operator requests only the minimum information needed to verify the data subject or representative.",
      ),
      t(
        "운영자는 관계 법령에서 정한 절차와 기간에 따라 요청을 처리하고 결과를 통지합니다. 법령상 제한·거절 사유가 있는 경우에는 그 사유와 이의 제기 방법을 안내합니다.",
        "The Operator handles requests and notifies the requester of the result under the procedures and time limits set by applicable law. Where a statutory ground for restriction or refusal applies, the Operator explains the reason and how to object.",
      ),
      t(
        "개인정보 전송요구권은 관계 법령에서 정한 적용 대상과 범위에 따라 행사할 수 있습니다.",
        "Data-portability rights may be exercised within the scope and applicability defined by law.",
      ),
    ],
  },
  {
    id: "privacy-contact",
    number: 10,
    title: t("개인정보 보호책임자 및 고충처리 접수처", "Privacy officer and complaints contact"),
    paragraphs: [
      t(
        "운영자는 개인정보 보호에 관한 업무를 총괄하고 문의·고충 및 열람등요구를 처리하기 위하여 다음과 같이 담당자와 접수처를 지정합니다.",
        "The Operator designates the following officer and contact to oversee personal information protection and handle inquiries, complaints, and rights requests.",
      ),
    ],
    groups: [
      {
        label: t("개인정보 보호책임자", "Privacy officer"),
        value: t(
          "KAIST 전산학부 집행위원회 전산관리부 부장",
          "Head of IT Administration, SoC Student Council, School of Computing, KAIST",
        ),
      },
      {
        label: t("문의·열람등요구 접수처", "Inquiries and rights requests"),
        value: t(
          "kaist.helloworld@gmail.com",
          "kaist.helloworld@gmail.com",
        ),
      },
    ],
  },
  {
    id: "privacy-safeguards",
    number: 11,
    title: t("개인정보의 안전성 확보조치", "Security safeguards"),
    paragraphs: [
      t(
        "운영자는 개인정보의 안전성을 확보하기 위하여 다음의 조치를 적용합니다.",
        "The Operator applies the following measures to protect personal information.",
      ),
    ],
    bullets: [
      t(
        "접근 권한 관리: 업무상 필요한 운영자에게만 권한을 부여하고 역할별로 접근 범위를 제한합니다.",
        "Access permissions: Permissions are granted only to administrators who need them for their duties, with access limited by role.",
      ),
      t(
        "인증정보 보호: 인증정보와 세션을 안전하게 관리하고, 개인정보 수집·이용에 동의하지 않은 이용자의 회원 계정을 저장하지 않습니다.",
        "Authentication protection: Authentication information and sessions are managed securely, and member accounts are not stored without consent to collection and use.",
      ),
      t(
        "접속기록 관리: 개인정보 처리와 접근 권한 변경 내역을 기록하고 보안 점검에 이용합니다.",
        "Access records: Personal information processing and access-permission changes are recorded for security review.",
      ),
      t(
        "기술적 보호조치: 전송구간 암호화, 인증정보 접근 제한, 입력값 검증 및 파일 접근통제를 적용합니다.",
        "Technical safeguards: Network encryption, restricted access to authentication information, input validation, and file access controls are applied.",
      ),
    ],
  },
  {
    id: "privacy-automated",
    number: 12,
    title: t("자동화된 자격 확인", "Automated eligibility checks"),
    paragraphs: [
      t(
        "운영자는 로그인 여부, 소속·주전공, 학생회비 납부 상태 및 각 설문·투표·혜택에 설정된 조건에 따라 이용 자격을 자동으로 확인합니다. 정보가 사실과 다르거나 자격 확인 결과에 이의가 있는 경우에는 제9조의 방법으로 정정·검토를 요청할 수 있습니다.",
        "Eligibility is checked automatically using sign-in status, department, primary major, student-fee status, and the conditions set for each survey, vote, or benefit. Users may request correction or review under Section 9 if information is inaccurate or they object to an eligibility result.",
      ),
    ],
  },
  {
    id: "privacy-cookies",
    number: 13,
    title: t("자동 수집 장치 및 브라우저 저장정보", "Cookies and browser-stored information"),
    paragraphs: [
      t(
        "운영자는 로그인 유지와 보안을 위하여 쿠키를 사용합니다. 브라우저 설정에서 쿠키를 제한하면 로그인 기능의 이용이 제한될 수 있습니다.",
        "The Operator uses cookies to maintain sign-in and security. Restricting cookies in the browser settings may limit sign-in functionality.",
      ),
      t(
        "브라우저 저장소(localStorage·sessionStorage)에는 언어 설정, 게시글·설문 답변의 초안, 임시 인증정보 및 화면 상태를 저장합니다. 초안은 마지막 수정일부터 30일간 복원할 수 있으며, 기한이 지난 초안은 다음 서비스 접속 시 또는 서비스 이용 중 정기 정리 시 삭제합니다. 로그아웃 또는 로그인 세션 만료만으로 초안이 삭제되지는 않습니다.",
        "Browser storage (localStorage and sessionStorage) stores language preferences, post and survey drafts, temporary authentication information, and screen state. Drafts can be restored for thirty days from the latest edit; expired drafts are removed on the next visit or during periodic cleanup while the service is open. Sign-out or session expiry alone does not remove drafts.",
      ),
      t(
        "이용자는 브라우저 설정에서 이 사이트의 쿠키·사이트 데이터를 삭제할 수 있습니다. 사이트 데이터를 삭제하면 저장된 초안과 언어 설정도 삭제될 수 있습니다. 서버에 저장된 개인정보의 삭제는 제9조의 방법으로 요청할 수 있습니다.",
        "Users may clear this site’s cookies and site data in the browser settings. Doing so may also remove saved drafts and language preferences. Deletion of personal information stored on the server may be requested under Section 9.",
      ),
      t(
        "채널톡이 활성화된 화면에서는 채널톡의 쿠키 등 자동 수집 기술을 사용합니다. 회원정보의 전달 항목과 시점은 제7조에 따릅니다. 채널톡의 개인정보처리방침은 https://channel.io/kr/privacy 에서 확인할 수 있습니다.",
        "Pages where Channel Talk is enabled use Channel Talk’s cookies and other automatic collection technologies. The member information transferred and the timing are described in Section 7. Channel Talk’s Privacy Policy is available at https://channel.io/kr/privacy.",
      ),
      t(
        "운영자는 맞춤형 광고를 목적으로 광고 식별자나 행태정보를 별도로 수집하지 않습니다.",
        "The Operator does not separately collect advertising identifiers or behavioral information for personalized advertising.",
      ),
    ],
  },
  {
    id: "privacy-changes",
    number: 14,
    title: t("개인정보처리방침의 변경", "Changes to this Policy"),
    paragraphs: [
      t(
        "운영자는 이 방침을 변경하는 경우 시행일과 변경 내용을 이 페이지에 게시합니다. 중요한 변경 사항은 서비스 화면을 통해 별도로 안내하며, 관계 법령에 따라 동의가 필요한 경우에는 해당 절차를 이행합니다.",
        "When this Policy changes, the Operator publishes the effective date and changes on this page. Material changes are also announced through the service, and consent is obtained where required by applicable law.",
      ),
    ],
  },
  {
    id: "privacy-remedies",
    number: 15,
    title: t("권익침해 구제 방법", "Remedies for privacy violations"),
    paragraphs: [
      t(
        "이용자는 개인정보 침해에 대한 상담이나 피해구제를 위하여 다음 기관에 신고·상담 또는 분쟁조정을 신청할 수 있습니다.",
        "Users may contact the following organizations for advice, reporting, or mediation concerning privacy violations.",
      ),
    ],
    bullets: [
      t(
        "개인정보침해 신고센터: 국번 없이 118, privacy.kisa.or.kr",
        "KISA Privacy Infringement Report Center: 118, privacy.kisa.or.kr",
      ),
      t(
        "개인정보분쟁조정위원회: 국번 없이 1833-6972, www.kopico.go.kr",
        "Personal Information Dispute Mediation Committee: 1833-6972, www.kopico.go.kr",
      ),
    ],
  },
];

const documents: Record<"terms" | "privacy", LegalDocument> = {
  terms: {
    title: t("서비스 이용약관", "Terms of Service"),
    summary: t(
      "KAIST 전산학부 집행위원회가 제공하는 서비스의 이용조건 및 운영자와 이용자의 권리·의무를 규정합니다.",
      "Terms governing use of the Service provided by the SoC Student Council, School of Computing, KAIST, and the rights and obligations of the Operator and Users.",
    ),
    sectionsLabel: t("목차", "Contents"),
    versions: [{ version: "1.0", effectiveDate: EFFECTIVE_DATE, sections: termsSections }],
  },
  privacy: {
    title: t("개인정보처리방침", "Privacy Policy"),
    summary: t(
      "서비스에서 처리하는 개인정보의 항목·목적·보유기간과 이용자의 권리를 안내합니다.",
      "How the Service processes personal information, including items, purposes, retention, and User rights.",
    ),
    sectionsLabel: t("목차", "Contents"),
    versions: [{ version: "1.0", effectiveDate: PRIVACY_EFFECTIVE_DATE, sections: privacySections }],
  },
};

function localized(value: LegalText, lang: Language): string {
  return value[lang];
}

function LegalSectionView({ lang, section, kind }: { lang: Language; section: LegalSection; kind: "terms" | "privacy" }) {
  const isSupplementary = kind === "terms" && section.id === "effective-date";
  const BulletList = kind === "terms" ? "ol" : "ul";

  return (
    <section id={section.id} className="scroll-mt-24 break-words select-text px-5 py-7 md:px-8">
      <div className="min-w-0">
        <h2 className="text-lg font-semibold tracking-tight text-app-text-strong">
          {isSupplementary ? localized(section.title, lang) : lang === "ko"
            ? `제${section.number}조 (${localized(section.title, lang)})`
            : `${kind === "privacy" ? "Section" : "Article"} ${section.number} (${localized(section.title, lang)})`}
        </h2>

        {section.paragraphs?.length ? (
          <div className="mt-3 space-y-3 text-sm leading-6 text-app-text-body">
            {section.paragraphs.map((paragraph, index) => (
              <p key={`${section.id}-paragraph-${index}`}>
                {kind === "terms" && (section.paragraphs?.length ?? 0) > 1 ? (
                  <span className="mr-1">{lang === "ko" ? String.fromCharCode(0x2460 + index) : `(${index + 1})`}</span>
                ) : null}
                {localized(paragraph, lang)}
              </p>
            ))}
          </div>
        ) : null}

        {section.bullets?.length ? (
          <BulletList className={`mt-3 ${kind === "terms" ? "list-decimal" : "list-disc"} space-y-2 pl-5 text-sm leading-6 text-app-text-body marker:text-brand-primary`}>
            {section.bullets.map((bullet, index) => (
              <li key={`${section.id}-bullet-${index}`}>{localized(bullet, lang)}</li>
            ))}
          </BulletList>
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
                <dd className="min-w-0 whitespace-pre-line break-words text-sm leading-5 text-app-text-body">
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
  const [selectedVersions, setSelectedVersions] = useState<Partial<Record<"terms" | "privacy", string>>>({});
  const latestVersion = document.versions[0];
  const selectedVersion = document.versions.find((item) => item.version === selectedVersions[kind]) ?? latestVersion;

  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [kind, selectedVersion.version]);

  return (
    <PageShell>

      <PageMain>
        <PageHeader
          title={localized(document.title, lang)}
          containerClassName="max-w-[var(--ui-legal-max-width)]"
        />

        <PageContainer className="max-w-[var(--ui-legal-max-width)] pb-12">
          <article className="break-words overflow-hidden rounded-[var(--ui-card-radius)] border border-slate-200 bg-white shadow-card">
            <header className="border-b border-slate-200 bg-slate-50/70 px-5 py-6 md:px-8">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="min-w-0 text-sm leading-6 text-app-text-strong">
                  <span className="text-app-text-muted">{lang === "ko" ? "운영 주체:" : "Operator:"}</span>
                  <span className="ml-1 font-medium">{lang === "ko" ? OPERATOR_NAME : OPERATOR_NAME_EN}</span>
                </p>
                <SelectDropdown
                  id={`legal-${kind}-version`}
                  ariaLabel={`${localized(document.title, lang)} ${lang === "ko" ? "시행일 선택" : "effective date"}`}
                  value={selectedVersion.version}
                  options={document.versions.map((item) => ({
                    value: item.version,
                    label: `${item.effectiveDate.replaceAll(".", ". ")}.`,
                  }))}
                  onChange={(version) => setSelectedVersions((current) => ({ ...current, [kind]: version }))}
                  className="w-fit max-w-full self-end shrink-0"
                  buttonClassName="!w-auto gap-2 text-sm font-normal shadow-none"
                  optionClassName="!px-2 text-sm font-normal"
                />
              </div>
              <p className="mt-2 text-sm leading-6 text-app-text-body">
                {localized(document.summary, lang)}
              </p>
            </header>

            <nav aria-label={localized(document.sectionsLabel, lang)} className="border-b border-slate-200 bg-slate-50/70 px-5 py-4 md:px-8">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-app-text-muted">
                {localized(document.sectionsLabel, lang)}
              </p>
              <ol className="grid gap-x-8 gap-y-1 text-sm leading-6 text-app-text-body sm:grid-cols-2">
                {selectedVersion.sections.map((section) => (
                  <li className={kind === "terms" && section.id === "effective-date" ? "list-none" : "list-inside list-decimal marker:text-app-text-muted"} key={section.id}>
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
              {selectedVersion.sections.map((section) => (
                <LegalSectionView key={section.id} lang={lang} section={section} kind={kind} />
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
