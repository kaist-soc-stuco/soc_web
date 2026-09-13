import { BuilderTextField, BuilderOptionAdd, BuilderRuleRow } from "@/components/ui/builder-field";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { EditorBackButton } from "@/components/ui/editor-back-button";
import { AdminSelectDropdown } from "@/components/ui/admin-select";
import { AdminStatusBadge } from "@/components/ui/admin-status-badge";
import { Pagination, PageSizeSelect } from "@/components/ui/pagination";
import { IconButton } from "@/components/ui/icon-button";
import { CreateVoteSchema } from "@soc/contracts";
import { VoteProgress } from "@/components/organisms/vote-progress";
import { VoteStatusBadge } from "@/components/ui/vote-status-badge";
import { restrictListDrag } from "@/lib/drag-bounds";
import { randomId } from "@/lib/random-id";
import { createApiClient } from "@soc/api-client";
import type { AdminUserRecord, CreateVoteRequest, VoteDetailResponse, VoteItemType, VoteResultsResponse, VoteVoterRecord } from "@soc/contracts";
import { closestCenter, DndContext, type DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Copy, Undo2, Redo2, Link2, Eye, MoreVertical, Download, Upload, GripVertical, ImagePlus, Loader2, Plus, Trash2, UserPlus, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode, type SetStateAction } from "react";
import { useNavigate, useParams } from "react-router-dom";
import * as XLSX from "xlsx";
import { meetsVoteQuorum, htmlDatetimeLocalToIso, isoToHtmlDatetimeLocal, isoToMs, isoToTimeObj, msToIso, nowIso, nowMs } from "@soc/shared";

import { AuthGuard } from "@/components/guards/auth-guard";
import { Button } from "@/components/ui/button";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";
import { UiFormField, UiInput } from "@/components/ui/form-control";
import { AdminCard, AdminPageHeader, AdminPageMain, AdminPageShell } from "@/components/ui/admin-page";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { resolveApiBaseUrl } from "@/lib/api-base-url";
import { resolveAssetUrl } from "@/lib/asset-url";
import { Permissions } from "@/lib/permissions";

type DraftItem = CreateVoteRequest["items"][number];
type Draft = Omit<CreateVoteRequest, "startsAt" | "endsAt"> & { startsAt: string; endsAt: string };
const uid = () => randomId();
const localValue = (iso?: string) => iso ? `${isoToHtmlDatetimeLocal(iso)}:${String(isoToTimeObj(iso).second).padStart(2, "0")}` : "";
const scheduleIso = (value: string) => msToIso(isoToMs(htmlDatetimeLocalToIso(value)) + Number(value.split(":")[2] ?? 0) * 1000);
const defaultOptions = () => [
  { id: uid(), labelKo: "찬성", labelEn: "Yes", descriptionKo: null, descriptionEn: null, imageUrl: null },
  { id: uid(), labelKo: "반대", labelEn: "No", descriptionKo: null, descriptionEn: null, imageUrl: null },
  { id: uid(), labelKo: "기권", labelEn: "Abstain", descriptionKo: null, descriptionEn: null, imageUrl: null },
];
const newItem = (): DraftItem => ({ id: uid(), titleKo: "", titleEn: null, descriptionKo: null, descriptionEn: null, type: "YES_NO_ABSTAIN", maxSelections: 1, options: defaultOptions() });
const formatVotedTime = (value?: string | null) => {
  if (!value) return "";
  const time = isoToTimeObj(value);
  return [time.hour, time.minute, time.second].map((part) => String(part).padStart(2, "0")).join(":");
};
const initialDraft = (): Draft => ({
  titleKo: "", titleEn: null, descriptionKo: null, descriptionEn: null,
  startsAt: localValue(nowIso()), endsAt: localValue(msToIso(nowMs() + 7 * 86400000)), academicStatuses: [], feePayersOnly: false, quorumPercent: 50, quorumInclusive: true,
  studentNumberFrom: null, studentNumberTo: null, items: [newItem()],
});

function SortableVoteAgendaCard({
  id,
  index,
  disabled,
  trailing,
  children,
}: {
  id: string;
  index: number;
  disabled: boolean;
  trailing: ReactNode;
  children: ReactNode;
}) {
  const {
    attributes,
    listeners,
    setActivatorNodeRef,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled });

  return (
    <section
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition: transition ?? "transform 180ms ease",
        zIndex: isDragging ? 20 : undefined,
      }}
      className={`relative rounded-xl border border-slate-200 bg-white p-5 pt-9 shadow-card sm:p-6 sm:pt-9 ${isDragging ? "relative shadow-lg" : ""}`}
    >
      <div className="mb-4 flex min-w-0 items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          {!disabled ? (
            <button
              ref={setActivatorNodeRef}
              type="button"
              aria-label={`안건 ${index + 1} 순서 이동`}
              data-tooltip="드래그하여 순서 변경"
              aria-grabbed={isDragging ? "true" : undefined}
              className="absolute left-1/2 top-1 -translate-x-1/2 inline-flex h-6 w-10 shrink-0 touch-none select-none cursor-grab items-center justify-center rounded-md border-0 bg-transparent p-0 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/30 active:cursor-grabbing"
              {...attributes}
              {...listeners}
            >
              <GripVertical aria-hidden="true" className="size-4 rotate-90" />
            </button>
          ) : null}
          <span className="truncate text-sm font-medium text-slate-600">안건 {index + 1}</span>
        </div>
        {trailing}
      </div>
      {children}
    </section>
  );
}

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
  const [editorTab, setEditorTab] = useState<"questions" | "voters" | "settings" | "operations">("questions");
  const draftRef = useRef(draft);
  const koreanRef = useRef(koreanOnly); koreanRef.current = koreanOnly;
  const voteIdRef = useRef(id);
  const ownCreatedId = useRef<string | null>(null);
  const history = useRef<Array<{draft: Draft; koreanOnly: boolean}>>([]);
  const future = useRef<Array<{draft: Draft; koreanOnly: boolean}>>([]);
  const remember = () => {
    history.current = [...history.current.slice(-99), {draft:draftRef.current, koreanOnly:koreanRef.current}];
    future.current = [];
  };
  const setDraft = (value: SetStateAction<Draft>) => {
    const next = typeof value === "function" ? value(draftRef.current) : value;
    remember();
    draftRef.current = next; setDraftState(next); setDirty(true);
  };
  const restore = (direction: "undo" | "redo") => {
    const source = direction === "undo" ? history : future;
    const target = direction === "undo" ? future : history;
    const next = source.current.pop(); if (!next) return;
    target.current.push({draft:draftRef.current,koreanOnly:koreanRef.current});
    draftRef.current = next.draft; koreanRef.current = next.koreanOnly;
    setDraftState(next.draft); setKoreanOnly(next.koreanOnly); setDirty(true);
  };
  const [voters, setVoters] = useState<VoteVoterRecord[]>([]);
  const [voterQuery, setVoterQuery] = useState("");
  const [candidateQuery, setCandidateQuery] = useState("");
  const [candidates, setCandidates] = useState<AdminUserRecord[]>([]);
  const [busy, setBusy] = useState(false);
  const [uploadingOptionId, setUploadingOptionId] = useState<string | null>(null);
  const { confirm, ConfirmDialog } = useConfirmDialog();
  const { toast } = useToast();

  const load = async (voteId: string) => {
    const detail = await client.getVote(voteId);
    setVote(detail);
    setResults(detail.status === "TALLIED" ? await client.getVoteResults(voteId) : null);
    setKoreanOnly(!detail.titleEn && !detail.descriptionEn && detail.items.every(item => !item.titleEn && !item.descriptionEn && item.options.every(option => !option.labelEn)));
    const nextDraft: Draft = {
      titleKo: detail.titleKo, titleEn: detail.titleEn, descriptionKo: detail.descriptionKo, descriptionEn: detail.descriptionEn,
      startsAt: localValue(detail.startsAt), endsAt: localValue(detail.endsAt), academicStatuses: detail.academicStatuses,
      quorumPercent: detail.quorumPercent ?? 50, quorumInclusive: detail.quorumInclusive,
      feePayersOnly: detail.feePayersOnly, studentNumberFrom: detail.studentNumberFrom, studentNumberTo: detail.studentNumberTo,
      items: detail.items.map(({ id, titleKo, titleEn, descriptionKo, descriptionEn, type, maxSelections, options }) => ({ id, titleKo, titleEn, descriptionKo, descriptionEn, type, maxSelections, options: options.map(({ id, labelKo, labelEn, descriptionKo, descriptionEn, imageUrl }) => ({ id, labelKo, labelEn, descriptionKo, descriptionEn, imageUrl })) })),
    };
    draftRef.current = nextDraft; setDraftState(nextDraft); history.current = []; future.current = [];
    voteIdRef.current = voteId;
    setDirty(false);
    setVoters(await client.listVoteVoters(voteId));
  };
  useEffect(() => { if (id && ownCreatedId.current !== id) void load(id).catch(() => toast({ type: "error", message: "투표를 불러오지 못했습니다." })); }, [id]);
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
  const setOptionImage = (itemIndex: number, optionIndex: number, imageUrl: string | null) => setDraft((current) => ({
    ...current,
    items: current.items.map((item, index) => index !== itemIndex ? item : ({
      ...item,
      options: item.options.map((option, idx) => idx === optionIndex ? { ...option, imageUrl } : option),
    })),
  }));
  const handleOptionImageChange = async (event: ChangeEvent<HTMLInputElement>, itemIndex: number, optionIndex: number) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ type: "error", message: "이미지 파일만 등록할 수 있습니다." });
      return;
    }
    const optionId = draftRef.current.items[itemIndex]?.options[optionIndex]?.id ?? `${itemIndex}-${optionIndex}`;
    setUploadingOptionId(optionId);
    try {
      const asset = await client.uploadAsset(file);
      setOptionImage(itemIndex, optionIndex, asset.storageKey);
    } catch {
      toast({ type: "error", message: "이미지를 업로드하지 못했습니다." });
    } finally {
      setUploadingOptionId(null);
    }
  };
  const agendaSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const handleAgendaDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    const fromIndex = draftRef.current.items.findIndex((item, index) => String(item.id ?? `agenda-${index}`) === activeId);
    const toIndex = draftRef.current.items.findIndex((item, index) => String(item.id ?? `agenda-${index}`) === overId);
    if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return;
    setDraft((current) => ({ ...current, items: arrayMove(current.items, fromIndex, toIndex) }));
  };

  const payload = (): CreateVoteRequest => {
    const value = draftRef.current;
    const body = {
      ...value, titleKo: value.titleKo.trim() || "제목 없는 투표",
      startsAt: scheduleIso(value.startsAt), endsAt: scheduleIso(value.endsAt),
      titleEn: koreanRef.current ? null : value.titleEn || null,
      descriptionKo: value.descriptionKo || null, descriptionEn: koreanRef.current ? null : value.descriptionEn || null,
      items: value.items.map((item, index) => ({...item, titleKo:item.titleKo.trim() || `안건 ${index+1}`,
        titleEn:koreanRef.current ? null : item.titleEn || null,
        descriptionEn:koreanRef.current ? null : item.descriptionEn || null,
        options:item.options.map((option, i)=>({...option,labelKo:option.labelKo.trim() || `옵션 ${i+1}`,labelEn:koreanRef.current ? null : option.labelEn || null}))
      }))
    };
    return CreateVoteSchema.parse(body);
  };
  const creation = useRef<Promise<string> | null>(null);
  const savedPayload = useRef<string | null>(null);
  const saveQueue = useRef<Promise<void> | null>(null);
  const ensureStored = async (): Promise<string> => {
    if (voteIdRef.current) return voteIdRef.current;
    if (creation.current) return creation.current;
    creation.current = (async () => {
      const body = payload();
      const created = await client.createVote(body);
      voteIdRef.current = created.id; ownCreatedId.current = created.id;
      savedPayload.current = JSON.stringify(body); setVote(created);
      navigate(`/admin/votes/${created.id}`, {replace:true});
      return created.id;
    })().finally(() => { creation.current = null; });
    return creation.current;
  };
  const save = async (): Promise<void> => {
    const task = (saveQueue.current ?? Promise.resolve()).catch(() => undefined).then(async () => {
      const voteId = await ensureStored();
      while (true) {
        const body = payload(); const snapshot = JSON.stringify(body);
        if (snapshot === savedPayload.current) { setDirty(false); break; }
        const updated = await client.updateVote(voteId, body);
        savedPayload.current = snapshot; setVote(updated);
        if (JSON.stringify(payload()) === snapshot) { setDirty(false); break; }
      }
    });
    saveQueue.current = task;
    try { await task; } finally { if (saveQueue.current === task) saveQueue.current = null; }
  };
  const saveLatest = useRef(save); saveLatest.current = save;
  const saveErrorShown = useRef(false);
  useEffect(() => {
    if (!dirty || (vote && vote.status !== "DRAFT")) return;
    const timer = setTimeout(() => {
      void saveLatest.current().then(() => { saveErrorShown.current = false; }).catch(() => {
        if (!saveErrorShown.current) toast({type:"error",message:"자동 저장하지 못했습니다. 입력한 기간과 값을 확인해 주세요."});
        saveErrorShown.current = true;
      });
    }, 700);
    return () => clearTimeout(timer);
  }, [draft, koreanOnly, dirty]);
  useEffect(() => {
    const leave = (event: BeforeUnloadEvent) => { if (dirty) { event.preventDefault(); } };
    window.addEventListener("beforeunload",leave);
    return () => window.removeEventListener("beforeunload",leave);
  }, [dirty]);

  const run = async (label: string, action: () => Promise<unknown>) => {
    let voteId = voteIdRef.current;
    try { if (!vote || vote.status === "DRAFT") { await save(); voteId = voteIdRef.current; } } catch { toast({type:"error",message:"저장하지 못했습니다. 입력한 기간과 값을 확인해 주세요."}); return; }
    if (!voteId || !await confirm({ title: label === "마감" ? "투표 마감" : label === "개표" ? "투표 개표" : label === "게시" ? "투표 게시" : label, description: label === "게시" ? "업로드·추가한 선거인명부가 확정되고 투표 안건 편집이 잠깁니다. 투표를 게시하시겠습니까?" : label === "마감" ? "투표를 즉시 마감하여 더 이상 참여할 수 없게 됩니다. 제출된 투표는 유지되며, 개표와 결과 공개는 별도로 진행합니다. 정말 마감하시겠습니까?" : label === "개표" ? "마감된 투표함을 개표하여 안건별 득표 수를 집계합니다. 결과는 아직 참여자에게 공개되지 않습니다. 정말 개표하시겠습니까?" : label === "결과 비공개 전환" ? "결과 조회를 중단합니다. 이미 열람하거나 내려받은 결과는 회수할 수 없습니다. 비공개로 전환하시겠습니까?" : "집계된 결과를 사용자에게 공개합니다. 결과를 공개하시겠습니까?", confirmLabel: label })) return;
    setBusy(true);
    try { await action(); await load(voteId); toast({ type: "success", message: `${label}했습니다.` }); }
    catch { toast({ type: "error", message: `${label}하지 못했습니다.` }); }
    finally { setBusy(false); }
  };

  const searchCandidates = async () => {
    try {
      const rows = await client.searchUsers(candidateQuery, 30);
      setCandidates(rows.filter((user) => /전산|computer|computing/i.test(user.primaryMajor ?? "")));
    } catch {
      setCandidates([]);
      toast({ type: "error", message: "회원을 검색하지 못했습니다." });
    }
  };
  const addCandidate = async (userId: string) => { try { const voteId = await ensureStored(); await client.addVoteVoters(voteId, { userIds: [userId] }); setVoters(await client.listVoteVoters(voteId)); setAddingVoter(false); setCandidateQuery(""); setCandidates([]); toast({type:"success",message:"명부에 추가했습니다."}); } catch { toast({type:"error",message:"추가하지 못했습니다."}); } };
  const importXlsx = async (event: ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files?.[0]) return;
    try {
      const workbook = XLSX.read(await event.target.files[0].arrayBuffer(), { type: "array" });
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[workbook.SheetNames[0]], { defval: "" });
      const key = Object.keys(rows[0] ?? {}).find(key => ["학번", "stdno", "studentnumber", "student_number"].includes(key.trim().toLowerCase()));
      if (!key) throw new Error("학번 열을 찾지 못했습니다.");
      const numbers = [...new Set(rows.map(row => String(row[key]).trim()).filter(Boolean))];
      if (!numbers.length || numbers.some(number => !/^\d{6,12}$/.test(number))) throw new Error("학번을 확인해 주세요.");
      const voteId = await ensureStored();
      const result = await client.addVoteVoters(voteId, { studentNumbers: numbers });
      setVoters(await client.listVoteVoters(voteId)); toast({ type: "success", message: `${result.added}명을 명부에 반영했습니다.` });
    } catch { toast({ type: "error", message: "명부를 불러오지 못했습니다. 학번 열과 등록된 주전공 계정을 확인하세요." }); }
    finally { event.target.value = ""; }

  };
  const effectiveVoters = voters;
  const [rosterPage, setRosterPage] = useState(1);
  const [rosterPageSize, setRosterPageSize] = useState(20);
  const [addingVoter, setAddingVoter] = useState(false);
  const exportRoster = () => {
    const sheet = XLSX.utils.json_to_sheet(effectiveVoters.map(voter => ({ 학번: voter.studentNumber, 이름: voter.nameKo, 참여: voter.hasVoted ? "참여완료" : "미참여", 상태: voter.status, "투표 일시": formatVotedTime(voter.votedAt) })));
    const workbook = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(workbook, sheet, "선거인명부"); XLSX.writeFile(workbook, "선거인명부.xlsx");
  };
  const exportResults = async () => {
    if (!id) return;
    try { const results = await client.getVoteResults(id); const workbook = XLSX.utils.book_new(); const rows = results.items.flatMap(item => item.options.map(option => ({ 안건: item.titleKo, 선택지: option.labelKo, 득표: option.count, 비율: option.percentage })));
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), "개표 결과"); XLSX.writeFile(workbook, "투표 결과.xlsx");
    } catch { toast({ type: "error", message: "결과를 내려받지 못했습니다." }); }
  };
  const visibleVoters = effectiveVoters.filter((voter) => `${voter.nameKo} ${voter.studentNumber ?? ""} ${voter.email}`.toLowerCase().includes(voterQuery.toLowerCase()));
  const quorumMet = !!vote && meetsVoteQuorum(vote.eligibleCount, vote.votedCount, vote.quorumPercent, vote.quorumInclusive);
  const editable = !vote || vote.status === "DRAFT";
  const rosterEditable = !vote || vote.status === "DRAFT";

  return (
    <AuthGuard requirePermission={Permissions.MANAGE_VOTE}>
      <AdminPageShell><AdminPageMain className="admin-vote-editor">
        <div className="admin-vote-editor__header sticky top-0 z-40 -mx-4 bg-[#f7f9fc]/95 px-4 pt-1 backdrop-blur sm:-mx-5 sm:px-5 md:-mx-8 md:px-8 xl:-mx-10 xl:px-10">
          <AdminPageHeader eyebrow={<EditorBackButton to="/admin/votes" beforeLeave={() => dirty ? save() : Promise.resolve()} />} title={<span className="flex flex-wrap items-center gap-3"><span>{draft.titleKo || "제목 없는 투표"}</span>{vote && vote.status !== "DRAFT" && <VoteStatusBadge status={vote.status} startsAt={vote.startsAt} endsAt={vote.endsAt} />}</span>} actions={<>
            <IconButton aria-label="실행 취소" disabled={!editable || !history.current.length} onClick={() => restore("undo")}><Undo2 className="size-4" /></IconButton>
            <IconButton aria-label="다시 실행" disabled={!editable || !future.current.length} onClick={() => restore("redo")}><Redo2 className="size-4" /></IconButton>
            <IconButton aria-label="링크 복사" className="border-0 text-slate-600" onClick={() => void ensureStored().then(voteId => navigator.clipboard.writeText(`${window.location.origin}/votes/${voteId}`)).then(()=>toast({type:"success",message:"투표 링크를 복사했습니다."})).catch(()=>toast({type:"error",message:"링크를 복사하지 못했습니다."}))}><Link2 className="size-5" /></IconButton>
            <IconButton aria-label="미리보기" className="border-0 text-slate-600" onClick={() => { const tab=window.open("about:blank","_blank"); if(tab)tab.opener=null; void (editable ? save() : Promise.resolve()).then(()=>{if(tab)tab.location.href=`/votes/${voteIdRef.current}?preview=1`;}).catch(()=>{tab?.close();toast({type:"error",message:"미리보기를 열지 못했습니다."});}); }}><Eye className="size-5" /></IconButton>
            <DropdownMenu.Root modal={false}><DropdownMenu.Trigger asChild><IconButton aria-label="투표 더보기"><MoreVertical className="size-5" /></IconButton></DropdownMenu.Trigger><DropdownMenu.Portal><DropdownMenu.Content align="end" sideOffset={6} className="z-[100] w-44 rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
              <DropdownMenu.Item disabled={busy} className="flex cursor-pointer items-center gap-2 rounded px-3 py-2 text-sm outline-none focus:bg-slate-100" onSelect={() => void (async()=>{try{if(editable)await save();const body=payload();const copy=await client.createVote({...body,titleKo:`${body.titleKo} 사본`,items:body.items.map(item=>({...item,id:uid(),options:item.options.map(option=>({...option,id:uid()}))}))});navigate(`/admin/votes/${copy.id}`);}catch{toast({type:"error",message:"사본을 만들지 못했습니다."});}})()}><Copy className="size-4" />사본 만들기</DropdownMenu.Item>
              {editable && <DropdownMenu.Item disabled={busy} className="flex cursor-pointer items-center gap-2 rounded px-3 py-2 text-sm text-rose-600 outline-none focus:bg-rose-50" onSelect={() => void (async()=>{if(!await confirm({title:"투표 삭제",description:"이 투표와 선거인명부를 삭제하시겠습니까?",confirmLabel:"삭제"}))return;setBusy(true);try{await save();await client.deleteVote(voteIdRef.current!);setDirty(false);navigate("/admin/votes");}catch{toast({type:"error",message:"투표를 삭제하지 못했습니다."});}finally{setBusy(false);}})()}><Trash2 className="size-4" />삭제</DropdownMenu.Item>}
            </DropdownMenu.Content></DropdownMenu.Portal></DropdownMenu.Root>
            {editable ? <Button onClick={() => void run("게시", () => client.publishVote(voteIdRef.current!))} disabled={busy}>게시</Button> : null}
            {vote?.status === "PUBLISHED" && clock < isoToMs(vote.endsAt) ? <Button onClick={() => void run("마감", () => client.closeVote(voteIdRef.current!))} disabled={busy}>투표 조기 마감</Button> : null}
            {(vote?.status === "CLOSED" || (vote?.status === "PUBLISHED" && clock >= isoToMs(vote.endsAt))) ? <Button onClick={() => void run("개표", async () => { if (vote.status === "PUBLISHED") await client.closeVote(voteIdRef.current!); return client.tallyVote(voteIdRef.current!); })} disabled={busy || !quorumMet}>개표</Button> : null}
            {vote?.status === "TALLIED" && !vote.resultsPublishedAt ? <Button onClick={() => void run("결과 공개", () => client.publishVoteResults(voteIdRef.current!))} disabled={busy}>결과 공개</Button> : null}
            {vote?.resultsPublishedAt ? <Button onClick={() => void run("결과 비공개 전환", () => client.unpublishVoteResults(voteIdRef.current!))} disabled={busy}>결과 비공개 전환</Button> : null}
          </>} />

        </div>

        <div className="flex flex-wrap gap-2" aria-label="투표 편집 영역">{([["questions", "안건"], ["voters", "선거인명부"], ["settings", "설정"], ["operations", "진행·개표"]] as const).map(([value, label]) => <button type="button" key={value} className={`min-h-11 border-b-2 px-4 text-sm transition-colors ${editorTab === value ? "border-emerald-600 font-semibold text-emerald-700" : "border-transparent text-slate-500 hover:text-slate-900"}`} aria-pressed={editorTab === value} onClick={() => setEditorTab(value)}>{label}</button>)}</div>
        {editorTab === "operations" ? <AdminCard>
          <div className="space-y-5 p-5">
            {vote ? <VoteProgress vote={vote} /> : <p className="text-sm text-slate-500">투표를 저장하면 진행 현황을 확인할 수 있습니다.</p>}
            {results ? <div className="flex gap-2"><Button variant="outline" onClick={()=>void exportResults()}>결과 엑셀 다운로드</Button><Button variant="outline" onClick={()=>window.print()}>인쇄</Button></div> : null}
            {results ? <div className="space-y-6 border-t border-slate-100 pt-5"><h2 className="font-semibold">{vote?.titleKo} 개표 결과</h2><p className="text-sm">총 {results.totalBallots}명 참여</p>{results.items.map(item => <section key={item.itemId} className="space-y-3"><h3 className="font-medium">{item.titleKo}</h3>{item.options.map(option => <div key={option.optionId}><div className="mb-1 flex justify-between gap-3 text-sm"><span>{option.labelKo}</span><span>{option.count}표 ({option.percentage.toFixed(1)}%)</span></div><div className="h-3 rounded-full bg-slate-100"><div className={`h-full rounded-full ${option.count > 0 && option.count === Math.max(...item.options.map(value => value.count)) ? "bg-emerald-500" : "bg-emerald-500"}`} style={{ width: `${Math.min(100, option.percentage)}%` }} /></div></div>)}</section>)}</div> : null}
          </div>
        </AdminCard> : null}
        <div className="vote-agenda-editor" hidden={editorTab !== "questions"}><AdminCard>
          <div className="grid gap-4 p-4 sm:p-5 md:grid-cols-2">
            <BuilderTextField plainText singleLine
              ariaLabel="투표 제목"
              inputClassName="!text-3xl !leading-tight !font-normal"
              placeholder="투표 제목"
              disabled={!editable}
              value={draft.titleKo}
              onChange={(value) => setDraft({ ...draft, titleKo: value })}
            />
            {!koreanOnly ? (
              <BuilderTextField plainText singleLine
                ariaLabel="영문 투표 제목"
                inputClassName="!text-3xl !leading-tight !font-normal"
                placeholder="Vote title"
                disabled={!editable}
                value={draft.titleEn ?? ""}
                onChange={(value) => setDraft({ ...draft, titleEn: value })}
              />
            ) : null}
            <BuilderTextField plainText
              ariaLabel="투표 설명"
              className="min-w-0"
              placeholder="투표 설명(선택사항)"
              disabled={!editable}
              value={draft.descriptionKo ?? ""}
              onChange={(value) => setDraft({ ...draft, descriptionKo: value })}
            />
            {!koreanOnly ? (
              <BuilderTextField plainText
                ariaLabel="영문 투표 설명"
                className="min-w-0"
                placeholder="Description (optional)"
                disabled={!editable}
                value={draft.descriptionEn ?? ""}
                onChange={(value) => setDraft({ ...draft, descriptionEn: value })}
              />
            ) : null}
          </div>
        </AdminCard></div>

        {editorTab === "settings" ? <AdminCard><div className="grid gap-5 p-6 md:grid-cols-2">            <label className="flex items-center gap-2 text-sm md:col-span-2"><input type="checkbox" disabled={!editable} checked={koreanOnly} onChange={e=>{remember();koreanRef.current=e.target.checked;setKoreanOnly(e.target.checked);setDirty(true);}} />한국어 전용</label>            <UiFormField label="시작 일시"><UiInput type="datetime-local" step="1" disabled={!editable} value={draft.startsAt} onChange={(e) => setDraft({ ...draft, startsAt: e.target.value })} /></UiFormField>
            <UiFormField label="종료 일시"><UiInput type="datetime-local" step="1" disabled={!editable} value={draft.endsAt} onChange={(e) => setDraft({ ...draft, endsAt: e.target.value })} /></UiFormField><UiFormField label="개표 정족수 (%)"><UiInput aria-label="개표 정족수 (%)" type="number" min={0} max={100} disabled={!editable} value={draft.quorumPercent} onChange={e=>setDraft({...draft,quorumPercent:Number(e.target.value)})} /></UiFormField><UiFormField label="기준"><AdminSelectDropdown ariaLabel="정족수 기준" disabled={!editable} value={draft.quorumInclusive ? "inclusive" : "exclusive"} onChange={value=>setDraft({...draft,quorumInclusive:value === "inclusive"})} options={[{value:"inclusive",label:"이상"},{value:"exclusive",label:"초과"}]} /></UiFormField></div></AdminCard> : null}
        <div className="vote-agenda-editor" hidden={editorTab !== "questions"}>
          <DndContext
            sensors={agendaSensors}
            collisionDetection={closestCenter}
            modifiers={[restrictListDrag]}
            autoScroll={false}
            onDragEnd={handleAgendaDragEnd}
          >
            <SortableContext
              items={draft.items.map((item, index) => String(item.id ?? `agenda-${index}`))}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-5">
                {draft.items.map((item, itemIndex) => {
                  const agendaId = String(item.id ?? `agenda-${itemIndex}`);
                  return (
                    <SortableVoteAgendaCard
                      key={agendaId}
                      id={agendaId}
                      index={itemIndex}
                      disabled={!editable}
                      trailing={(
                        <AdminSelectDropdown
                          ariaLabel={`안건 ${itemIndex + 1} 유형`}
                          disabled={!editable}
                          value={item.type}
                          onChange={(value) => changeType(itemIndex, value as VoteItemType)}
                          options={[
                            { value: "YES_NO_ABSTAIN", label: "찬성·반대·기권" },
                            { value: "SINGLE_CHOICE", label: "단일 선택 (1인 1표)" },
                            { value: "MULTIPLE_CHOICE", label: "복수 선택" },
                          ]}
                          className="w-full max-w-[14rem] shrink-0"
                          buttonClassName="!h-9 !text-sm"
                        />
                      )}
                    >
                      <div className="grid gap-3 md:grid-cols-2">
                        <BuilderTextField plainText singleLine
                          ariaLabel={`안건 ${itemIndex + 1} 국문 제목`}
                          placeholder={`안건 ${itemIndex + 1}`}
                          disabled={!editable}
                          value={item.titleKo}
                          onChange={(value) => setItem(itemIndex, { titleKo: value })}
                        />
                        {!koreanOnly ? (
                          <BuilderTextField plainText singleLine
                            ariaLabel={`안건 ${itemIndex + 1} 영문 제목`}
                            placeholder="Agenda title"
                            disabled={!editable}
                            value={item.titleEn ?? ""}
                            onChange={(value) => setItem(itemIndex, { titleEn: value })}
                          />
                        ) : null}
                        <BuilderTextField plainText
                          ariaLabel={`안건 ${itemIndex + 1} 설명`}
                          placeholder="안건 설명(선택사항)"
                          disabled={!editable}
                          value={item.descriptionKo ?? ""}
                          onChange={(value) => setItem(itemIndex, { descriptionKo: value })}
                        />
                        {!koreanOnly ? (
                          <BuilderTextField plainText
                            ariaLabel={`안건 ${itemIndex + 1} 영문 설명`}
                            placeholder="Description (optional)"
                            disabled={!editable}
                            value={item.descriptionEn ?? ""}
                            onChange={(value) => setItem(itemIndex, { descriptionEn: value })}
                          />
                        ) : null}
                      </div>

                      {item.type !== "YES_NO_ABSTAIN" && <div className="mt-5 space-y-2">
                          {item.options.map((option, optionIndex) => {
                            const optionId = option.id ?? `${itemIndex}-${optionIndex}`;
                            const inputId = `vote-option-image-${agendaId}-${optionIndex}`;
                            const uploading = uploadingOptionId === optionId;
                            return (
                              <div key={option.id ?? optionIndex} className="group min-w-0 rounded-lg px-1 py-1 transition-colors hover:bg-slate-50/70 focus-within:bg-slate-50/70">
                                <div className="flex min-w-0 items-center gap-2">
                                  <span aria-hidden="true" className={`size-5 shrink-0 border border-slate-300 bg-white ${item.type === "SINGLE_CHOICE" ? "rounded-full" : "rounded"}`} />
                                  <div className="flex min-w-0 flex-1 items-center gap-2">
                                    <BuilderTextField plainText singleLine
                                      className="min-w-0 flex-1"
                                      ariaLabel={`옵션 ${optionIndex + 1} 국문`}
                                      placeholder={`옵션 ${optionIndex + 1}`}
                                      disabled={!editable}
                                      value={option.labelKo}
                                      onChange={(value) => setOption(itemIndex, optionIndex, value)}
                                    />
                                    {!koreanOnly ? (
                                      <>
                                      <BuilderTextField plainText singleLine
                                        ariaLabel={`옵션 ${optionIndex + 1} 영문`}
                                        placeholder={`Option ${optionIndex + 1}`}
                                        className="min-w-0 flex-1"
                                        disabled={!editable}
                                        value={option.labelEn ?? ""}
                                        onChange={(text) => setItem(itemIndex, { options: item.options.map((value, i) => i === optionIndex ? { ...value, labelEn: text } : value) })}
                                      /></>
                                    ) : null}
                                  </div>
                                  {editable ? (
                                    <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 focus-within:opacity-100">
                                      <input
                                        id={inputId}
                                        type="file"
                                        accept="image/*"
                                        className="sr-only"
                                        tabIndex={-1}
                                        aria-hidden="true"
                                        disabled={uploading}
                                        onChange={(event) => void handleOptionImageChange(event, itemIndex, optionIndex)}
                                      />
                                      <IconButton
                                        size="sm"
                                        aria-label={`옵션 ${optionIndex + 1} 이미지 ${option.imageUrl ? "변경" : "추가"}`}
                                        aria-busy={uploading}
                                        disabled={uploading}
                                        onClick={() => document.getElementById(inputId)?.click()}
                                      >
                                        {uploading ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
                                      </IconButton>
                                    </div>
                                  ) : null}
                                  {editable ? (
                                    <IconButton
                                      size="sm"
                                      aria-label={`옵션 ${optionIndex + 1} 삭제`}
                                      data-tooltip="옵션 삭제"
                                      disabled={item.options.length <= 2}
                                      onClick={() => setItem(itemIndex, { options: item.options.filter((_, i) => i !== optionIndex), maxSelections: Math.min(item.maxSelections, item.options.length - 1) })}
                                    >
                                      <X className="size-4" />
                                    </IconButton>
                                  ) : null}
                                </div>
                                {option.imageUrl ? (
                                  <div className="ml-7 mt-2 flex w-fit items-center gap-2">
                                    <img src={resolveAssetUrl(option.imageUrl)} alt={`옵션 ${optionIndex + 1} 이미지`} className="size-12 rounded-md border border-slate-200 object-cover" />
                                    {editable ? (
                                      <IconButton size="sm" aria-label={`옵션 ${optionIndex + 1} 이미지 제거`} data-tooltip="파일 삭제" onClick={() => setOptionImage(itemIndex, optionIndex, null)}>
                                        <X className="size-4" />
                                      </IconButton>
                                    ) : null}
                                  </div>
                                ) : null}
                              </div>
                            );
                          })}
                          {editable ? (
                            <div className="flex items-center gap-2 px-1"><span aria-hidden="true" className={`size-5 shrink-0 border border-slate-300 ${item.type === "SINGLE_CHOICE" ? "rounded-full" : "rounded"}`} /><BuilderOptionAdd onAdd={() => setItem(itemIndex, { options: [...item.options, { id: uid(), labelKo: "", labelEn: null }] })} /></div>
                          ) : null}
                          {item.type === "MULTIPLE_CHOICE" && <BuilderRuleRow>
                            {item.type === "MULTIPLE_CHOICE" ? (
                              <>
                                <span className="w-40 text-sm text-slate-700">최대 선택 개수</span>
                                <UiInput
                                  aria-label={`안건 ${itemIndex + 1} 최대 선택 수`}
                                  type="number"
                                  min={1}
                                  max={item.options.length}
                                  disabled={!editable}
                                  value={item.maxSelections}
                                  onChange={(e) => setItem(itemIndex, { maxSelections: Number(e.target.value) })}
                                  className="builder-text-control !h-9 w-20 px-2 text-left"
                                />

                              </>
                            ) : null}
                          </BuilderRuleRow>}
                      </div>}

                      {editable ? (
                        <div className="mt-5 flex justify-end gap-1 border-t border-slate-100 pt-3">
                          <IconButton aria-label={`안건 ${itemIndex + 1} 복제`} data-tooltip="안건 복제" onClick={() => setDraft({ ...draft, items: [...draft.items.slice(0, itemIndex + 1), { ...item, id: uid(), options: item.options.map((option) => ({ ...option, id: uid() })) }, ...draft.items.slice(itemIndex + 1)] })}>
                            <Copy className="size-4" />
                          </IconButton>
                          <IconButton aria-label={`안건 ${itemIndex + 1} 삭제`} data-tooltip="안건 삭제" disabled={draft.items.length <= 1} onClick={() => setDraft({ ...draft, items: draft.items.filter((_, i) => i !== itemIndex) })}>
                            <Trash2 className="size-4" />
                          </IconButton>
                        </div>
                      ) : null}
                    </SortableVoteAgendaCard>
                  );
                })}
              </div>
            </SortableContext>
          </DndContext>
          {editable ? (
            <div className="mt-4 flex justify-end">
              <Button onClick={() => setDraft({ ...draft, items: [...draft.items, newItem()] })}>
                <Plus className="size-4" />
                안건 추가
              </Button>
            </div>
          ) : null}
        </div>

        {editorTab === "voters" ? <AdminCard>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5">
            <UiInput className="w-full max-w-xs md:ml-auto" placeholder="학번 또는 이름 검색" value={voterQuery} onChange={e=>{setVoterQuery(e.target.value);setRosterPage(1);}} />
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={exportRoster}><Download />내보내기</Button>
              {rosterEditable ? <>
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm"><Upload className="size-4" />엑셀 업로드<input className="hidden" type="file" accept=".xlsx,.xls" onChange={e=>void importXlsx(e)} /></label>
                <Button variant="outline" onClick={()=>setAddingVoter(true)}><UserPlus />수동 추가</Button>
              </> : null}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="bg-slate-50">
                <tr>{["학번","이름","투표 상태","투표 일시",...(rosterEditable?["관리"]:[])].map(label=><th key={label} className="px-5 py-3 font-medium">{label}</th>)}</tr>
              </thead>
              <tbody>
                {visibleVoters.length === 0 ? (
                  <tr><td colSpan={rosterEditable ? 5 : 4} className="px-5 py-16 text-center text-sm font-normal text-slate-400">{effectiveVoters.length === 0 ? "등록된 선거인명부가 없습니다." : "검색 결과가 없습니다."}</td></tr>
                ) : visibleVoters.slice((rosterPage-1)*rosterPageSize,rosterPage*rosterPageSize).map(voter=><tr key={voter.userId} className="border-t border-slate-100">
                  <td className="px-5 py-3">{voter.studentNumber}</td>
                  <td className="px-5 py-3">{voter.nameKo}</td>
                  <td className="px-5 py-3">{voter.status ? <AdminStatusBadge tone={voter.status === "EXCLUDED" ? "danger" : voter.hasVoted ? "positive" : "neutral"}>{voter.status === "EXCLUDED" ? "제외" : voter.hasVoted ? "참여완료" : "미참여"}</AdminStatusBadge> : null}</td>
                  <td className="px-5 py-3">{formatVotedTime(voter.votedAt)}</td>
                  {rosterEditable ? <td className="px-5 py-3"><Button variant="ghost" size="sm" onClick={async()=>{try{if(voter.status === "EXCLUDED") await client.addVoteVoters(id!,{userIds:[voter.userId]});else await client.excludeVoteVoters(id!,[voter.userId]);setVoters(await client.listVoteVoters(id!));}catch{toast({type:"error",message:"명부를 수정하지 못했습니다."});}}}>{voter.status === "EXCLUDED" ? "복원" : "제외"}</Button></td> : null}
                </tr>)}
              </tbody>
            </table>
          </div>
          {visibleVoters.length > 0 ? <div className="border-t border-slate-100 px-5 py-3 sm:px-6">
            <Pagination className="m-0 w-full" currentPage={rosterPage} totalPages={Math.max(1,Math.ceil(visibleVoters.length/rosterPageSize))} onPageChange={setRosterPage} range={`총 ${visibleVoters.length}명`} pageSizeControl={<PageSizeSelect value={rosterPageSize} onChange={value=>{setRosterPageSize(value);setRosterPage(1);}} />} />
          </div> : null}
        </AdminCard> : null}

        <Modal
          open={addingVoter && rosterEditable}
          onClose={() => { setAddingVoter(false); setCandidateQuery(""); setCandidates([]); }}
          title="선거인 수동 추가"
          className="max-w-lg"
          bodyClassName="space-y-4"
          footer={<Button variant="outline" onClick={() => { setAddingVoter(false); setCandidateQuery(""); setCandidates([]); }}>취소</Button>}
        >
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700" htmlFor="vote-voter-search">학번 또는 이름 검색</label>
            <div className="flex gap-2">
              <UiInput id="vote-voter-search" className="min-w-0 flex-1" autoFocus placeholder="학번, 이름, 이메일" value={candidateQuery} onChange={e=>setCandidateQuery(e.target.value)} onKeyDown={e=>{if(e.key === "Enter") { e.preventDefault(); void searchCandidates(); }}} />
              <Button variant="outline" onClick={()=>void searchCandidates()}>검색</Button>
            </div>
          </div>
          <div className="space-y-2" aria-live="polite">
            {candidates.map(candidate=><button type="button" key={candidate.userId} className="flex min-h-12 w-full items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 text-left transition-colors hover:border-brand-primary/40 hover:bg-emerald-50/40" onClick={()=>void addCandidate(candidate.userId)}><span className="min-w-0 truncate font-medium text-slate-800">{candidate.nameKo}</span><span className="shrink-0 text-sm text-slate-500">{candidate.stdNo ?? "학번 없음"}</span></button>)}
            {candidateQuery.trim() && candidates.length === 0 ? <p className="py-5 text-center text-sm text-slate-400">검색 결과가 없습니다.</p> : <p className="text-xs text-slate-400">검색 결과에서 추가할 회원을 선택하세요.</p>}
          </div>
        </Modal>

      </AdminPageMain></AdminPageShell>
      {ConfirmDialog}
    </AuthGuard>
  );
}
