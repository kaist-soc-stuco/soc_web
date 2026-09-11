import { randomId } from "@/lib/random-id";
import { createApiClient } from "@soc/api-client";
import type { AdminUserRecord, CreateVoteRequest, VoteDetailResponse, VoteItemType, VoteResultsResponse, VoteVoterRecord } from "@soc/contracts";
import { FileSpreadsheet, Plus, Trash2, UserPlus } from "lucide-react";
import { useEffect, useMemo, useState, type ChangeEvent, type SetStateAction } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import * as XLSX from "xlsx";
import { htmlDatetimeLocalToIso, isoToHtmlDatetimeLocal, isoToMs, isoToTimeObj, nowMs } from "@soc/shared";

import { AuthGuard } from "@/components/guards/auth-guard";
import { Button } from "@/components/ui/button";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";
import { UiFormField, UiInput, UiSelect, UiTextarea } from "@/components/ui/form-control";
import { AdminCard, AdminCardHeader, AdminPageHeader, AdminPageMain, AdminPageShell } from "@/components/ui/admin-page";
import { useToast } from "@/components/ui/toast";
import { resolveApiBaseUrl } from "@/lib/api-base-url";
import { Permissions } from "@/lib/permissions";

type DraftItem = CreateVoteRequest["items"][number];
type Draft = Omit<CreateVoteRequest, "startsAt" | "endsAt"> & { startsAt: string; endsAt: string };
const uid = () => randomId();
const localValue = (iso?: string) => iso ? `${isoToHtmlDatetimeLocal(iso)}:${String(isoToTimeObj(iso).second).padStart(2, "0")}` : "";
const scheduleIso = (value: string) => new Date(Date.parse(htmlDatetimeLocalToIso(value)) + Number(value.split(":")[2] ?? 0) * 1000).toISOString();
const defaultOptions = () => [
  { id: uid(), labelKo: "찬성", labelEn: "Yes", descriptionKo: null, descriptionEn: null, imageUrl: null },
  { id: uid(), labelKo: "반대", labelEn: "No", descriptionKo: null, descriptionEn: null, imageUrl: null },
  { id: uid(), labelKo: "기권", labelEn: "Abstain", descriptionKo: null, descriptionEn: null, imageUrl: null },
];
const newItem = (): DraftItem => ({ id: uid(), titleKo: "", titleEn: null, descriptionKo: null, descriptionEn: null, type: "YES_NO_ABSTAIN", maxSelections: 1, options: defaultOptions() });
const initialDraft = (): Draft => ({
  titleKo: "", titleEn: null, descriptionKo: null, descriptionEn: null,
  startsAt: "", endsAt: "", academicStatuses: [], feePayersOnly: false, quorumPercent: 50, quorumInclusive: true,
  studentNumberFrom: null, studentNumberTo: null, items: [newItem()],
});

export function VoteEditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const client = useMemo(() => createApiClient({ baseUrl: resolveApiBaseUrl() }), []);
  const [results, setResults] = useState<VoteResultsResponse | null>(null);
  const [vote, setVote] = useState<VoteDetailResponse | null>(null);
  const [draft, setDraftState] = useState<Draft>(initialDraft);
  const [koreanOnly, setKoreanOnly] = useState(false);
  const [clock, setClock] = useState(nowMs());
  useEffect(() => { const timer = setInterval(() => setClock(nowMs()), 1000); return () => clearInterval(timer); }, []);
  const [dirty, setDirty] = useState(false);
  const [editorTab, setEditorTab] = useState<"questions" | "voters" | "operations">("questions");
  const setDraft = (value: SetStateAction<Draft>) => { setDraftState(value); setDirty(true); };
  const [voters, setVoters] = useState<VoteVoterRecord[]>([]);
  const [voterQuery, setVoterQuery] = useState("");
  const [candidateQuery, setCandidateQuery] = useState("");
  const [candidates, setCandidates] = useState<AdminUserRecord[]>([]);
  const [busy, setBusy] = useState(false);
  const { confirm, ConfirmDialog } = useConfirmDialog();
  const { toast } = useToast();

  const load = async (voteId: string) => {
    const detail = await client.getVote(voteId);
    setVote(detail);
    setResults(detail.status === "TALLIED" ? await client.getVoteResults(voteId) : null);
    setKoreanOnly(!detail.titleEn && !detail.descriptionEn && detail.items.every(item => !item.titleEn));
    setDraft({
      titleKo: detail.titleKo, titleEn: detail.titleEn, descriptionKo: detail.descriptionKo, descriptionEn: detail.descriptionEn,
      startsAt: localValue(detail.startsAt), endsAt: localValue(detail.endsAt), academicStatuses: detail.academicStatuses,
      quorumPercent: detail.quorumPercent ?? 50, quorumInclusive: detail.quorumInclusive,
      feePayersOnly: detail.feePayersOnly, studentNumberFrom: detail.studentNumberFrom, studentNumberTo: detail.studentNumberTo,
      items: detail.items.map(({ id, titleKo, titleEn, descriptionKo, descriptionEn, type, maxSelections, options }) => ({ id, titleKo, titleEn, descriptionKo, descriptionEn, type, maxSelections, options: options.map(({ id, labelKo, labelEn, descriptionKo, descriptionEn, imageUrl }) => ({ id, labelKo, labelEn, descriptionKo, descriptionEn, imageUrl })) })),
    });
    setDirty(false);
    setVoters(await client.listVoteVoters(voteId));
  };
  useEffect(() => { if (id) void load(id).catch(() => toast({ type: "error", message: "투표를 불러오지 못했습니다." })); }, [id]);
  useEffect(() => {
    if (!id || vote?.status !== "PUBLISHED") return;
    let cancelled = false;
    const timer = setInterval(() => { void Promise.all([client.getVote(id), client.listVoteVoters(id)]).then(([detail, roster]) => { if (!cancelled) { setVote(detail); setVoters(roster); } }).catch(() => undefined); }, 15000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [id, vote?.status, client]);

  const setItem = (index: number, patch: Partial<DraftItem>) => setDraft((current) => ({ ...current, items: current.items.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item) }));
  const changeType = (index: number, type: VoteItemType) => {
    if (type === "YES_NO_ABSTAIN") setItem(index, { type, maxSelections: 1, options: defaultOptions() });
    else setItem(index, { type, maxSelections: 1, options: [{ id: uid(), labelKo: "", labelEn: null }, { id: uid(), labelKo: "", labelEn: null }] });
  };
  const setOption = (itemIndex: number, optionIndex: number, labelKo: string) => setDraft((current) => ({ ...current, items: current.items.map((item, index) => index !== itemIndex ? item : ({ ...item, options: item.options.map((option, idx) => idx === optionIndex ? { ...option, labelKo } : option) })) }));

  const payload = (): CreateVoteRequest => ({
    ...draft,
    startsAt: scheduleIso(draft.startsAt),
    endsAt: scheduleIso(draft.endsAt),
    titleEn: koreanOnly ? null : draft.titleEn || null,
    descriptionKo: draft.descriptionKo || null,
    descriptionEn: koreanOnly ? null : draft.descriptionEn || null,
    studentNumberFrom: draft.studentNumberFrom || null,
    studentNumberTo: draft.studentNumberTo || null,
    items: draft.items.map((item) => ({ ...item, titleEn: koreanOnly ? null : item.titleEn || null, options: item.options.map(option => ({ ...option, labelEn: koreanOnly ? null : option.labelEn, descriptionEn: koreanOnly ? null : option.descriptionEn })), descriptionKo: item.descriptionKo || null, descriptionEn: koreanOnly ? null : item.descriptionEn || null })),
  });

  const save = async () => {
    if (!draft.titleKo.trim() || !draft.startsAt || !draft.endsAt || draft.items.some((item) => !item.titleKo.trim() || item.options.some((option) => !option.labelKo.trim()))) {
      toast({ type: "error", message: "제목, 기간, 안건과 선택지를 모두 입력해 주세요." }); return;
    }
    setBusy(true);
    try {
      if (id) await client.updateVote(id, payload());
      else {
        const created = await client.createVote(payload());
        navigate(`/admin/votes/${created.id}`, { replace: true });
        return;
      }
      await load(id);
      toast({ type: "success", message: "저장했습니다." });
    } catch { toast({ type: "error", message: "투표를 저장하지 못했습니다." }); }
    finally { setBusy(false); }
  };

  const run = async (label: string, action: () => Promise<unknown>) => {
    if (!id || !await confirm({ title: label === "마감" ? "투표 마감" : label === "개표" ? "투표 개표" : label === "게시" ? "투표 게시" : label, description: label === "게시" ? "업로드·추가한 선거인명부가 확정되고 투표 안건 편집이 잠깁니다. 투표를 게시하시겠습니까?" : label === "마감" ? "투표를 즉시 마감하여 더 이상 참여할 수 없게 됩니다. 제출된 투표는 유지되며, 개표와 결과 공개는 별도로 진행합니다. 정말 마감하시겠습니까?" : label === "개표" ? "마감된 투표함을 개표하여 안건별 득표 수를 집계합니다. 결과는 아직 참여자에게 공개되지 않습니다. 정말 개표하시겠습니까?" : label === "결과 비공개 전환" ? "결과 조회를 중단합니다. 이미 열람하거나 내려받은 결과는 회수할 수 없습니다. 비공개로 전환하시겠습니까?" : "집계된 결과를 사용자에게 공개합니다. 결과를 공개하시겠습니까?", confirmLabel: label })) return;
    setBusy(true);
    try { await action(); await load(id); toast({ type: "success", message: `${label}했습니다.` }); }
    catch { toast({ type: "error", message: `${label}하지 못했습니다.` }); }
    finally { setBusy(false); }
  };

  const searchCandidates = async () => {
    const rows = await client.searchUsers(candidateQuery, 30);
    setCandidates(rows.filter((user) => /전산|computer|computing/i.test(user.primaryMajor ?? "")));
  };
  const addCandidate = async (userId: string) => { if (!id) return; try { await client.addVoteVoters(id, { userIds: [userId] }); setVoters(await client.listVoteVoters(id)); toast({type:"success",message:"명부에 추가했습니다."}); } catch { toast({type:"error",message:"추가하지 못했습니다."}); } };
  const importXlsx = async (event: ChangeEvent<HTMLInputElement>) => {
    if (!id || !event.target.files?.[0]) return;
    try {
      const workbook = XLSX.read(await event.target.files[0].arrayBuffer(), { type: "array" });
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[workbook.SheetNames[0]], { defval: "" });
      const key = Object.keys(rows[0] ?? {}).find(key => ["학번", "stdno", "studentnumber", "student_number"].includes(key.trim().toLowerCase()));
      if (!key) throw new Error("학번 열을 찾지 못했습니다.");
      const numbers = [...new Set(rows.map(row => String(row[key]).trim()).filter(Boolean))];
      if (!numbers.length || numbers.some(number => !/^\d{6,12}$/.test(number))) throw new Error("학번을 확인해 주세요.");
      const result = await client.addVoteVoters(id, { studentNumbers: numbers });
      setVoters(await client.listVoteVoters(id)); toast({ type: "success", message: `${result.added}명을 명부에 반영했습니다.` });
    } catch { toast({ type: "error", message: "명부를 불러오지 못했습니다. 학번 열과 등록된 주전공 계정을 확인하세요." }); }
    finally { event.target.value = ""; }

  };
  const effectiveVoters = voters;
  const [rosterPage, setRosterPage] = useState(1);
  const [rosterPageSize, setRosterPageSize] = useState(20);
  const [addingVoter, setAddingVoter] = useState(false);
  const exportRoster = () => {
    const sheet = XLSX.utils.json_to_sheet(effectiveVoters.map(voter => ({ 학번: voter.studentNumber, 이름: voter.nameKo, 과비: voter.feeStatus, 참여: voter.hasVoted ? "참여완료" : "미참여", 상태: voter.status })));
    const workbook = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(workbook, sheet, "선거인명부"); XLSX.writeFile(workbook, "선거인명부.xlsx");
  };
  const exportResults = async () => {
    if (!id) return;
    try { const results = await client.getVoteResults(id); const workbook = XLSX.utils.book_new(); const rows = results.items.flatMap(item => item.options.map(option => ({ 안건: item.titleKo, 선택지: option.labelKo, 득표: option.count, 비율: option.percentage })));
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), "개표 결과"); XLSX.writeFile(workbook, "투표 결과.xlsx");
    } catch { toast({ type: "error", message: "결과를 내려받지 못했습니다." }); }
  };
  const visibleVoters = effectiveVoters.filter((voter) => `${voter.nameKo} ${voter.studentNumber ?? ""} ${voter.email}`.toLowerCase().includes(voterQuery.toLowerCase()));
  const quorumMet = !vote || vote.quorumPercent === null || (vote.eligibleCount > 0 && (vote.quorumInclusive ? vote.votedCount * 100 >= vote.eligibleCount * vote.quorumPercent : vote.votedCount * 100 > vote.eligibleCount * vote.quorumPercent));
  const editable = !vote || vote.status === "DRAFT";
  const rosterEditable = vote?.status === "DRAFT";

  return (
    <AuthGuard requirePermission={Permissions.MANAGE_VOTE}>
      <AdminPageShell><AdminPageMain className="admin-vote-editor">
        <div className="admin-vote-editor__header sticky top-0 z-40 -mx-4 bg-[#f7f9fc]/95 px-4 pt-1 backdrop-blur sm:-mx-5 sm:px-5 md:-mx-8 md:px-8 xl:-mx-10 xl:px-10">
          <div className="mb-2"><span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold">{vote?.resultsPublishedAt ? "결과 공개됨" : vote ? (vote.status === "PUBLISHED" && clock >= isoToMs(vote.endsAt) ? "투표 기간 종료" : { DRAFT: "임시저장", PUBLISHED: "진행 중", CLOSED: "마감됨", TALLIED: "개표 완료" }[vote.status]) : "작성 중"}</span></div><AdminPageHeader title={!id ? "새 투표" : "투표 관리"} actions={<div className="flex min-w-0 flex-wrap gap-2"><Button variant="outline" asChild><Link to="/admin/votes">목록으로</Link></Button>{editable ? <Button onClick={() => void save()} disabled={busy}>저장</Button> : null}{vote?.status === "DRAFT" ? <Button onClick={() => void run("게시", () => client.publishVote(id!))} disabled={busy || dirty} title={dirty ? "변경 사항을 먼저 저장하세요." : undefined}>투표 게시 및 명부 동결</Button> : null}{vote?.status === "PUBLISHED" && clock < isoToMs(vote.endsAt) ? <Button onClick={() => void run("마감", () => client.closeVote(id!))} disabled={busy}>투표 조기 마감</Button> : null}{(vote?.status === "CLOSED" || (vote?.status === "PUBLISHED" && clock >= isoToMs(vote.endsAt))) ? <Button onClick={() => void run("개표", async () => { if (vote.status === "PUBLISHED") await client.closeVote(id!); return client.tallyVote(id!); })} disabled={busy || !quorumMet} title={!quorumMet ? "기준 투표율에 도달하지 못했습니다." : undefined}>투표함 개표하기</Button> : null}{vote?.status === "TALLIED" && !vote.resultsPublishedAt ? <Button onClick={() => void run("결과 공개", () => client.publishVoteResults(id!))} disabled={busy}>결과 공개</Button> : null}{vote?.resultsPublishedAt ? <Button onClick={() => void run("결과 비공개 전환", () => client.unpublishVoteResults(id!))} disabled={busy}>결과 비공개 전환</Button> : null}</div>} />
        </div>

        <div className="flex flex-wrap gap-2" aria-label="투표 편집 영역">{([["questions", "투표 안건 및 후보자 관리"], ["voters", "선거인명부 및 투표 요건"], ["operations", "선거 진행 및 개표 관리"]] as const).map(([value, label]) => <Button key={value} variant={editorTab === value ? "default" : "outline"} aria-pressed={editorTab === value} onClick={() => setEditorTab(value)}>{label}</Button>)}{dirty ? <span role="status" className="self-center text-sm text-amber-700">저장하지 않은 변경 사항</span> : null}</div>
        {editorTab === "operations" ? <div className="space-y-5"><ol className="flex flex-wrap items-center gap-3 text-sm">{["준비","진행","마감","개표","공개"].map((step,index)=><li key={step} className="flex items-center gap-3"><span className={`rounded-full px-4 py-2 ${index === (vote?.resultsPublishedAt ? 4 : vote ? {DRAFT:0,PUBLISHED:1,CLOSED:2,TALLIED:3}[vote.status] : 0) ? "bg-emerald-600 font-semibold text-white" : "bg-slate-100 text-slate-500"}`}>{step}</span>{index<4 ? <span className="text-slate-300">→</span> : null}</li>)}</ol><div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[["총 유권자",`${vote?.eligibleCount ?? 0}명`],["투표자",`${vote?.votedCount ?? 0}명`],["투표율",`${vote?.eligibleCount ? (vote.votedCount*100/vote.eligibleCount).toFixed(1) : "0.0"}%`],["정족수 판정",quorumMet ? "충족" : "미달"]].map(([label,value])=><div key={label} className="rounded-xl border border-slate-200 bg-white p-5"><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-xl font-semibold">{value}</p></div>)}</div>{results ? <div className="flex gap-2"><Button variant="outline" onClick={()=>void exportResults()}>결과 엑셀 다운로드</Button><Button variant="outline" onClick={()=>window.print()}>인쇄</Button></div> : null}</div> : null}
        {editorTab === "operations" && results ? <AdminCard><div className="space-y-6 p-5"><h2 className="font-semibold">{vote?.titleKo} 개표 결과</h2><p className="text-sm">총 {results.totalBallots}명 참여</p>{results.items.map(item => <section key={item.itemId} className="space-y-3"><h3 className="font-medium">{item.titleKo}</h3>{item.options.map(option => <div key={option.optionId}><div className="mb-1 flex justify-between gap-3 text-sm"><span>{option.labelKo}</span><span>{option.count}표 ({option.percentage.toFixed(1)}%)</span></div><div className="h-3 rounded-full bg-slate-100"><div className={`h-full rounded-full ${option.count > 0 && option.count === Math.max(...item.options.map(value => value.count)) ? "bg-emerald-500" : "bg-emerald-500"}`} style={{ width: `${Math.min(100, option.percentage)}%` }} /></div></div>)}</section>)}</div></AdminCard> : null}
        <div hidden={editorTab !== "questions"}><AdminCard>
        <AdminCardHeader><h2 className="text-base font-medium text-[#172033]">기본 정보</h2></AdminCardHeader>
          <div className="grid gap-5 p-4 sm:p-5 md:grid-cols-2">
            <UiFormField label="투표 제목"><UiInput disabled={!editable} value={draft.titleKo} onChange={(e) => setDraft({ ...draft, titleKo: e.target.value })} /></UiFormField>
            <UiFormField className={koreanOnly ? "hidden" : ""} label="영문 제목"><UiInput disabled={!editable} value={draft.titleEn ?? ""} onChange={(e) => setDraft({ ...draft, titleEn: e.target.value })} /></UiFormField>
            <label className="flex items-center gap-2 text-sm md:col-span-2"><input type="checkbox" disabled={!editable} checked={koreanOnly} onChange={e=>{setKoreanOnly(e.target.checked);setDirty(true);}} />한국어 전용</label><UiFormField label="설명"><UiTextarea disabled={!editable} value={draft.descriptionKo ?? ""} onChange={(e) => setDraft({ ...draft, descriptionKo: e.target.value })} /></UiFormField>{!koreanOnly ? <UiFormField label="영문 설명"><UiTextarea disabled={!editable} value={draft.descriptionEn ?? ""} onChange={e => setDraft({ ...draft, descriptionEn: e.target.value })} /></UiFormField> : null}
            <UiFormField label="시작 일시"><UiInput type="datetime-local" step="1" disabled={!editable} value={draft.startsAt} onChange={(e) => setDraft({ ...draft, startsAt: e.target.value })} /></UiFormField>
            <UiFormField label="종료 일시"><UiInput type="datetime-local" step="1" disabled={!editable} value={draft.endsAt} onChange={(e) => setDraft({ ...draft, endsAt: e.target.value })} /></UiFormField>
          </div>
        </AdminCard></div>

        {editorTab === "voters" ? <div className="flex flex-wrap items-end gap-4"><UiFormField label="개표 정족수 (%)"><UiInput type="number" min={0} max={100} disabled={!editable} value={draft.quorumPercent} onChange={e=>setDraft({...draft,quorumPercent:Number(e.target.value)})} /></UiFormField><UiFormField label="기준"><UiSelect disabled={!editable} value={draft.quorumInclusive ? "inclusive" : "exclusive"} onChange={e=>setDraft({...draft,quorumInclusive:e.target.value === "inclusive"})}><option value="inclusive">이상</option><option value="exclusive">초과</option></UiSelect></UiFormField></div> : null}
        <div hidden={editorTab !== "questions"}><AdminCard>
          <AdminCardHeader><h2 className="text-base font-medium text-[#172033]">투표 안건</h2>{editable ? <Button variant="outline" size="sm" onClick={() => setDraft({ ...draft, items: [...draft.items, newItem()] })}><Plus />안건 추가</Button> : null}</AdminCardHeader>
          <div className="space-y-4 p-4 sm:p-5">{draft.items.map((item, itemIndex) => <section key={item.id ?? itemIndex} className="rounded-xl border border-slate-200 p-4">{editable ? <div className="mb-3 flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={() => setDraft({ ...draft, items: [...draft.items.slice(0, itemIndex + 1), { ...item, id: uid(), options: item.options.map((option) => ({ ...option, id: uid() })) }, ...draft.items.slice(itemIndex + 1)] })}>안건 복제</Button>{[-1, 1].map((direction) => <Button key={direction} variant="ghost" size="sm" disabled={itemIndex + direction < 0 || itemIndex + direction >= draft.items.length} onClick={() => { const items = [...draft.items]; [items[itemIndex], items[itemIndex + direction]] = [items[itemIndex + direction], items[itemIndex]]; setDraft({ ...draft, items }); }}>{direction < 0 ? "위로" : "아래로"}</Button>)}</div> : null}<div className="grid gap-3 md:grid-cols-2"><UiInput disabled={!editable} aria-label={`안건 ${itemIndex + 1} 국문 제목`} placeholder={`안건 ${itemIndex + 1}`} value={item.titleKo} onChange={(e) => setItem(itemIndex, { titleKo: e.target.value })} />{!koreanOnly ? <UiInput aria-label={`안건 ${itemIndex + 1} 영문 제목`} disabled={!editable} placeholder="Agenda title" value={item.titleEn ?? ""} onChange={e => setItem(itemIndex, { titleEn: e.target.value })} /> : null}<UiSelect disabled={!editable} value={item.type} onChange={(e) => changeType(itemIndex, e.target.value as VoteItemType)}><option value="YES_NO_ABSTAIN">찬성·반대·기권</option><option value="SINGLE_CHOICE">단일 선택 (1인 1표)</option><option value="MULTIPLE_CHOICE">복수 선택</option></UiSelect>{editable && draft.items.length > 1 ? <Button variant="ghost" size="icon" aria-label="안건 삭제" onClick={() => setDraft({ ...draft, items: draft.items.filter((_, index) => index !== itemIndex) })}><Trash2 /></Button> : null}</div>{item.type === "MULTIPLE_CHOICE" ? <UiFormField className="mt-3 max-w-52" label="최대 선택 수"><UiInput type="number" min={1} max={item.options.length} disabled={!editable} value={item.maxSelections} onChange={(e) => setItem(itemIndex, { maxSelections: Number(e.target.value) })} /></UiFormField> : null}<div className="mt-4 grid gap-2">{item.options.map((option, optionIndex) => <div key={option.id ?? optionIndex} className="flex min-w-0 flex-wrap gap-2"><UiInput className="min-w-0 flex-1" disabled={!editable || item.type === "YES_NO_ABSTAIN"} value={option.labelKo} onChange={(e) => setOption(itemIndex, optionIndex, e.target.value)} />{!koreanOnly ? <UiInput aria-label="후보자·선택지 영문" className="min-w-0 flex-1" disabled={!editable || item.type === "YES_NO_ABSTAIN"} value={option.labelEn ?? ""} onChange={e => setItem(itemIndex, { options: item.options.map((value, i) => i === optionIndex ? { ...value, labelEn: e.target.value } : value) })} /> : null}{editable && item.type !== "YES_NO_ABSTAIN" && item.options.length > 2 ? <Button variant="ghost" size="icon" aria-label="선택지 삭제" onClick={() => setItem(itemIndex, { options: item.options.filter((_, index) => index !== optionIndex), maxSelections: Math.min(item.maxSelections, item.options.length - 1) })}><Trash2 /></Button> : null}</div>)}{editable && item.type !== "YES_NO_ABSTAIN" ? <Button variant="outline" size="sm" className="min-h-11 justify-self-start md:min-h-9" onClick={() => setItem(itemIndex, { options: [...item.options, { id: uid(), labelKo: "", labelEn: null }] })}><Plus />선택지</Button> : null}</div></section>)}</div>
        </AdminCard></div>

        {editorTab === "voters" && vote ? <AdminCard>
          <AdminCardHeader><h2 className="font-semibold">선거인 명부</h2><span className="text-sm text-slate-500">총 {voters.filter(v=>v.status === "ELIGIBLE").length}명</span></AdminCardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5"><UiInput className="max-w-xs" placeholder="학번 또는 이름 검색" value={voterQuery} onChange={e=>{setVoterQuery(e.target.value);setRosterPage(1);}} /><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={exportRoster}><FileSpreadsheet />명부 엑셀 다운</Button>{rosterEditable ? <><label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm"><FileSpreadsheet className="size-4" />엑셀 업로드<input className="hidden" type="file" accept=".xlsx,.xls" onChange={e=>void importXlsx(e)} /></label><Button variant="outline" onClick={()=>setAddingVoter(!addingVoter)}><UserPlus />수동 추가</Button></> : null}</div></div>
          {addingVoter && rosterEditable ? <div className="space-y-3 border-b border-slate-100 p-5"><div className="flex gap-2"><UiInput className="max-w-xs" placeholder="학번 또는 이름" value={candidateQuery} onChange={e=>setCandidateQuery(e.target.value)} /><Button variant="outline" onClick={()=>void searchCandidates()}>검색</Button></div><div className="flex flex-wrap gap-2">{candidates.map(candidate=><Button key={candidate.userId} variant="outline" size="sm" onClick={()=>void addCandidate(candidate.userId)}>{candidate.nameKo} · {candidate.stdNo}</Button>)}</div></div> : null}
          <div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm"><thead className="bg-slate-50"><tr>{["학번","이름","전공 구분","과비 납부","투표 상태","투표 일시",...(rosterEditable?["관리"]:[])].map(label=><th key={label} className="px-5 py-3 font-medium">{label}</th>)}</tr></thead><tbody>{visibleVoters.slice((rosterPage-1)*rosterPageSize,rosterPage*rosterPageSize).map(voter=><tr key={voter.userId} className="border-t border-slate-100"><td className="px-5 py-3">{voter.studentNumber}</td><td className="px-5 py-3">{voter.nameKo}</td><td className="px-5 py-3">주전공</td><td className="px-5 py-3"><span className="rounded border px-2 py-0.5">{voter.feeStatus === "PAID" ? "완납" : "미납"}</span></td><td className="px-5 py-3"><span className="rounded border px-2 py-0.5">{voter.status === "EXCLUDED" ? "제외" : voter.hasVoted ? "참여완료" : "미참여"}</span></td><td className="px-5 py-3">{voter.votedAt ? new Date(voter.votedAt).toLocaleTimeString("ko-KR",{hour12:false,timeZone:"Asia/Seoul"}) : "—"}</td>{rosterEditable ? <td className="px-5 py-3"><Button variant="ghost" size="sm" onClick={async()=>{try{if(voter.status === "EXCLUDED") await client.addVoteVoters(id!,{userIds:[voter.userId]});else await client.excludeVoteVoters(id!,[voter.userId]);setVoters(await client.listVoteVoters(id!));}catch{toast({type:"error",message:"명부를 수정하지 못했습니다."});}}}>{voter.status === "EXCLUDED" ? "복원" : "제외"}</Button></td> : null}</tr>)}</tbody></table></div>
          <div className="flex items-center justify-between border-t border-slate-100 p-5"><div className="flex items-center gap-2"><Button variant="ghost" disabled={rosterPage<=1} onClick={()=>setRosterPage(rosterPage-1)}>이전</Button><span>{rosterPage} / {Math.max(1,Math.ceil(visibleVoters.length/rosterPageSize))}</span><Button variant="ghost" disabled={rosterPage*rosterPageSize>=visibleVoters.length} onClick={()=>setRosterPage(rosterPage+1)}>다음</Button></div><UiSelect className="w-32" value={rosterPageSize} onChange={e=>{setRosterPageSize(Number(e.target.value));setRosterPage(1);}}>{[20,50,100].map(n=><option key={n} value={n}>{n}개씩 보기</option>)}</UiSelect></div>
        </AdminCard> : editorTab === "voters" ? <p className="text-sm text-slate-500">투표를 저장한 뒤 명부를 업로드하세요.</p> : null}
      </AdminPageMain></AdminPageShell>
      {ConfirmDialog}
    </AuthGuard>
  );
}
