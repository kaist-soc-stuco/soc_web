import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { createApiClient } from "@soc/api-client";
import { formatKoreanDateTime } from "@soc/shared";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { resolveApiBaseUrl } from "@/lib/api";
import { resolveAssetUrl } from "@/lib/asset-url";
import { formatSurveyAnswer } from "@/lib/survey-answer-display";
import { SurveyQuestionSummary } from "./survey-analytics-dashboard";

const positiveInteger = (value: string | null) => Math.max(1, Math.min(1_000_000, Number.parseInt(value ?? "1", 10) || 1));

/** Shares the editor's URL and leaves its draft state mounted while reading responses. */
export function SurveyResponsesPanel({ surveyId }: { surveyId: string }) {
  const client = useMemo(() => createApiClient({ baseUrl: resolveApiBaseUrl() }), []);
  const [params, setParams] = useSearchParams();
  const view = params.get("view") === "questions" ? "questions" : params.get("view") === "individual" ? "individual" : "summary";
  const responseId = params.get("response");
  const page = positiveInteger(params.get(view === "individual" ? "entry" : "answerPage"));
  const pageSize = view === "individual" ? 1 : 50;
  const update = (values: Record<string, string | null>) => setParams((current) => {
    const next = new URLSearchParams(current);
    Object.entries(values).forEach(([key, value]) => value === null ? next.delete(key) : next.set(key, value));
    return next;
  });
  const definition = useQuery({ queryKey: ["survey-response-definition", surveyId], queryFn: () => client.getSurveyDetail(surveyId) });
  const statistics = useQuery({ queryKey: ["survey-response-analytics", surveyId], queryFn: () => client.getSurveyAnalytics(surveyId) });
  const records = useQuery({
    queryKey: ["survey-response-records", surveyId, page, pageSize],
    queryFn: () => client.listResponsesWithAnswers(surveyId, { page, pageSize, sortOrder: "asc" }),
  });
  const selected = useQuery({ queryKey: ["survey-response", surveyId, responseId], queryFn: () => client.getResponseDetail(surveyId, responseId!), enabled: view === "individual" && Boolean(responseId) });
  const questions = definition.data?.sections.flatMap((section) => section.questions) ?? [];
  const questionIndex = Math.max(0, questions.findIndex((question) => question.id === params.get("question")));
  const question = questions[questionIndex];
  const response = responseId ? selected.data : records.data?.items[0];
  const total = records.data?.total ?? statistics.data?.totalResponses ?? 0;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const pending = definition.isPending || statistics.isPending || records.isPending;
  const error = definition.isError || statistics.isError || records.isError;
  const setPage = (value: number) => update({ [view === "individual" ? "entry" : "answerPage"]: String(Math.max(1, Math.min(pages, value))), response: null });
  const pager = <div className="flex flex-wrap items-center justify-center gap-3">
    <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>이전 {view === "individual" ? "응답" : "페이지"}</Button>
    <label className="flex items-center gap-2 text-sm"><span className="sr-only">{view === "individual" ? "응답 번호" : "답변 페이지"}</span><input aria-label={view === "individual" ? "응답 번호" : "답변 페이지"} type="number" min={1} max={pages} value={page} onChange={(event) => setPage(positiveInteger(event.currentTarget.value))} className="w-20 rounded-md border border-slate-200 px-2 py-2 text-center" /> / {view === "individual" ? total : pages}</label>
    <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>다음 {view === "individual" ? "응답" : "페이지"}</Button>
  </div>;

  return <section aria-label="설문 응답" className="min-w-0 space-y-5">
    <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
      <div className="mb-5 flex items-center justify-between gap-3"><h2 className="text-xl font-semibold">응답 {statistics.data?.totalResponses ?? "…"}개</h2><Button variant="outline" size="sm" onClick={() => { void statistics.refetch(); void records.refetch(); void definition.refetch(); if (responseId) void selected.refetch(); }}>새로고침</Button></div>
      <SegmentedControl ariaLabel="응답 보기 방식" role="tablist" value={view} onChange={(value) => update({ view: value })} options={[{ value: "summary", label: "요약" }, { value: "questions", label: "질문" }, { value: "individual", label: "개별 보기" }]} />
    </div>
    {pending ? <p role="status">응답을 불러오는 중입니다.</p> : error ? <p role="alert">응답을 불러오지 못했습니다. 새로고침으로 다시 시도해 주세요.</p> : total === 0 ? <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-slate-500">아직 제출된 응답이 없습니다.</div> : <>
      {view !== "individual" && statistics.data ? <>
        {view === "questions" && question ? <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-4">
          <select aria-label="질문 선택" className="min-w-0 flex-1 rounded-md border border-slate-200 p-2" value={question.id} onChange={(event) => update({ question: event.currentTarget.value })}>{questions.map((item, index) => <option key={item.id} value={item.id}>{index + 1}. {item.titleKo}</option>)}</select>
          <Button variant="outline" size="sm" disabled={questionIndex === 0} onClick={() => update({ question: questions[questionIndex - 1].id })}>이전 질문</Button><span className="text-sm">{questionIndex + 1} / {questions.length}</span><Button variant="outline" size="sm" disabled={questionIndex >= questions.length - 1} onClick={() => update({ question: questions[questionIndex + 1].id })}>다음 질문</Button>
        </div> : null}
        <SurveyQuestionSummary analytics={statistics.data} questions={view === "questions" ? question ? [question] : [] : questions} responses={records.data?.items ?? []} />
        {total > pageSize ? <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4"><p className="text-center text-sm text-slate-500">집계는 전체 응답 기준입니다. 서술형·첨부 답변은 응답 순서대로 {pageSize}개씩 표시합니다.</p>{pager}</div> : null}
      </> : null}
      {view === "individual" ? <>
        <div className="rounded-xl border border-slate-200 bg-white p-4">{responseId ? <Button variant="outline" onClick={() => update({ response: null, entry: "1" })}>전체 응답 순서로 보기</Button> : pager}</div>
        {selected.isError && responseId ? <p role="alert">선택한 응답을 찾을 수 없습니다.</p> : !response ? <p role="status">{responseId && selected.isPending ? "응답을 불러오는 중입니다." : "이 번호에 응답이 없습니다. 이전 응답을 선택해 주세요."}</p> : <>
          <div className="rounded-xl border border-slate-200 bg-white p-5"><h3 className="font-semibold">{response.user?.nameKo ?? "익명 응답"}</h3><p className="mt-1 text-sm text-slate-500">{response.submittedAt ? formatKoreanDateTime(response.submittedAt) : "미제출"} · 읽기 전용</p></div>
          {questions.map((item, index) => {
            const answer = response.answers.find((value) => value.questionId === item.id);
            const content = answer?.content;
            const ids = Array.isArray(content?.assetIds) ? content.assetIds.filter((id): id is string => typeof id === "string") : typeof content?.assetId === "string" ? [content.assetId] : [];
            return <article key={item.id} className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6"><p className="mb-2 text-xs text-slate-500">질문 {index + 1}</p><h3 className="font-medium">{item.titleKo}</h3><div className="mt-4 whitespace-pre-wrap break-words text-sm leading-7">{item.questionType === "file_upload" && ids.length ? ids.map((id, fileIndex) => <a key={id} className="block text-brand-primary underline" href={resolveAssetUrl(`asset:${id}`)} target="_blank" rel="noopener noreferrer">첨부파일 {fileIndex + 1}</a>) : formatSurveyAnswer(answer, item) || "응답 없음"}</div></article>;
          })}
        </>}
      </> : null}
    </>}
  </section>;
}
