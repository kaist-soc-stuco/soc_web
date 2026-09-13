import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Download, FileSpreadsheet, MoreVertical, SquareCheck, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/components/ui/toast";
import { stripRichText } from "@/components/ui/rich-text-content";
import { SurveyQuestionInput } from "@/features/survey/survey-question-input";
import { answerContentToValue } from "@/features/survey/survey-answer-utils";
import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createApiClient } from "@soc/api-client";
import { formatKoreanDateTime } from "@soc/shared";
import { Button } from "@/components/ui/button";
import { UiInput } from "@/components/ui/form-control";
import { Modal } from "@/components/ui/modal";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { SelectDropdown } from "@/components/atoms/select-dropdown";
import { resolveApiBaseUrl } from "@/lib/api";
import { resolveAssetUrl } from "@/lib/asset-url";
import { formatSurveyAnswer } from "@/lib/survey-answer-display";
import { SurveyQuestionSummary } from "./survey-analytics-dashboard";

const positiveInteger = (value: string | null) => Math.max(1, Math.min(1_000_000, Number.parseInt(value ?? "1", 10) || 1));

/** Shares the editor's URL and leaves its draft state mounted while reading responses. */
export function SurveyResponsesPanel({ surveyId, onSheet, onResponsesDeleted, sheetBusy = false }: { onResponsesDeleted?: () => void; surveyId: string; onSheet?: () => Promise<void>; sheetBusy?: boolean }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [mutating, setMutating] = useState(false);
  const [exporting, setExporting] = useState(false);
  const client = useMemo(() => createApiClient({ baseUrl: resolveApiBaseUrl() }), []);
  const subscription = useQuery({ queryKey: ["survey-email-notifications", surveyId], queryFn: () => client.getSurveyEmailNotifications(surveyId) });
  const toggleNotifications = async () => {
    setMutating(true);
    try {
      const result = await client.setSurveyEmailNotifications(surveyId, !subscription.data?.enabled);
      queryClient.setQueryData(["survey-email-notifications", surveyId], result);
    } catch { toast({type:"error",message:"이메일 알림 설정을 변경하지 못했습니다."}); }
    finally { setMutating(false); }
  };
  const removeResponses = async () => {
    setMutating(true);
    try {
      await client.deleteAllSurveyResponses(surveyId);
      setDeleteOpen(false);
      onResponsesDeleted?.();
      update({response:null,entry:"1",answerPage:"1"});
      await queryClient.invalidateQueries({predicate: query => query.queryKey.some(key => key === surveyId)});
      toast({type:"success",message:"모든 응답을 삭제했습니다."});
    } catch { toast({type:"error",message:"응답을 삭제하지 못했습니다."}); }
    finally { setMutating(false); }
  };
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
    <Button variant="ghost" size="icon" aria-label={view === "individual" ? "이전 응답" : "이전 페이지"} disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronLeft className="size-4" /></Button>
    <label className="flex items-center gap-2 text-sm"><span className="sr-only">{view === "individual" ? "응답 번호" : "답변 페이지"}</span><UiInput aria-label={view === "individual" ? "응답 번호" : "답변 페이지"} type="number" min={1} max={pages} value={page} onChange={(event) => setPage(positiveInteger(event.currentTarget.value))} className="w-20 text-center" /> / {view === "individual" ? total : pages}</label>
    <Button variant="ghost" size="icon" aria-label={view === "individual" ? "다음 응답" : "다음 페이지"} disabled={page >= pages} onClick={() => setPage(page + 1)}><ChevronRight className="size-4" /></Button>
  </div>;


  const exportCsv = async () => {
    setExporting(true);
    try {
      const rows: string[][] = [["응답 일시", ...questions.map(q=>stripRichText(q.titleKo))]];
      let page = 1;
      while (true) {
        const batch = await client.listResponsesWithAnswers(surveyId, {page, pageSize:100, sortOrder:"asc"});
        for (const response of batch.items) rows.push([response.submittedAt ?? "", ...questions.map(q=>formatSurveyAnswer(response.answers.find(a=>a.questionId===q.id),q))]);
        if (page * 100 >= batch.total || !batch.items.length) break;
        page++;
      }
      const cell = (value: string) => '"' + (/^[=+@\-\t\r]/.test(value) ? "'" : "") + value.replaceAll('"','""') + '"';
      const url=URL.createObjectURL(new Blob(["\uFEFF"+rows.map(row=>row.map(cell).join(",")).join("\r\n")],{type:"text/csv;charset=utf-8"}));
      const link=document.createElement("a"); link.href=url;link.download="설문 응답.csv";link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    } catch {toast({type:"error",message:"응답을 내려받지 못했습니다."});}
    finally {setExporting(false);}
  };
  return <section aria-label="설문 응답" className="survey-responses-panel min-w-0 space-y-5">
    <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
      <div className="mb-5 flex items-center justify-between gap-3"><h2 className="text-3xl font-normal tracking-tight sm:text-4xl">응답 {statistics.data?.totalResponses ?? "…"}개</h2>
<div className="flex items-center gap-2">
 {onSheet ? <Button variant="ghost" className="!font-medium text-brand-primary" onClick={()=>void onSheet()} disabled={sheetBusy}><FileSpreadsheet className="size-6 text-emerald-600" />Sheets에 연결</Button> : null}
 <DropdownMenu.Root modal={false}><DropdownMenu.Trigger asChild><Button variant="ghost" size="icon" aria-label="응답 더보기"><MoreVertical className="size-4" /></Button></DropdownMenu.Trigger>
 <DropdownMenu.Portal><DropdownMenu.Content align="end" sideOffset={6} className="z-[100] w-80 max-w-[calc(100vw-2rem)] rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
 <DropdownMenu.Item disabled={exporting} onSelect={()=>void exportCsv()} className="flex cursor-pointer items-center gap-3 rounded px-3 py-2 text-sm outline-none focus:bg-slate-100"><Download className="size-4" />응답 다운로드(.csv)</DropdownMenu.Item>
 <DropdownMenu.CheckboxItem checked={subscription.data?.enabled ?? false} disabled={mutating || subscription.isPending || subscription.isError} onCheckedChange={()=>void toggleNotifications()} className="flex cursor-pointer items-center gap-3 rounded px-3 py-3 text-sm outline-none focus:bg-slate-100"><span className="size-4 shrink-0"><DropdownMenu.ItemIndicator><SquareCheck className="size-4" /></DropdownMenu.ItemIndicator></span>새로운 응답에 대한 이메일 알림 받기</DropdownMenu.CheckboxItem>
 <DropdownMenu.Separator className="my-1 border-t border-slate-200" />
 <DropdownMenu.Item disabled={!total || mutating} onSelect={()=>setDeleteOpen(true)} className="flex cursor-pointer items-center gap-3 rounded px-3 py-3 text-sm text-rose-600 outline-none focus:bg-rose-50"><Trash2 className="size-4" />모든 응답 삭제</DropdownMenu.Item>
 </DropdownMenu.Content></DropdownMenu.Portal></DropdownMenu.Root>
</div>
</div>
      <SegmentedControl
        ariaLabel="응답 보기 방식"
        role="tablist"
        value={view}
        onChange={(value) => update({ view: value })}
        options={[
          { value: "summary", label: "요약" },
          { value: "questions", label: "질문" },
          { value: "individual", label: "개별 보기" },
        ]}
        className="mt-8"
      />
    </div>
    <Modal open={deleteOpen} onClose={()=>{if(!mutating)setDeleteOpen(false);}} title="모든 응답 삭제" className="max-w-md" footer={<><Button variant="outline" disabled={mutating} onClick={()=>setDeleteOpen(false)}>취소</Button><Button variant="destructive" disabled={mutating} onClick={()=>void removeResponses()}>모든 응답 삭제</Button></>}>
      <p>응답 {total}개를 모두 삭제하시겠습니까? 삭제한 응답은 복구할 수 없습니다.</p>
      {definition.data?.spreadsheetUrl && <p className="mt-3 text-sm text-slate-500">연결된 Sheets의 응답도 동기화됩니다.</p>}
    </Modal>
    {pending ? <p role="status">응답을 불러오는 중입니다.</p> : error ? <p role="alert">응답을 불러오지 못했습니다. 새로고침으로 다시 시도해 주세요.</p> : total === 0 ? <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-slate-500">아직 제출된 응답이 없습니다.</div> : <>
      {view !== "individual" && statistics.data ? <>
        {view === "questions" && question ? <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-4">
          <SelectDropdown
            ariaLabel="질문 선택"
            className="min-w-0 flex-1"
            value={question.id}
            onChange={(value) => update({ question: value })}
            options={questions.map((item, index) => ({ value: item.id, label: `${index + 1}. ${stripRichText(item.titleKo)}` }))}
          />
          <Button variant="outline" size="sm" disabled={questionIndex === 0} onClick={() => update({ question: questions[questionIndex - 1].id })}>이전 질문</Button><span className="text-sm">{questionIndex + 1} / {questions.length}</span><Button variant="outline" size="sm" disabled={questionIndex >= questions.length - 1} onClick={() => update({ question: questions[questionIndex + 1].id })}>다음 질문</Button>
        </div> : null}
        {view === "summary" ? <SurveyQuestionSummary analytics={statistics.data} questions={questions} responses={records.data?.items ?? []} /> : question ? <div className="space-y-3"><h3 className="px-1 font-semibold">{stripRichText(question.titleKo)}</h3>{Array.from((records.data?.items ?? []).reduce((groups, entry) => {
 const text = formatSurveyAnswer(entry.answers.find(a=>a.questionId===question.id),question) || "응답 없음";
 const list=groups.get(text) ?? [];list.push(entry.id);groups.set(text,list);return groups;
},new Map<string,string[]>())).map(([text,ids])=><article key={text} className="rounded-xl border border-slate-200 bg-white p-5"><p className="whitespace-pre-wrap break-words">{text}</p><div className="mt-4 border-t border-slate-100 pt-3"><span className="text-sm text-slate-500">응답 {ids.length}개</span><div className="mt-2 flex flex-wrap gap-2">{ids.map((id,index)=><Button key={id} variant="ghost" size="sm" onClick={()=>update({view:"individual",response:id})}>개별 응답 {index+1}</Button>)}</div></div></article>)}</div> : null}
        {total > pageSize ? <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4"><p className="text-center text-sm text-slate-500">{view === "questions" ? `현재 페이지의 응답 ${pageSize}개를 기준으로 답변을 묶어 표시합니다.` : `집계는 전체 응답 기준입니다. 서술형·첨부 답변은 ${pageSize}개씩 표시합니다.`}</p>{pager}</div> : null}
      </> : null}
      {view === "individual" ? <>
        <div className="rounded-xl border border-slate-200 bg-white p-4">{responseId ? <Button variant="outline" onClick={() => update({ response: null, entry: "1" })}>전체 응답 순서로 보기</Button> : pager}</div>
        {selected.isError && responseId ? <p role="alert">선택한 응답을 찾을 수 없습니다.</p> : !response ? <p role="status">{responseId && selected.isPending ? "응답을 불러오는 중입니다." : "이 번호에 응답이 없습니다. 이전 응답을 선택해 주세요."}</p> : <>
          <div className="rounded-xl border border-slate-200 bg-white p-5"><h3 className="font-semibold">{response.user?.nameKo ?? "익명 응답"}</h3><p className="mt-1 text-sm text-slate-500">{response.submittedAt ? formatKoreanDateTime(response.submittedAt) : "미제출"} · 읽기 전용</p></div>
          {questions.map((item, index) => {
            const answer = response.answers.find((value) => value.questionId === item.id);
            const content = answer?.content;
            const ids = Array.isArray(content?.assetIds) ? content.assetIds.filter((id): id is string => typeof id === "string") : typeof content?.assetId === "string" ? [content.assetId] : [];
            return <article key={item.id} className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6"><p className="mb-2 text-xs text-slate-500">질문 {index + 1}</p><h3 className="font-medium">{stripRichText(item.titleKo)}</h3><div className="mt-4 whitespace-pre-wrap break-words text-sm leading-7">{item.questionType === "file_upload" && ids.length ? ids.map((id, fileIndex) => <a key={id} className="block text-brand-primary underline" href={resolveAssetUrl(`asset:${id}`)} target="_blank" rel="noopener noreferrer">첨부파일 {fileIndex + 1}</a>) : <SurveyQuestionInput question={item} value={answerContentToValue(item.questionType, answer)} lang="ko" disabled onChange={()=>{}} />}</div></article>;
          })}
        </>}
      </> : null}
    </>}
  </section>;
}
