import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { adminSurveyRows } from '@/lib/mock-data';

type SurveyTab = 'question' | 'response' | 'setting';

function SurveyEditorHeader({
  activeTab,
  onTabChange,
}: {
  activeTab: SurveyTab;
  onTabChange: (tab: SurveyTab) => void;
}) {
  const tabs: Array<{ key: SurveyTab; label: string }> = [
    { key: 'question', label: '질문' },
    { key: 'response', label: '응답' },
    { key: 'setting', label: '설정' },
  ];

  return (
    <>
      <div className="bg-[linear-gradient(90deg,#146D4A_40.8%,#C9ECC2_100%)] px-[12vw] py-8">
        <p className="mb-2 text-[32px] font-extrabold tracking-tight text-white">설문조사 관리</p>
        <p className="text-[20px] font-semibold tracking-tight text-white">카이스트 전산학부의 다양한 소식을 알려 드립니다</p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-kaist-grey/30 px-[12vw] py-3">
        <div className="flex items-center gap-8 text-[24px] font-extrabold tracking-tight">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => onTabChange(tab.key)}
            className={activeTab === tab.key ? 'border-b-3 border-kaist-darkgreen-main pb-2 text-kaist-darkgreen-main' : 'text-[#9AA69F]'}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-4">
          <Link
            to="/admin/surveys"
            className="rounded-[5px] bg-kaist-darkgreen-main px-5 py-2 text-base font-semibold text-white"
          >
            임시저장
          </Link>
          <button type="button" className="rounded-[5px] bg-kaist-darkgreen-main px-5 py-2 text-base font-semibold text-white">
            게시
          </button>
        </div>
      </div>
    </>
  );
}

function SurveyQuestionTab({ surveyTitle }: { surveyTitle: string }) {
  return (
    <div className="px-[12vw] py-8">
      <div className="overflow-hidden rounded-[15px] bg-white shadow-[0_1px_6px_rgba(0,0,0,0.14)]">
        <div className="w-[123px] rounded-tr-[15px] bg-kaist-darkgreen-main px-4 py-2 text-[18px] font-semibold text-white">1 중 1 섹션</div>
        <div className="h-[10px] bg-kaist-darkgreen-main" />
        <div className="px-6 py-6">
          <h2 className="text-[28px] font-semibold tracking-tight text-kaist-black">설문 제목(28pt)</h2>
          <p className="mt-4 text-[18px] font-semibold text-kaist-black/90">세부 내용(18pt)</p>
        </div>
      </div>

      <div className="mt-10 grid gap-6 xl:grid-cols-[1fr_80px]">
        <div className="overflow-hidden rounded-[15px] bg-white shadow-[0_1px_6px_rgba(0,0,0,0.14)]">
          <div className="flex">
            <div className="w-[13px] rounded-bl-[15px] rounded-tl-[15px] bg-kaist-darkgreen-main" />
            <div className="flex-1 px-6 py-6">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div className="w-full max-w-[724px] rounded-[5px] bg-[#86D8A7] px-4 py-3 text-[24px] font-semibold tracking-tight text-kaist-black">
                  블록 제목(24pt) <span className="text-[#D15F57]">*</span>
                </div>
                <div className="flex items-center gap-4 text-xl text-kaist-grey">
                  <span>⧉</span>
                  <span>🗑</span>
                </div>
              </div>

              <div className="mb-5 text-center text-lg text-kaist-grey">⠿</div>

              <div className="flex flex-wrap items-center gap-4 text-sm font-semibold text-kaist-grey">
                <span className="text-kaist-black">B</span>
                <span>I</span>
                <span>U</span>
                <span>☰</span>
                <span>▾</span>
              </div>

              <div className="mt-5 max-w-[660px] border-b border-kaist-grey/60 pb-1 text-[18px] font-semibold text-[#9AA69F]">
                단답형 텍스트 입력란(18pt)
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-[15px] bg-white px-4 py-5 shadow-[0_1px_6px_rgba(0,0,0,0.14)]">
          <div className="flex flex-col items-center gap-4 text-xl text-kaist-black/70">
            <span>⊕</span>
            <span>📄</span>
            <span className="text-lg font-bold">Tt</span>
            <span>🖼</span>
            <span>▣</span>
            <span>☰</span>
          </div>
        </div>
      </div>

      <div className="mt-10 text-sm font-medium text-kaist-grey">
        현재 설문: {surveyTitle}
      </div>
    </div>
  );
}

function SurveyResponseTab() {
  const responses = ['응답 1', '응답 2', '응답 3', '응답 4'];

  return (
    <div className="px-8 py-8">
      <div className="rounded-[15px] bg-white px-10 py-8 shadow-[0_1px_6px_rgba(0,0,0,0.12)]">
        <h2 className="text-[32px] font-semibold tracking-tight text-kaist-black">응답 N개</h2>
      </div>

      <div className="mt-12 rounded-[15px] bg-white px-10 py-8 shadow-[0_1px_6px_rgba(0,0,0,0.12)]">
        <div className="flex flex-wrap items-center gap-16 border-b border-kaist-grey/20 pb-3 text-[20px] font-semibold text-kaist-black">
          <span className="border-b-4 border-kaist-darkgreen-main pb-2">요약</span>
          <span>개별 보기</span>
          <span>시트로 보기</span>
        </div>

        <div className="mt-10 grid gap-8 xl:grid-cols-[1fr_340px]">
          <div>
            <h3 className="text-[28px] font-semibold tracking-tight text-kaist-black">블록 제목</h3>
            <p className="mt-1 text-sm font-medium text-kaist-grey">응답 N개</p>

            <div className="mt-6 space-y-2">
              {responses.map((label) => (
                <div key={label} className="rounded-[2px] bg-white px-4 py-3 text-sm font-medium text-kaist-black shadow-[0_0_0_1px_rgba(152,160,172,0.2)]">
                  {label}
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-6">
            <div className="rounded-[15px] border border-kaist-grey/20 bg-white p-6">
              <div className="mx-auto flex h-[220px] w-[220px] items-center justify-center rounded-full bg-[conic-gradient(#1AA172_0_72%,#dce5df_72%_100%)]">
                <div className="flex h-[150px] w-[150px] items-center justify-center rounded-full bg-[#F7FCFC] text-[36px] font-semibold text-kaist-black">
                  72.2%
                </div>
              </div>
            </div>

            <div className="space-y-4 text-[24px] font-semibold text-kaist-black">
              <label className="flex items-center gap-3">
                <input type="checkbox" checked readOnly className="h-5 w-5 accent-kaist-darkgreen-main" />
                과비 납부자만 응답 가능
              </label>
              <label className="flex items-center gap-3">
                <input type="checkbox" checked readOnly className="h-5 w-5 accent-kaist-darkgreen-main" />
                로그인 없이 응답 가능
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SurveySettingTab({ surveyTitle, surveyStatus }: { surveyTitle: string; surveyStatus: string }) {
  return (
    <div className="px-8 py-6">
      <h2 className="mb-6 text-[32px] font-extrabold tracking-tight text-kaist-black">카드뷰 미리보기</h2>

      <div className="grid gap-10 xl:grid-cols-[460px_1fr]">
        <div className="w-full max-w-[458px]">
          <div className="overflow-hidden rounded-[20px] bg-white shadow-[-1px_0_4px_rgba(0,0,0,0.15),1px_2px_8px_rgba(0,0,0,0.18)]">
            <div className="relative h-[370px] bg-[radial-gradient(circle_at_30%_30%,rgba(255,244,219,0.95),rgba(240,205,151,0.6)_25%,rgba(212,172,120,0.28)_40%,rgba(255,255,255,0.92)_78%),linear-gradient(180deg,rgba(231,225,219,0.25),rgba(246,247,248,0.96))]">
              <div className="absolute left-4 top-4 rounded-full bg-white/50 px-4 py-1 text-xs font-bold text-white">진행중</div>
              <div className="absolute inset-x-0 top-1/2 flex -translate-y-1/2 items-center justify-center gap-3 text-kaist-darkgreen">
                <span className="text-3xl">🖼</span>
                <span className="text-[32px] font-extrabold tracking-tight">커버 수정하기</span>
              </div>
              <div className="absolute bottom-4 left-4 rounded bg-white/40 px-3 py-1 text-[11px] font-semibold text-white">KAIST SoC</div>
              <div className="absolute bottom-4 right-4 rounded bg-white/80 px-3 py-1 text-[11px] font-semibold text-kaist-grey">11/11 (화)</div>
            </div>

            <div className="px-4 py-4">
              <p className="text-xs font-bold text-[#74A8D8]">이벤트</p>
              <h3 className="mt-1 text-[20px] font-extrabold tracking-tight text-kaist-black">{surveyTitle}</h3>
              <p className="mt-3 text-sm font-semibold leading-6 text-kaist-grey">
                중간고사 기간! SoC 구성원 여러분들을 위해<br />“상무포방”를 제공합니다. 5/23 9:00 오픈!
              </p>
              <p className="mt-4 text-[11px] font-semibold text-kaist-grey">26.05.23 09:00 구글폼 오픈</p>
            </div>
          </div>
        </div>

        <div className="grid gap-6">
          <div className="grid gap-6 xl:grid-cols-2">
            <label className="grid gap-2">
              <span className="text-[20px] font-semibold text-kaist-black">제목(국문)</span>
              <input
                defaultValue={surveyTitle}
                className="h-[43px] rounded-[10px] bg-white px-4 text-sm shadow-[-1px_0_4px_rgba(0,0,0,0.15),1px_2px_4px_rgba(0,0,0,0.15)] outline-none"
              />
            </label>
            <label className="grid gap-2">
              <span className="text-[20px] font-semibold text-kaist-black">제목(영문)</span>
              <input
                defaultValue="Snack Event Survey"
                className="h-[43px] rounded-[10px] bg-white px-4 text-sm shadow-[-1px_0_4px_rgba(0,0,0,0.15),1px_2px_4px_rgba(0,0,0,0.15)] outline-none"
              />
            </label>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <label className="grid gap-2">
              <span className="text-[20px] font-semibold text-kaist-black">설명(국문)</span>
              <textarea
                rows={5}
                defaultValue="행사 참여 경험과 만족도를 수집합니다."
                className="rounded-[10px] bg-white px-4 py-3 text-sm shadow-[-1px_0_4px_rgba(0,0,0,0.15),1px_2px_4px_rgba(0,0,0,0.15)] outline-none"
              />
            </label>
            <label className="grid gap-2">
              <span className="text-[20px] font-semibold text-kaist-black">설명(영문)</span>
              <textarea
                rows={5}
                defaultValue="Collect feedback and overall satisfaction from participants."
                className="rounded-[10px] bg-white px-4 py-3 text-sm shadow-[-1px_0_4px_rgba(0,0,0,0.15),1px_2px_4px_rgba(0,0,0,0.15)] outline-none"
              />
            </label>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <label className="grid gap-2">
              <span className="text-[20px] font-semibold text-kaist-black">상태</span>
              <input
                defaultValue={surveyStatus}
                className="h-[43px] rounded-[10px] bg-white px-4 text-sm shadow-[-1px_0_4px_rgba(0,0,0,0.15),1px_2px_4px_rgba(0,0,0,0.15)] outline-none"
              />
            </label>
            <label className="grid gap-2">
              <span className="text-[20px] font-semibold text-kaist-black">최대 응답 수</span>
              <input
                defaultValue="300"
                className="h-[43px] rounded-[10px] bg-white px-4 text-sm shadow-[-1px_0_4px_rgba(0,0,0,0.15),1px_2px_4px_rgba(0,0,0,0.15)] outline-none"
              />
            </label>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <label className="grid gap-2">
              <span className="text-[20px] font-semibold text-kaist-black">시작 시간</span>
              <input
                defaultValue="2026-05-23 09:00"
                className="h-[43px] rounded-[10px] bg-white px-4 text-sm shadow-[-1px_0_4px_rgba(0,0,0,0.15),1px_2px_4px_rgba(0,0,0,0.15)] outline-none"
              />
            </label>
            <label className="grid gap-2">
              <span className="text-[20px] font-semibold text-kaist-black">마감 시간</span>
              <input
                defaultValue="2026-05-30 23:59"
                className="h-[43px] rounded-[10px] bg-white px-4 text-sm shadow-[-1px_0_4px_rgba(0,0,0,0.15),1px_2px_4px_rgba(0,0,0,0.15)] outline-none"
              />
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-10 pt-2">
            <label className="flex items-center gap-3 text-[24px] font-semibold text-kaist-black">
              <input type="checkbox" defaultChecked className="h-5 w-5 rounded-[5px] accent-kaist-darkgreen-main" />
              과비 납부자만 응답 가능
            </label>
            <label className="flex items-center gap-3 text-[24px] font-semibold text-kaist-black">
              <input type="checkbox" className="h-5 w-5 rounded-[5px] accent-kaist-darkgreen-main" />
              로그인 없이 응답 가능
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AdminSurveyEditPage() {
  const { surveyId } = useParams<{ surveyId: string }>();
  const [activeTab, setActiveTab] = useState<SurveyTab>('setting');
  const survey = adminSurveyRows.find((item) => item.id === surveyId) ?? adminSurveyRows[0];

  return (
    <section className="overflow-hidden border border-kaist-grey/15 bg-[#F7FCFC]">
      <SurveyEditorHeader activeTab={activeTab} onTabChange={setActiveTab} />

      {activeTab === 'question' ? <SurveyQuestionTab surveyTitle={survey.title} /> : null}
      {activeTab === 'response' ? <SurveyResponseTab /> : null}
      {activeTab === 'setting' ? <SurveySettingTab surveyTitle={survey.title} surveyStatus={survey.status} /> : null}
    </section>
  );
}
