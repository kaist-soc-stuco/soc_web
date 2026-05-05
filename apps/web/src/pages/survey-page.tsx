import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { createApiClient } from '@soc/api-client';
import type {
  SurveyDetailResponse,
  SurveyQuestionRecord,
  QuestionType,
} from '@soc/contracts';
import { formatKoreanDateTime } from '@soc/shared';
import { Header } from '@/components/organisms/header';
import { Footer } from '@/components/organisms/footer';
import { Button } from '@/components/ui/button';
import { resolveApiBaseUrl } from '@/lib/api';
import { getAuthSessionSummary } from '@/lib/auth-session';

const TUITION_PAYER_BIT = 256;

// ─── 질문별 입력 컴포넌트 ────────────────────────────────────────────────────

type AnswerValue = string | string[];

interface QuestionInputProps {
  question: SurveyQuestionRecord;
  value: AnswerValue;
  onChange: (v: AnswerValue) => void;
}

function QuestionInput({ question, value, onChange }: QuestionInputProps) {
  const base =
    'w-full rounded-md border border-[var(--kaist-greygreen)] bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--kaist-darkgreen-main)]';

  switch (question.questionType as QuestionType) {
    case 'short_text':
      return (
        <input
          className={base}
          type="text"
          value={value as string}
          onChange={(e) => onChange(e.target.value)}
          required={question.isRequired}
        />
      );

    case 'long_text':
      return (
        <textarea
          className={`${base} min-h-[100px] resize-y`}
          value={value as string}
          onChange={(e) => onChange(e.target.value)}
          required={question.isRequired}
        />
      );

    case 'single_choice':
    case 'dropdown':
      if (question.questionType === 'dropdown') {
        return (
          <select
            className={base}
            value={value as string}
            onChange={(e) => onChange(e.target.value)}
            required={question.isRequired}
          >
            <option value="">선택하세요</option>
            {question.options?.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.labelKo}
              </option>
            ))}
          </select>
        );
      }
      return (
        <div className="flex flex-col gap-2">
          {question.options?.map((opt) => (
            <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name={question.id}
                value={opt.value}
                checked={value === opt.value}
                onChange={() => onChange(opt.value)}
                className="accent-[var(--kaist-darkgreen-main)]"
              />
              <span className="text-sm">{opt.labelKo}</span>
            </label>
          ))}
        </div>
      );

    case 'multiple_choice':
      return (
        <div className="flex flex-col gap-2">
          {question.options?.map((opt) => {
            const selected = (value as string[]).includes(opt.value);
            return (
              <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  value={opt.value}
                  checked={selected}
                  onChange={() => {
                    const prev = value as string[];
                    onChange(
                      selected ? prev.filter((v) => v !== opt.value) : [...prev, opt.value],
                    );
                  }}
                  className="accent-[var(--kaist-darkgreen-main)]"
                />
                <span className="text-sm">{opt.labelKo}</span>
              </label>
            );
          })}
        </div>
      );

    case 'date':
      return (
        <input
          className={base}
          type="date"
          value={value as string}
          onChange={(e) => onChange(e.target.value)}
          required={question.isRequired}
        />
      );

    case 'time':
      return (
        <input
          className={base}
          type="time"
          value={value as string}
          onChange={(e) => onChange(e.target.value)}
          required={question.isRequired}
        />
      );

    case 'datetime':
      return (
        <input
          className={base}
          type="datetime-local"
          value={value as string}
          onChange={(e) => onChange(e.target.value)}
          required={question.isRequired}
        />
      );

    default:
      return <p className="text-sm text-red-500">지원하지 않는 질문 형식입니다.</p>;
  }
}

// ─── 답변 → API content 변환 ─────────────────────────────────────────────────

function toAnswerContent(type: QuestionType, value: AnswerValue): Record<string, unknown> {
  switch (type) {
    case 'short_text':
    case 'long_text':
      return { text: value as string };
    case 'single_choice':
    case 'dropdown':
      return { value: value as string };
    case 'multiple_choice':
      return { values: value as string[] };
    case 'date':
      return { date: value as string };
    case 'time':
      return { time: value as string };
    case 'datetime':
      return { datetime: value as string };
    default:
      return { value };
  }
}

// ─── 상태별 화면 ─────────────────────────────────────────────────────────────

function BeforeOpenView({ opensAt }: { opensAt: string | null }) {
  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <span className="text-5xl">⏳</span>
      <h2 className="text-2xl font-semibold text-[var(--kaist-darkgreen)]">설문 준비 중</h2>
      {opensAt && (
        <p className="text-[var(--kaist-greygreen)]">
          개시 예정: {formatKoreanDateTime(opensAt)}
        </p>
      )}
    </div>
  );
}

function ClosedView() {
  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <span className="text-5xl">🔒</span>
      <h2 className="text-2xl font-semibold text-[var(--kaist-darkgreen)]">마감된 설문입니다</h2>
      <p className="text-[var(--kaist-greygreen)]">이 설문의 응답 기간이 종료되었습니다.</p>
    </div>
  );
}

function LoginRequiredView() {
  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <span className="text-5xl">🔑</span>
      <h2 className="text-2xl font-semibold text-[var(--kaist-darkgreen)]">로그인이 필요합니다</h2>
      <p className="text-[var(--kaist-greygreen)]">이 설문은 로그인한 사용자만 응답할 수 있습니다.</p>
    </div>
  );
}

function FeePayerRequiredView() {
  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <span className="text-5xl">💳</span>
      <h2 className="text-2xl font-semibold text-[var(--kaist-darkgreen)]">과비 납부자 전용입니다</h2>
      <p className="text-[var(--kaist-greygreen)]">이 설문은 과비를 납부한 학생만 응답할 수 있습니다.</p>
    </div>
  );
}

function SuccessView() {
  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <span className="text-5xl">✅</span>
      <h2 className="text-2xl font-semibold text-[var(--kaist-darkgreen)]">제출 완료</h2>
      <p className="text-[var(--kaist-greygreen)]">응답해 주셔서 감사합니다.</p>
    </div>
  );
}

// ─── 메인 페이지 ─────────────────────────────────────────────────────────────

export function SurveyPage() {
  const { id } = useParams<{ id: string }>();
  const apiClient = useMemo(() => createApiClient({ baseUrl: resolveApiBaseUrl() }), []);

  const [survey, setSurvey] = useState<SurveyDetailResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sessionPermission, setSessionPermission] = useState<number | null>(null);
  const [sessionAuthenticated, setSessionAuthenticated] = useState<boolean | null>(null);
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!id) return;

    Promise.all([
      apiClient.getSurveyDetail(id),
      getAuthSessionSummary(apiClient),
    ])
      .then(([data, session]) => {
        setSurvey(data);
        setSessionAuthenticated(session.authenticated && session.canUsePersistentFeatures);
        setSessionPermission(session.permission ?? 0);
        const init: Record<string, AnswerValue> = {};
        for (const section of data.sections) {
          for (const q of section.questions) {
            init[q.id] = q.questionType === 'multiple_choice' ? [] : '';
          }
        }
        setAnswers(init);
      })
      .catch(() => setLoadError('설문을 불러오지 못했습니다.'));
  }, [id, apiClient]);

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!survey || !id) return;
    setSubmitting(true);
    setSubmitError(null);

    const allQuestions = survey.sections.flatMap((s) => s.questions);
    const answerInputs = allQuestions.map((q) => ({
      questionId: q.id,
      content: toAnswerContent(q.questionType, answers[q.id] ?? ''),
    }));

    try {
      await apiClient.submitSurveyResponse(id, { answers: answerInputs });
      setSubmitted(true);
    } catch {
      setSubmitError('제출 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setSubmitting(false);
    }
  };

  const renderBody = () => {
    if (loadError) {
      return (
        <div className="py-16 text-center text-red-500">{loadError}</div>
      );
    }
    if (!survey || sessionAuthenticated === null) {
      return (
        <div className="py-16 text-center text-[var(--kaist-greygreen)]">불러오는 중...</div>
      );
    }
    if (submitted) return <SuccessView />;
    if (survey.computedState === 'before_open') return <BeforeOpenView opensAt={survey.opensAt} />;
    if (survey.computedState === 'closed') return <ClosedView />;

    if (!survey.allowAnonymous && !sessionAuthenticated) return <LoginRequiredView />;
    if (survey.feePayersOnly && !((sessionPermission ?? 0) & TUITION_PAYER_BIT)) return <FeePayerRequiredView />;

    // open 상태 — 폼 렌더링
    return (
      <form onSubmit={handleSubmit} className="flex flex-col gap-10">
        {survey.sections.map((section) => (
          <div key={section.id} className="flex flex-col gap-6">
            {(section.titleKo || section.descriptionKo) && (
              <div className="border-b border-[var(--kaist-lightgreen2)] pb-3">
                {section.titleKo && (
                  <h2 className="text-lg font-semibold text-[var(--kaist-darkgreen)]">
                    {section.titleKo}
                  </h2>
                )}
                {section.descriptionKo && (
                  <p className="mt-1 text-sm text-[var(--kaist-greygreen)]">
                    {section.descriptionKo}
                  </p>
                )}
              </div>
            )}

            {section.questions.map((question, idx) => (
              <div key={question.id} className="flex flex-col gap-2">
                <label className="text-sm font-medium text-[var(--kaist-black)]">
                  {idx + 1}. {question.titleKo}
                  {question.isRequired && (
                    <span className="ml-1 text-red-500">*</span>
                  )}
                </label>
                {question.descriptionKo && (
                  <p className="text-xs text-[var(--kaist-greygreen)]">
                    {question.descriptionKo}
                  </p>
                )}
                <QuestionInput
                  question={question}
                  value={answers[question.id] ?? (question.questionType === 'multiple_choice' ? [] : '')}
                  onChange={(v) => setAnswers((prev) => ({ ...prev, [question.id]: v }))}
                />
              </div>
            ))}
          </div>
        ))}

        {submitError && (
          <p className="text-sm text-red-500">{submitError}</p>
        )}

        <Button
          type="submit"
          disabled={submitting}
          className="self-end bg-[var(--kaist-darkgreen-main)] text-white hover:bg-[var(--kaist-darkgreen)]"
        >
          {submitting ? '제출 중...' : '제출하기'}
        </Button>
      </form>
    );
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 px-4 py-10 lg:px-0">
        <div className="mx-auto max-w-2xl">
          {survey && (
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-[var(--kaist-darkgreen)]">
                {survey.titleKo}
              </h1>
              {survey.descriptionKo && (
                <p className="mt-2 text-[var(--kaist-greygreen)]">{survey.descriptionKo}</p>
              )}
              {survey.closesAt && survey.computedState === 'open' && (
                <p className="mt-1 text-xs text-[var(--kaist-greygreen)]">
                  마감: {formatKoreanDateTime(survey.closesAt)}
                </p>
              )}
            </div>
          )}
          {renderBody()}
        </div>
      </main>
      <Footer />
    </div>
  );
}
