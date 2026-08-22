import { useState } from "react";
import { ChevronDown, CircleHelp } from "lucide-react";

import { Header } from "@/components/organisms/header";
import { PageHeader, PageShell } from "@/components/ui/page-layout";
import { useLanguage } from "@/hooks/use-language";
import { Button } from "@/components/ui/button";

const FAQ_ITEMS = [
  {
    questionKo: "로그인했는데 사이트 기능을 사용할 수 없어요.",
    questionEn: "Why can’t I use the site after logging in?",
    answerKo: "SOC Web은 전산학부 구성원을 위한 서비스입니다. 로그인 계정의 소속·학적 정보가 확인되지 않으면 일부 기능의 권한이 만료될 수 있습니다.",
    answerEn: "SOC Web is for School of Computing members. Some permissions may expire when the account’s department or academic status cannot be verified.",
  },
  {
    questionKo: "비밀글은 누가 볼 수 있나요?",
    questionEn: "Who can see a secret post?",
    answerKo: "게시판에서 비밀글을 허용한 경우에만 작성할 수 있으며, 작성자와 해당 게시판을 관리할 권한이 있는 운영자에게만 내용이 공개됩니다.",
    answerEn: "Secret posts are available only on boards that allow them. The author and authorized board managers can read the content.",
  },
  {
    questionKo: "Q&A는 어디에 문의하나요?",
    questionEn: "Where should I ask a question?",
    answerKo: "기존 Q&A 게시판 대신 화면 오른쪽 아래의 채널톡 문의를 이용해 주세요. 기존 Q&A 링크는 읽기 전용 보존 경로로 유지됩니다.",
    answerEn: "Use the Channel Talk messenger instead of the legacy Q&A board. Existing Q&A links remain available as read-only legacy pages.",
  },
  {
    questionKo: "행사와 학사 일정은 어디서 확인하나요?",
    questionEn: "Where can I find events and academic dates?",
    answerKo: "상단의 행사·일정 메뉴에서 행사, 설문·투표, 일정을 탭으로 전환할 수 있습니다. 일정 탭에서는 제목·장소를 검색할 수 있습니다.",
    answerEn: "Use Events & Participation to switch between events, surveys, and the calendar. The calendar supports searching by title or location.",
  },
  {
    questionKo: "사이트 이용 중 문제가 생겼어요.",
    questionEn: "I found a problem with the site.",
    answerKo: "채널톡으로 화면 주소와 재현 방법을 함께 보내 주세요. 개인정보나 비밀번호는 문의 내용에 포함하지 마세요.",
    answerEn: "Please contact us through Channel Talk with the page URL and reproduction steps. Do not include passwords or unnecessary personal information.",
  },
] as const;

export function FaqPage() {
  const { lang } = useLanguage();
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <PageShell>
      <Header />
      <PageHeader
        breadcrumbs={[{ label: lang === "ko" ? "학생회 소개" : "Student Council", to: "/about" }]}
        title={lang === "ko" ? "자주 묻는 질문" : "Frequently asked questions"}
      />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 md:px-8 md:py-12">
        <div className="mb-6 flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-brand-primary-light text-brand-primary">
            <CircleHelp className="h-5 w-5" aria-hidden="true" />
          </div>
          <p className="pt-1 text-sm font-medium leading-6 text-slate-600">
            {lang === "ko"
              ? "SOC Web과 학생회 서비스 이용에 관한 기본 안내입니다."
              : "Basic guidance for SOC Web and student council services."}
          </p>
        </div>

        <div className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
          {FAQ_ITEMS.map((item, index) => {
            const isOpen = openIndex === index;
            return (
              <div key={item.questionKo}>
                <Button variant="ghost"
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => setOpenIndex(isOpen ? null : index)}
                  className="interaction-button flex min-h-14 w-full items-center justify-between gap-4 px-5 py-4 text-left text-sm font-bold text-slate-800 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand-primary"
                >
                  <span>{lang === "ko" ? item.questionKo : item.questionEn}</span>
                  <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${isOpen ? "rotate-180 text-brand-primary" : ""}`} aria-hidden="true" />
                </Button>
                {isOpen && (
                  <div className="border-t border-slate-100 bg-slate-50/70 px-5 py-4 text-sm font-medium leading-6 text-slate-600">
                    {lang === "ko" ? item.answerKo : item.answerEn}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </main>
    </PageShell>
  );
}
