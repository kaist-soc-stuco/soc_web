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
import { resolveApiBaseUrl } from '@/lib/api-base-url';
import { useCurrentSession } from '@/hooks/use-current-session';
import { useLanguage } from '@/hooks/use-language';
import {
  Check,
  Clock,
  Calendar,
  Lock,
  UserCheck,
  CreditCard,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';

const TUITION_PAYER_BIT = 256;

// ─── 질문별 입력 컴포넌트 ────────────────────────────────────────────────────

type AnswerValue = string | string[];

interface QuestionInputProps {
  question: SurveyQuestionRecord;
  value: AnswerValue;
  onChange: (v: AnswerValue) => void;
  lang: string;
}

function QuestionInput({ question, value, onChange, lang }: QuestionInputProps) {
  const base =
    'w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-kaist-darkgreen transition-all placeholder:text-kaist-grey/40 text-kaist-black font-medium hover:border-gray-300';

  const getOptionLabel = (opt: any) => {
    return lang === 'ko' ? opt.labelKo : (opt.labelEn || opt.labelKo);
  };

  switch (question.questionType as QuestionType) {
    case 'short_text':
      return (
        <input
          className={base}
          type="text"
          value={value as string}
          onChange={(e) => onChange(e.target.value)}
          required={question.isRequired}
          placeholder={lang === 'ko' ? '답변을 입력하세요' : 'Enter your answer'}
        />
      );

    case 'long_text':
      return (
        <textarea
          className={`${base} min-h-[100px] resize-y`}
          value={value as string}
          onChange={(e) => onChange(e.target.value)}
          required={question.isRequired}
          placeholder={lang === 'ko' ? '답변을 입력하세요' : 'Enter your answer'}
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
            <option value="">{lang === 'ko' ? '선택하세요' : 'Select an option'}</option>
            {question.options?.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {getOptionLabel(opt)}
              </option>
            ))}
          </select>
        );
      }
      return (
        <div className="flex flex-col gap-3">
          {question.options?.map((opt) => {
            const isSelected = value === opt.value;
            return (
              <label
                key={opt.value}
                className={`flex items-center gap-3 px-4 py-3.5 rounded-xl border transition-all cursor-pointer ${
                  isSelected
                    ? 'border-kaist-darkgreen bg-kaist-lightgreen/5 text-kaist-darkgreen font-semibold shadow-sm shadow-kaist-darkgreen/5'
                    : 'border-gray-200 hover:border-gray-300 text-kaist-black hover:bg-gray-50/50'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                    isSelected
                      ? 'border-kaist-darkgreen bg-white'
                      : 'border-kaist-grey/30'
                  }`}
                >
                  {isSelected && (
                    <div className="w-2.5 h-2.5 rounded-full bg-kaist-darkgreen" />
                  )}
                </div>
                <input
                  type="radio"
                  name={question.id}
                  value={opt.value}
                  checked={isSelected}
                  onChange={() => onChange(opt.value)}
                  className="hidden"
                />
                <span className="text-sm leading-none">{getOptionLabel(opt)}</span>
              </label>
            );
          })}
        </div>
      );

    case 'multiple_choice':
      return (
        <div className="flex flex-col gap-3">
          {question.options?.map((opt) => {
            const selected = (value as string[]).includes(opt.value);
            return (
              <label
                key={opt.value}
                className={`flex items-center gap-3 px-4 py-3.5 rounded-xl border transition-all cursor-pointer ${
                  selected
                    ? 'border-kaist-darkgreen bg-kaist-lightgreen/5 text-kaist-darkgreen font-semibold shadow-sm shadow-kaist-darkgreen/5'
                    : 'border-gray-200 hover:border-gray-300 text-kaist-black hover:bg-gray-50/50'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                    selected
                      ? 'border-kaist-darkgreen bg-kaist-darkgreen'
                      : 'border-kaist-grey/30'
                  }`}
                >
                  {selected && <Check className="w-3.5 h-3.5 text-white" strokeWidth={4} />}
                </div>
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
                  className="hidden"
                />
                <span className="text-sm leading-none">{getOptionLabel(opt)}</span>
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
      return <p className="text-sm text-red-500">{lang === 'ko' ? '지원하지 않는 질문 형식입니다.' : 'Unsupported question type.'}</p>;
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

function BeforeOpenView({ opensAt, lang }: { opensAt: string | null; lang: string }) {
  return (
    <div className="bg-white rounded-3xl border border-kaist-grey/15 p-12 shadow-xl text-center flex flex-col items-center max-w-md mx-auto my-12 animate-in fade-in zoom-in-95 duration-300">
      <div className="w-16 h-16 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-500 mb-6 border border-amber-100">
        <Clock className="w-8 h-8" />
      </div>
      <h2 className="text-2xl font-bold text-kaist-black mb-3">
        {lang === 'ko' ? '설문 준비 중' : 'Survey Preparing'}
      </h2>
      <p className="text-sm text-kaist-grey/80 leading-relaxed mb-6">
        {lang === 'ko'
          ? '이 설문은 아직 시작되지 않았습니다. 시작 시각 이후에 참여해 주세요.'
          : 'This survey has not started yet. Please check back after the opening time.'}
      </p>
      {opensAt && (
        <div className="bg-amber-50/50 border border-amber-100/50 rounded-xl px-4 py-3 text-xs text-amber-700 font-bold flex items-center gap-2">
          <Calendar className="w-4 h-4 text-amber-600" />
          {lang === 'ko' 
            ? `시작 예정: ${formatKoreanDateTime(opensAt)}` 
            : `Scheduled to open: ${new Date(opensAt).toLocaleString()}`}
        </div>
      )}
    </div>
  );
}

function ClosedView({ lang }: { lang: string }) {
  return (
    <div className="bg-white rounded-3xl border border-kaist-grey/15 p-12 shadow-xl text-center flex flex-col items-center max-w-md mx-auto my-12 animate-in fade-in zoom-in-95 duration-300">
      <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center text-red-500 mb-6 border border-red-100">
        <Lock className="w-8 h-8" />
      </div>
      <h2 className="text-2xl font-bold text-kaist-black mb-3">
        {lang === 'ko' ? '마감된 설문입니다' : 'Survey is Closed'}
      </h2>
      <p className="text-sm text-kaist-grey/80 leading-relaxed">
        {lang === 'ko'
          ? '이 설문의 응답 기간이 만료되어 더 이상 응답을 제출할 수 없습니다.'
          : 'The response period for this survey has ended, and submissions are no longer accepted.'}
      </p>
    </div>
  );
}

function LoginRequiredView({ lang, feePayersOnly }: { lang: string; feePayersOnly?: boolean }) {
  return (
    <div className="bg-white rounded-3xl border border-kaist-grey/15 p-12 shadow-xl text-center flex flex-col items-center max-w-md mx-auto my-12 animate-in fade-in zoom-in-95 duration-300">
      <div className="w-16 h-16 rounded-2xl bg-kaist-lightgreen/20 flex items-center justify-center text-kaist-darkgreen mb-6 border border-kaist-lightgreen/30">
        <UserCheck className="w-8 h-8" />
      </div>
      <h2 className="text-2xl font-bold text-kaist-black mb-3">
        {lang === 'ko' ? '로그인이 필요합니다' : 'Login Required'}
      </h2>
      <p className="text-sm text-kaist-grey/80 leading-relaxed mb-8">
        {feePayersOnly
          ? (lang === 'ko'
              ? '이 설문은 과비 납부 회원만 응답할 수 있습니다. 로그인하여 납부 여부를 확인해 주세요.'
              : 'This survey is restricted to Paid Members Only. Please log in to verify your status.')
          : (lang === 'ko'
              ? '이 설문조사에 참여하기 위해서는 로그인이 필요합니다.'
              : 'To participate in this survey, please log in to your account first.')}
      </p>
      <a
        href="/login"
        className="w-full py-3 bg-kaist-darkgreen hover:bg-kaist-darkgreen/90 text-white font-bold rounded-xl transition-all shadow-md shadow-kaist-darkgreen/15 text-center text-sm"
      >
        {lang === 'ko' ? '로그인 하러 가기' : 'Go to Login'}
      </a>
    </div>
  );
}

function FeePayerRequiredView({ lang }: { lang: string }) {
  return (
    <div className="bg-white rounded-3xl border border-kaist-grey/15 p-12 shadow-xl text-center flex flex-col items-center max-w-md mx-auto my-12 animate-in fade-in zoom-in-95 duration-300">
      <div className="w-16 h-16 rounded-2xl bg-rose-50 flex items-center justify-center text-rose-500 mb-6 border border-rose-100">
        <CreditCard className="w-8 h-8" />
      </div>
      <h2 className="text-2xl font-bold text-kaist-black mb-3">
        {lang === 'ko' ? '과비 납부자 전용 (Paid Members Only)' : 'Paid Members Only'}
      </h2>
      <p className="text-sm text-kaist-grey/80 leading-relaxed">
        {lang === 'ko'
          ? '이 설문은 과비를 납부한 회원만 참여하실 수 있습니다. 집행위원회비 납부 내역을 확인해 주세요.'
          : 'This survey is only available for Paid Members Only. Please check your payment status.'}
      </p>
    </div>
  );
}

function KoreanOnlyWarningView() {
  return (
    <div className="bg-white rounded-3xl border border-kaist-grey/15 p-12 shadow-xl text-center flex flex-col items-center max-w-md mx-auto my-12 animate-in fade-in zoom-in-95 duration-300">
      <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center text-red-500 mb-6 border border-red-100">
        <AlertTriangle className="w-8 h-8" />
      </div>
      <h2 className="text-2xl font-bold text-kaist-black mb-3">한국어 사용자 전용 설문</h2>
      <p className="text-sm text-kaist-grey/80 leading-relaxed mb-4">
        이 설문은 한국어 사용자만 응답할 수 있도록 제한되어 있습니다.
      </p>
      <p className="text-xs text-red-500 font-semibold italic">
        This survey is restricted to Korean speakers only.
      </p>
    </div>
  );
}

function SuccessView({ lang }: { lang: string }) {
  return (
    <div className="bg-white rounded-3xl border border-kaist-grey/15 p-12 shadow-xl text-center flex flex-col items-center max-w-md mx-auto my-12 animate-in fade-in zoom-in-95 duration-300">
      <div className="w-16 h-16 rounded-2xl bg-kaist-lightgreen/20 flex items-center justify-center text-kaist-darkgreen mb-6 border border-kaist-lightgreen/30">
        <CheckCircle2 className="w-8 h-8" />
      </div>
      <h2 className="text-2xl font-bold text-kaist-black mb-3">
        {lang === 'ko' ? '제출이 완료되었습니다' : 'Submission Completed'}
      </h2>
      <p className="text-sm text-kaist-grey/80 leading-relaxed mb-8">
        {lang === 'ko'
          ? '소중한 의견을 보내주셔서 감사합니다. 응답이 성공적으로 제출되었습니다.'
          : 'Thank you for sharing your thoughts. Your responses have been submitted successfully.'}
      </p>
      <a
        href="/"
        className="w-full py-3 bg-gray-100 hover:bg-gray-200 text-kaist-black font-bold rounded-xl transition-all border border-gray-200 text-center text-sm"
      >
        {lang === 'ko' ? '메인으로 이동' : 'Go to Main Page'}
      </a>
    </div>
  );
}

function AlreadySubmittedView({ lang, surveyId }: { lang: string; surveyId: string }) {
  return (
    <div className="bg-white rounded-3xl border border-kaist-grey/15 p-12 shadow-xl text-center flex flex-col items-center max-w-md mx-auto my-12 animate-in fade-in zoom-in-95 duration-300">
      <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-500 mb-6 border border-blue-100">
        <CheckCircle2 className="w-8 h-8" />
      </div>
      <h2 className="text-2xl font-bold text-kaist-black mb-3">
        {lang === 'ko' ? '이미 참여한 설문입니다' : 'Already Participated'}
      </h2>
      <p className="text-sm text-kaist-grey/80 leading-relaxed mb-8">
        {lang === 'ko'
          ? '이 설문조사는 1회만 응답할 수 있습니다. 이미 제출하신 설문 응답 결과를 확인해 보세요.'
          : 'You have already responded to this survey. You can view the results below.'}
      </p>
      <a
        href={`/survey/${surveyId}/results`}
        className="w-full py-3 bg-kaist-darkgreen hover:bg-kaist-darkgreen/90 text-white font-bold rounded-xl transition-all shadow-md shadow-kaist-darkgreen/15 text-center text-sm"
      >
        {lang === 'ko' ? '결과 확인하기' : 'View Results'}
      </a>
    </div>
  );
}

// ─── 메인 페이지 ─────────────────────────────────────────────────────────────

export function SurveyPage() {
  const { id } = useParams<{ id: string }>();
  const apiClient = useMemo(() => createApiClient({ baseUrl: resolveApiBaseUrl() }), []);

  const [survey, setSurvey] = useState<SurveyDetailResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const { data: session, isLoading: sessionLoading } = useCurrentSession();
  const { lang } = useLanguage();

  useEffect(() => {
    if (!id) return;

    apiClient
      .getSurveyDetail(id)
      .then((data) => {
        setSurvey(data);
        const init: Record<string, AnswerValue> = {};
        for (const section of data.sections) {
          for (const q of section.questions) {
            init[q.id] = q.questionType === 'multiple_choice' ? [] : '';
          }
        }
        setAnswers(init);
      })
      .catch(() => setLoadError(lang === 'ko' ? '설문을 불러오지 못했습니다.' : 'Failed to load survey.'));
  }, [id, apiClient, lang]);

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
      setSubmitError(lang === 'ko' ? '제출 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' : 'An error occurred during submission. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const renderBody = () => {
    if (loadError) {
      return (
        <div className="bg-white border border-kaist-grey/15 rounded-3xl p-12 text-center text-red-500 font-bold shadow-xl">
          {loadError}
        </div>
      );
    }
    if (!survey || sessionLoading) {
      return (
        <div className="bg-white border border-kaist-grey/15 rounded-3xl p-12 text-center text-kaist-grey/60 font-medium shadow-xl">
          {lang === 'ko' ? '불러오는 중...' : 'Loading...'}
        </div>
      );
    }
    if (submitted) return <SuccessView lang={lang} />;
    if (survey.computedState === 'before_open') return <BeforeOpenView opensAt={survey.opensAt} lang={lang} />;
    if (survey.computedState === 'closed') return <ClosedView lang={lang} />;

    const sessionAuthenticated = Boolean(
      session?.authenticated && session.canUsePersistentFeatures,
    );
    const sessionPermission = session?.permission ?? 0;

    // Force authentication for all surveys
    if (!sessionAuthenticated) {
      return <LoginRequiredView lang={lang} feePayersOnly={survey.feePayersOnly} />;
    }

    // Check duplicate responses
    if (survey.hasSubmitted && !survey.allowMultipleResponses) {
      return <AlreadySubmittedView lang={lang} surveyId={id!} />;
    }

    // Check if the survey is only for Korean speakers and the user is a foreigner
    if (
      survey.isKoreanOnly &&
      session?.nameKo &&
      session?.nameEn &&
      session.nameKo === session.nameEn
    ) {
      return <KoreanOnlyWarningView />;
    }

    if (survey.feePayersOnly && !(sessionPermission & TUITION_PAYER_BIT)) {
      return <FeePayerRequiredView lang={lang} />;
    }

    // open 상태 — 폼 렌더링
    return (
      <div className="bg-white border border-kaist-grey/15 rounded-3xl p-8 lg:p-12 shadow-xl animate-in fade-in slide-in-from-top-4 duration-300">
        <form onSubmit={handleSubmit} className="flex flex-col gap-10">
          {survey.sections.map((section) => (
            <div key={section.id} className="flex flex-col gap-6">
              {((lang === 'ko' ? section.titleKo : (section.titleEn || section.titleKo)) || 
                (lang === 'ko' ? section.descriptionKo : (section.descriptionEn || section.descriptionKo))) && (
                <div className="border-b border-kaist-grey/15 pb-4">
                  {(lang === 'ko' ? section.titleKo : (section.titleEn || section.titleKo)) && (
                    <h2 className="text-xl font-bold text-kaist-black">
                      {lang === 'ko' ? section.titleKo : (section.titleEn || section.titleKo)}
                    </h2>
                  )}
                  {(lang === 'ko' ? section.descriptionKo : (section.descriptionEn || section.descriptionKo)) && (
                    <p className="mt-1.5 text-sm text-kaist-grey">
                      {lang === 'ko' ? section.descriptionKo : (section.descriptionEn || section.descriptionKo)}
                    </p>
                  )}
                </div>
              )}

              {section.questions.map((question, idx) => (
                <div key={question.id} className="flex flex-col gap-3 group bg-gray-50/30 hover:bg-gray-50/70 p-5 rounded-2xl border border-transparent hover:border-kaist-grey/10 transition-all">
                  <label className="text-sm font-bold text-kaist-black flex items-start gap-1">
                    <span className="text-kaist-darkgreen shrink-0">{idx + 1}.</span>
                    <span>{lang === 'ko' ? question.titleKo : (question.titleEn || question.titleKo)}</span>
                    {question.isRequired && (
                      <span className="text-red-500 font-bold ml-0.5">*</span>
                    )}
                  </label>
                  {(lang === 'ko' ? question.descriptionKo : (question.descriptionEn || question.descriptionKo)) && (
                    <p className="text-xs text-kaist-grey/80 leading-relaxed -mt-1 ml-4">
                      {lang === 'ko' ? question.descriptionKo : (question.descriptionEn || question.descriptionKo)}
                    </p>
                  )}
                  <div className="mt-1">
                    <QuestionInput
                      question={question}
                      value={answers[question.id] ?? (question.questionType === 'multiple_choice' ? [] : '')}
                      onChange={(v) => setAnswers((prev) => ({ ...prev, [question.id]: v }))}
                      lang={lang}
                    />
                  </div>
                </div>
              ))}
            </div>
          ))}

          {submitError && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm font-semibold">
              {submitError}
            </div>
          )}

          <div className="flex justify-end pt-4 border-t border-gray-100">
            <button
              type="submit"
              disabled={submitting}
              className="px-8 py-3.5 bg-kaist-darkgreen hover:bg-kaist-darkgreen/90 text-white font-extrabold rounded-xl transition-all shadow-lg shadow-kaist-darkgreen/15 active:scale-98 disabled:opacity-50 border-0 cursor-pointer flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {lang === 'ko' ? '제출 중...' : 'Submitting...'}
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4.5 h-4.5" />
                  {lang === 'ko' ? '설문 응답 제출하기' : 'Submit Response'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    );
  };

  return (
    <div className="flex min-h-screen flex-col bg-gray-50/50">
      <Header showLogo />
      <main className="flex-1 px-4 py-12 lg:px-0 bg-gradient-to-br from-kaist-lightgreen/5 via-white to-gray-50/50">
        <div className="mx-auto max-w-2xl">
          {survey && (
            <div className="mb-8 bg-white border border-kaist-grey/15 rounded-3xl p-8 lg:p-12 shadow-xl animate-in fade-in slide-in-from-top-4 duration-300">
              {/* Kind Badge */}
              <div className="flex items-center gap-2 mb-4">
                <span className="bg-kaist-lightgreen/20 text-kaist-darkgreen text-xs font-bold px-3 py-1.5 rounded-lg border border-kaist-darkgreen/15">
                  {survey.kind === 'VOTE'
                    ? (lang === 'ko' ? '투표' : 'Vote')
                    : survey.kind === 'APPLICATION'
                    ? (lang === 'ko' ? '신청서/행사 접수' : 'Application/Event')
                    : (lang === 'ko' ? '일반 설문' : 'Survey')}
                </span>
                {survey.closesAt && survey.computedState === 'open' && (
                  <span className="bg-emerald-50 text-emerald-700 text-xs font-bold px-3 py-1.5 rounded-lg border border-emerald-100 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-emerald-600" />
                    {lang === 'ko' 
                      ? `진행 중 (마감: ${formatKoreanDateTime(survey.closesAt)})`
                      : `Open (Closes: ${new Date(survey.closesAt).toLocaleDateString()})`}
                  </span>
                )}
              </div>

              <h1 className="text-3xl font-black text-kaist-black tracking-tight leading-tight">
                {lang === 'ko' ? survey.titleKo : (survey.titleEn || survey.titleKo)}
              </h1>
              {(lang === 'ko' ? survey.descriptionKo : (survey.descriptionEn || survey.descriptionKo)) && (
                <p className="mt-4 text-base text-kaist-grey leading-relaxed border-t border-gray-100 pt-4">
                  {lang === 'ko' ? survey.descriptionKo : (survey.descriptionEn || survey.descriptionKo)}
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
