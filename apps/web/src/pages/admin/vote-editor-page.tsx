import { createApiClient } from "@soc/api-client";
import type { AdminUserRecord, CreateVoteRequest, VoteDetailResponse, VoteItemType, VoteVoterRecord } from "@soc/contracts";
import { FileSpreadsheet, Plus, Trash2, UserPlus } from "lucide-react";
import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import * as XLSX from "xlsx";
import { htmlDatetimeLocalToIso, isoToHtmlDatetimeLocal, isoToMs, nowMs } from "@soc/shared";

import { AuthGuard } from "@/components/guards/auth-guard";
import { Button } from "@/components/ui/button";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";
import { UiFormField, UiInput, UiSelect, UiTextarea } from "@/components/ui/form-control";
import { AdminCard, AdminCardHeader, AdminPageHeader, AdminPageMain, AdminPageShell } from "@/components/ui/admin-page";
import { VoteStatusBadge } from "@/components/ui/vote-status-badge";
import { useToast } from "@/components/ui/toast";
import { resolveApiBaseUrl } from "@/lib/api-base-url";
import { Permissions } from "@/lib/permissions";

type DraftItem = CreateVoteRequest["items"][number];
type Draft = Omit<CreateVoteRequest, "startsAt" | "endsAt"> & { startsAt: string; endsAt: string };
const uid = () => crypto.randomUUID();
const localValue = (iso?: string) => iso ? isoToHtmlDatetimeLocal(iso) : "";
const defaultOptions = () => [
  { id: uid(), labelKo: "찬성", labelEn: "Yes", descriptionKo: null, descriptionEn: null, imageUrl: null },
  { id: uid(), labelKo: "반대", labelEn: "No", descriptionKo: null, descriptionEn: null, imageUrl: null },
  { id: uid(), labelKo: "기권", labelEn: "Abstain", descriptionKo: null, descriptionEn: null, imageUrl: null },
];
const newItem = (): DraftItem => ({ id: uid(), titleKo: "", titleEn: null, descriptionKo: null, descriptionEn: null, type: "YES_NO_ABSTAIN", maxSelections: 1, options: defaultOptions() });
const initialDraft = (): Draft => ({
  titleKo: "", titleEn: null, descriptionKo: null, descriptionEn: null,
  startsAt: "", endsAt: "", academicStatuses: ["재학"], feePayersOnly: false,
  studentNumberFrom: null, studentNumberTo: null, items: [newItem()],
});

export function VoteEditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const client = useMemo(() => createApiClient({ baseUrl: resolveApiBaseUrl() }), []);
  const [vote, setVote] = useState<VoteDetailResponse | null>(null);
  const [draft, setDraft] = useState<Draft>(initialDraft);
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
    setDraft({
      titleKo: detail.titleKo, titleEn: detail.titleEn, descriptionKo: detail.descriptionKo, descriptionEn: detail.descriptionEn,
      startsAt: localValue(detail.startsAt), endsAt: localValue(detail.endsAt), academicStatuses: detail.academicStatuses,
      feePayersOnly: detail.feePayersOnly, studentNumberFrom: detail.studentNumberFrom, studentNumberTo: detail.studentNumberTo,
      items: detail.items.map((item) => ({ ...item, options: item.options })),
    });
    if (detail.status !== "DRAFT") setVoters(await client.listVoteVoters(voteId));
  };
  useEffect(() => { if (id) void load(id); }, [id]);

  const setItem = (index: number, patch: Partial<DraftItem>) => setDraft((current) => ({ ...current, items: current.items.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item) }));
  const changeType = (index: number, type: VoteItemType) => {
    if (type === "YES_NO_ABSTAIN") setItem(index, { type, maxSelections: 1, options: defaultOptions() });
    else setItem(index, { type, maxSelections: 1, options: [{ id: uid(), labelKo: "", labelEn: null }, { id: uid(), labelKo: "", labelEn: null }] });
  };
  const setOption = (itemIndex: number, optionIndex: number, labelKo: string) => setDraft((current) => ({ ...current, items: current.items.map((item, index) => index !== itemIndex ? item : ({ ...item, options: item.options.map((option, idx) => idx === optionIndex ? { ...option, labelKo } : option) })) }));

  const payload = (): CreateVoteRequest => ({
    ...draft,
    startsAt: htmlDatetimeLocalToIso(draft.startsAt),
    endsAt: htmlDatetimeLocalToIso(draft.endsAt),
    titleEn: draft.titleEn || null,
    descriptionKo: draft.descriptionKo || null,
    descriptionEn: draft.descriptionEn || null,
    studentNumberFrom: draft.studentNumberFrom || null,
    studentNumberTo: draft.studentNumberTo || null,
    items: draft.items.map((item) => ({ ...item, titleEn: item.titleEn || null, descriptionKo: item.descriptionKo || null, descriptionEn: item.descriptionEn || null })),
  });

  const save = async () => {
    if (!draft.titleKo.trim() || !draft.startsAt || !draft.endsAt || draft.items.some((item) => !item.titleKo.trim() || item.options.some((option) => !option.labelKo.trim()))) {
      toast({ type: "error", message: "제목, 기간, 문항과 선택지를 모두 입력해 주세요." }); return;
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
    if (!id || !await confirm({ title: `${label}할까요?`, description: label === "게시" ? "현재 조건으로 전산학부 주전생 명부가 확정되고 문항 편집이 잠깁니다." : undefined, confirmLabel: label })) return;
    setBusy(true);
    try { await action(); await load(id); toast({ type: "success", message: `${label}했습니다.` }); }
    catch { toast({ type: "error", message: `${label}하지 못했습니다.` }); }
    finally { setBusy(false); }
  };

  const searchCandidates = async () => {
    const rows = await client.searchUsers(candidateQuery, 30);
    setCandidates(rows.filter((user) => /전산|computer|computing/i.test(user.primaryMajor ?? "")));
  };
  const addCandidate = async (userId: string) => { if (!id) return; await client.addVoteVoters(id, { userIds: [userId] }); await load(id); };
  const importXlsx = async (event: ChangeEvent<HTMLInputElement>) => {
    if (!id || !event.target.files?.[0]) return;
    const workbook = XLSX.read(await event.target.files[0].arrayBuffer(), { type: "array" });
    const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[workbook.SheetNames[0]], { header: 1 });
    const numbers = [...new Set(rows.flat().map(String).map((value) => value.trim()).filter((value) => /^\d{6,12}$/.test(value)))];
    const result = await client.addVoteVoters(id, { studentNumbers: numbers });
    await load(id); toast({ type: "success", message: `${result.added}명을 명부에 반영했습니다.` });
    event.target.value = "";
  };
  const visibleVoters = voters.filter((voter) => `${voter.nameKo} ${voter.studentNumber ?? ""} ${voter.email}`.toLowerCase().includes(voterQuery.toLowerCase()));
  const editable = !vote || vote.status === "DRAFT";
  const rosterEditable = vote?.status === "PUBLISHED" && nowMs() < isoToMs(vote.endsAt);

  return (
    <AuthGuard requirePermission={Permissions.MANAGE_VOTE}>
      <AdminPageShell><AdminPageMain>
        <AdminPageHeader title={!id ? "새 투표" : editable ? "투표 편집" : "투표 관리"} actions={<div className="flex gap-2"><Button variant="outline" asChild><Link to="/admin/votes">목록</Link></Button>{vote ? <VoteStatusBadge status={vote.status} startsAt={vote.startsAt} endsAt={vote.endsAt} /> : null}{editable ? <Button onClick={() => void save()} disabled={busy}>저장</Button> : null}{vote?.status === "DRAFT" ? <Button onClick={() => void run("게시", () => client.publishVote(id!))} disabled={busy}>게시</Button> : null}{vote?.status === "PUBLISHED" ? <Button onClick={() => void run("마감", () => client.closeVote(id!))} disabled={busy}>마감</Button> : null}{vote?.status === "CLOSED" ? <Button onClick={() => void run("집계", () => client.tallyVote(id!))} disabled={busy}>집계</Button> : null}{vote?.status === "TALLIED" && !vote.resultsPublishedAt ? <Button onClick={() => void run("결과 공개", () => client.publishVoteResults(id!))} disabled={busy}>결과 공개</Button> : null}</div>} />

        <AdminCard>
          <AdminCardHeader><h2 className="text-base font-medium text-[#172033]">기본 정보</h2></AdminCardHeader>
          <div className="grid gap-5 p-5 md:grid-cols-2">
            <UiFormField label="투표 제목"><UiInput disabled={!editable} value={draft.titleKo} onChange={(e) => setDraft({ ...draft, titleKo: e.target.value })} /></UiFormField>
            <UiFormField label="영문 제목"><UiInput disabled={!editable} value={draft.titleEn ?? ""} onChange={(e) => setDraft({ ...draft, titleEn: e.target.value })} /></UiFormField>
            <UiFormField label="설명" className="md:col-span-2"><UiTextarea disabled={!editable} value={draft.descriptionKo ?? ""} onChange={(e) => setDraft({ ...draft, descriptionKo: e.target.value })} /></UiFormField>
            <UiFormField label="시작 일시"><UiInput type="datetime-local" disabled={!editable} value={draft.startsAt} onChange={(e) => setDraft({ ...draft, startsAt: e.target.value })} /></UiFormField>
            <UiFormField label="종료 일시"><UiInput type="datetime-local" disabled={!editable} value={draft.endsAt} onChange={(e) => setDraft({ ...draft, endsAt: e.target.value })} /></UiFormField>
          </div>
        </AdminCard>

        <AdminCard>
          <AdminCardHeader><div><h2 className="text-base font-medium text-[#172033]">선거인 조건</h2><p className="mt-1 text-xs font-normal text-[#344054]">게시하는 순간 조건에 맞는 명부를 고정합니다.</p></div></AdminCardHeader>
          <div className="grid gap-5 p-5 md:grid-cols-2">
            <UiFormField label="소속"><UiInput value="전산학부 주전생" disabled /></UiFormField>
            <UiFormField label="학적 상태"><div className="flex h-[var(--ui-control-height)] items-center gap-5 rounded-lg border border-slate-200 px-3">{["재학", "휴학"].map((status) => <label key={status} className="flex items-center gap-2 text-sm font-normal text-[#344054]"><input type="checkbox" disabled={!editable} checked={draft.academicStatuses.includes(status)} onChange={(e) => setDraft({ ...draft, academicStatuses: e.target.checked ? [...draft.academicStatuses, status] : draft.academicStatuses.filter((value) => value !== status) })} />{status}</label>)}</div></UiFormField>
            <UiFormField label="시작 학번"><UiInput disabled={!editable} placeholder="예: 20200000" value={draft.studentNumberFrom ?? ""} onChange={(e) => setDraft({ ...draft, studentNumberFrom: e.target.value })} /></UiFormField>
            <UiFormField label="종료 학번"><UiInput disabled={!editable} placeholder="예: 20269999" value={draft.studentNumberTo ?? ""} onChange={(e) => setDraft({ ...draft, studentNumberTo: e.target.value })} /></UiFormField>
            <label className="flex items-center gap-2 text-sm font-normal text-[#344054]"><input type="checkbox" disabled={!editable} checked={draft.feePayersOnly} onChange={(e) => setDraft({ ...draft, feePayersOnly: e.target.checked })} />과비 납부자만 포함</label>
          </div>
        </AdminCard>

        <AdminCard>
          <AdminCardHeader><h2 className="text-base font-medium text-[#172033]">투표 문항</h2>{editable ? <Button variant="outline" size="sm" onClick={() => setDraft({ ...draft, items: [...draft.items, newItem()] })}><Plus />문항 추가</Button> : null}</AdminCardHeader>
          <div className="space-y-4 p-5">{draft.items.map((item, itemIndex) => <section key={item.id ?? itemIndex} className="rounded-xl border border-slate-200 p-4"><div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_13rem_auto]"><UiInput disabled={!editable} placeholder={`문항 ${itemIndex + 1}`} value={item.titleKo} onChange={(e) => setItem(itemIndex, { titleKo: e.target.value })} /><UiSelect disabled={!editable} value={item.type} onChange={(e) => changeType(itemIndex, e.target.value as VoteItemType)}><option value="YES_NO_ABSTAIN">찬성·반대·기권</option><option value="SINGLE_CHOICE">단일 선택</option><option value="MULTIPLE_CHOICE">복수 선택</option></UiSelect>{editable && draft.items.length > 1 ? <Button variant="ghost" size="icon" aria-label="문항 삭제" onClick={() => setDraft({ ...draft, items: draft.items.filter((_, index) => index !== itemIndex) })}><Trash2 /></Button> : null}</div>{item.type === "MULTIPLE_CHOICE" ? <UiFormField className="mt-3 max-w-52" label="최대 선택 수"><UiInput type="number" min={1} max={item.options.length} disabled={!editable} value={item.maxSelections} onChange={(e) => setItem(itemIndex, { maxSelections: Number(e.target.value) })} /></UiFormField> : null}<div className="mt-4 grid gap-2">{item.options.map((option, optionIndex) => <div key={option.id ?? optionIndex} className="flex gap-2"><UiInput disabled={!editable || item.type === "YES_NO_ABSTAIN"} value={option.labelKo} onChange={(e) => setOption(itemIndex, optionIndex, e.target.value)} />{editable && item.type !== "YES_NO_ABSTAIN" && item.options.length > 2 ? <Button variant="ghost" size="icon" aria-label="선택지 삭제" onClick={() => setItem(itemIndex, { options: item.options.filter((_, index) => index !== optionIndex), maxSelections: Math.min(item.maxSelections, item.options.length - 1) })}><Trash2 /></Button> : null}</div>)}{editable && item.type !== "YES_NO_ABSTAIN" ? <Button variant="outline" size="sm" className="justify-self-start" onClick={() => setItem(itemIndex, { options: [...item.options, { id: uid(), labelKo: "", labelEn: null }] })}><Plus />선택지</Button> : null}</div></section>)}</div>
        </AdminCard>

        {vote && vote.status !== "DRAFT" ? <AdminCard>
          <AdminCardHeader><div><h2 className="text-base font-medium text-[#172033]">선거인 명부</h2><p className="mt-1 text-xs font-normal text-[#344054]">{vote.votedCount}/{vote.eligibleCount}명 참여 · 투표 선택 내용은 조회할 수 없습니다.</p></div>{rosterEditable ? <label className="interaction-button inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-normal text-[#344054]"><FileSpreadsheet className="size-4" />XLSX 명부 추가<input className="hidden" type="file" accept=".xlsx,.xls" onChange={(e) => void importXlsx(e)} /></label> : null}</AdminCardHeader>
          <div className={`grid gap-3 border-b border-slate-100 p-5 ${rosterEditable ? "md:grid-cols-2" : ""}`}><UiInput placeholder="명부 검색" value={voterQuery} onChange={(e) => setVoterQuery(e.target.value)} />{rosterEditable ? <div className="flex gap-2"><UiInput placeholder="추가할 이름·학번 검색" value={candidateQuery} onChange={(e) => setCandidateQuery(e.target.value)} /><Button variant="outline" onClick={() => void searchCandidates()}><UserPlus />검색</Button></div> : null}</div>
          {rosterEditable && candidates.length > 0 ? <div className="flex flex-wrap gap-2 border-b border-slate-100 p-4">{candidates.map((candidate) => <Button key={candidate.userId} variant="outline" size="sm" onClick={() => void addCandidate(candidate.userId)}>{candidate.nameKo} · {candidate.stdNo}</Button>)}</div> : null}
          <div className="divide-y divide-slate-100">{visibleVoters.map((voter) => <div key={voter.userId} className={`flex items-center justify-between gap-4 px-5 py-3 ${voter.status === "EXCLUDED" ? "opacity-45" : ""}`}><div><p className="text-sm font-medium text-[#172033]">{voter.nameKo} <span className="font-normal text-[#344054]">{voter.studentNumber}</span></p><p className="mt-1 text-xs font-normal text-[#344054]">{voter.primaryMajor} · {voter.academicStatus ?? "학적 미상"} · {voter.hasVoted ? "참여" : "미참여"}</p></div>{rosterEditable && voter.status === "ELIGIBLE" && !voter.hasVoted ? <Button variant="ghost" size="sm" onClick={async () => { await client.excludeVoteVoters(id!, [voter.userId]); await load(id!); }}>제외</Button> : null}</div>)}</div>
        </AdminCard> : null}
      </AdminPageMain></AdminPageShell>
      {ConfirmDialog}
    </AuthGuard>
  );
}
