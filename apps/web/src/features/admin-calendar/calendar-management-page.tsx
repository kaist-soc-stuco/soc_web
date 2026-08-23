import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { createApiClient } from "@soc/api-client";
import type {
  CalendarEventCategory,
  CalendarEventCreateRequest,
  CalendarEventRecord,
} from "@soc/contracts";
import {
  htmlDatetimeLocalToIso,
  isoToDate,
  isoToHtmlDatetimeLocal,
  msToIso,
  nowMs,
} from "@soc/shared";
import {
  CalendarDays,
  Download,
  FileUp,
  Plus,
  RefreshCw,
  Save,
} from "lucide-react";

import { AuthGuard } from "@/components/guards/auth-guard";
import {
  AdminDataTable,
  AdminSortableHead,
  AdminTableBody,
  AdminTableCell,
  AdminTableEmpty,
  AdminTableHead,
  AdminTableHeader,
} from "@/components/ui/admin-data-table";
import { AdminDrawer } from "@/components/ui/admin-drawer";
import {
  AdminFormField,
  AdminPageHeader,
  AdminPageMain,
  AdminPageShell,
  AdminTableCard,
} from "@/components/ui/admin-page";
import { AdminSelectDropdown } from "@/components/ui/admin-select";
import { Button } from "@/components/ui/button";
import { UiInput, UiTextarea } from "@/components/ui/form-control";
import { PageSizeSelect, Pagination } from "@/components/ui/pagination";
import { PageSearchField } from "@/components/ui/page-layout";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { TableSkeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { resolveApiBaseUrl } from "@/lib/api-base-url";
import { downloadBlob } from "@/lib/download-blob";
import { formatNumericDateRange } from "@/lib/date-display";
import { Permissions } from "@/lib/permissions";

const QUERY_KEY = ["admin", "calendar-events"] as const;
type SourceFilter = "all" | "MANUAL" | "KAIST_ACADEMIC";
type CategoryFilter = "all" | CalendarEventCategory;
type VisibilityFilter = "all" | "visible" | "hidden";
type CategoryDraft = CalendarEventCategory;

interface EventDraft {
  titleKo: string;
  titleEn: string;
  descriptionKo: string;
  descriptionEn: string;
  startAt: string;
  endAt: string;
  location: string;
  category: CategoryDraft;
  visibility: "visible" | "hidden";
}

const emptyDraft = (): EventDraft => {
  const start = msToIso(nowMs());
  const end = msToIso(nowMs() + 60 * 60 * 1000);
  return {
    titleKo: "",
    titleEn: "",
    descriptionKo: "",
    descriptionEn: "",
    startAt: isoToHtmlDatetimeLocal(start),
    endAt: isoToHtmlDatetimeLocal(end),
    location: "",
    category: "EVENT",
    visibility: "visible",
  };
};

const draftFromEvent = (event: CalendarEventRecord): EventDraft => ({
  titleKo: event.titleKo,
  titleEn: event.titleEn ?? "",
  descriptionKo: event.descriptionKo ?? "",
  descriptionEn: event.descriptionEn ?? "",
  startAt: isoToHtmlDatetimeLocal(event.startAt),
  endAt: isoToHtmlDatetimeLocal(event.endAt),
  location: event.location ?? "",
  category: event.categoryOverride ?? event.category,
  visibility: event.isHiddenByAdmin ? "hidden" : "visible",
});

const categoryLabel: Record<CalendarEventCategory, string> = {
  EVENT: "행사",
  ACADEMIC: "학사일정",
  HOLIDAY: "공휴일",
};

function formatPeriod(event: CalendarEventRecord) {
  return formatNumericDateRange(event.startAt, event.endAt, {
    includeTime: event.sourceType === "MANUAL",
  });
}

export function CalendarManagementPage() {
  return (
    <AuthGuard requirePermission={Permissions.MANAGE_CONTENT}>
      <CalendarManagementContent />
    </AuthGuard>
  );
}

function CalendarManagementContent() {
  const apiClient = useMemo(
    () => createApiClient({ baseUrl: resolveApiBaseUrl() }),
    [],
  );
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const openedQueryEventRef = useRef<string | null>(null);
  const [query, setQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [visibilityFilter, setVisibilityFilter] = useState<VisibilityFilter>("all");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEventRecord | null>(null);
  const [draft, setDraft] = useState<EventDraft>(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState<"kaist" | "google" | null>(null);

  const eventsQuery = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => apiClient.getManagedCalendarEvents(),
  });
  const events = eventsQuery.data?.items ?? [];

  const filteredEvents = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return events
      .filter((event) => sourceFilter === "all" || event.sourceType === sourceFilter)
      .filter((event) => categoryFilter === "all" || event.category === categoryFilter)
      .filter((event) => visibilityFilter === "all" || (visibilityFilter === "hidden") === event.isHiddenByAdmin)
      .filter((event) => !normalized || [event.titleKo, event.titleEn ?? "", event.location ?? ""].some((value) => value.toLocaleLowerCase().includes(normalized)))
      .sort((a, b) => {
        const direction = sortDirection === "asc" ? 1 : -1;
        return a.startAt.localeCompare(b.startAt) * direction || a.titleKo.localeCompare(b.titleKo, "ko") * direction;
      });
  }, [categoryFilter, events, query, sortDirection, sourceFilter, visibilityFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredEvents.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageItems = filteredEvents.slice((safePage - 1) * pageSize, safePage * pageSize);
  const rangeStart = filteredEvents.length ? (safePage - 1) * pageSize + 1 : 0;
  const rangeEnd = Math.min(filteredEvents.length, safePage * pageSize);
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
      queryClient.invalidateQueries({ queryKey: ["events-surveys", "calendar-events"] }),
      queryClient.invalidateQueries({ queryKey: ["calendar", "events"] }),
    ]);
  };

  const openCreate = () => {
    setEditingEvent(null);
    setDraft(emptyDraft());
    setDrawerOpen(true);
  };

  const openEdit = (event: CalendarEventRecord) => {
    setEditingEvent(event);
    setDraft(draftFromEvent(event));
    setDrawerOpen(true);
  };

  useEffect(() => {
    const eventId = searchParams.get("event");
    if (!eventId || openedQueryEventRef.current === eventId || events.length === 0) return;
    const target = events.find((event) => event.calendarEventId === eventId);
    if (!target) return;
    openedQueryEventRef.current = eventId;
    openEdit(target);
    setSearchParams({}, { replace: true });
  }, [events, searchParams, setSearchParams]);

  const saveEvent = async (formEvent: FormEvent<HTMLFormElement>) => {
    formEvent.preventDefault();
    setSaving(true);
    try {
      let saved: CalendarEventRecord;
      if (!editingEvent) {
        const payload: CalendarEventCreateRequest = {
          titleKo: draft.titleKo.trim(),
          titleEn: draft.titleEn.trim() || undefined,
          descriptionKo: draft.descriptionKo.trim() || undefined,
          descriptionEn: draft.descriptionEn.trim() || undefined,
          startAt: htmlDatetimeLocalToIso(draft.startAt),
          endAt: htmlDatetimeLocalToIso(draft.endAt),
          location: draft.location.trim() || undefined,
        };
        saved = await apiClient.createManualCalendarEvent(payload);
      } else if (!editingEvent.isReadOnly) {
        saved = await apiClient.updateManualCalendarEvent(editingEvent.calendarEventId, {
          titleKo: draft.titleKo.trim(),
          titleEn: draft.titleEn.trim() || undefined,
          descriptionKo: draft.descriptionKo.trim() || undefined,
          descriptionEn: draft.descriptionEn.trim() || undefined,
          startAt: htmlDatetimeLocalToIso(draft.startAt),
          endAt: htmlDatetimeLocalToIso(draft.endAt),
          location: draft.location.trim() || undefined,
        });
      } else {
        saved = editingEvent;
      }

      const presentationTarget = editingEvent ?? saved;
      await apiClient.updateCalendarEventPresentation(presentationTarget.calendarEventId, {
        categoryOverride: draft.category,
        isHiddenByAdmin: draft.visibility === "hidden",
      });
      setDrawerOpen(false);
      await refresh();
      toast({ message: editingEvent ? "일정을 수정했습니다." : "일정을 등록했습니다." });
    } catch {
      toast({ message: "일정을 저장하지 못했습니다." });
    } finally {
      setSaving(false);
    }
  };

  const importIcs = async (file: File) => {
    try {
      const result = await apiClient.importCalendarIcs(await file.text());
      await refresh();
      toast({ message: `${result.importedCount}개 일정을 가져왔습니다.` });
    } catch {
      toast({ message: "ICS 파일을 가져오지 못했습니다." });
    }
  };

  const exportIcs = async () => {
    try {
      const blob = await apiClient.exportCalendarIcs();
      downloadBlob(blob, "soc-calendar.ics");
    } catch {
      toast({ message: "캘린더를 내보내지 못했습니다." });
    }
  };

  const syncKaistCalendar = async () => {
    setSyncing("kaist");
    try {
      const result = await apiClient.syncKaistAcademicCalendar();
      await refresh();
      toast({
        message: `카이스트 동기화 완료 · 추가 ${result.insertedCount} · 수정 ${result.updatedCount}`,
      });
    } catch {
      toast({ message: "KAIST 일정을 동기화하지 못했습니다." });
    } finally {
      setSyncing(null);
    }
  };

  const syncGoogleCalendar = async () => {
    setSyncing("google");
    try {
      const result = await apiClient.syncGoogleCalendars();
      await refresh();
      toast({
        message: `구글 캘린더 동기화 완료 · 성공 ${result.succeededCount} · 실패 ${result.failedCount}`,
      });
    } catch {
      toast({ message: "Google Calendar를 동기화하지 못했습니다." });
    } finally {
      setSyncing(null);
    }
  };

  return (
    <AdminPageShell>
      <AdminPageMain>
        <AdminPageHeader
          title="일정 관리"
          actions={(
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept=".ics,text/calendar"
                className="sr-only"
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0];
                  event.currentTarget.value = "";
                  if (file) void importIcs(file);
                }}
              />
              <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                <FileUp className="size-4" aria-hidden="true" />
                ICS 불러오기
              </Button>
              <Button variant="outline" onClick={() => void exportIcs()}>
                <Download className="size-4" aria-hidden="true" />
                내보내기
              </Button>
              <Button variant="outline" disabled={syncing !== null} onClick={() => void syncKaistCalendar()}>
                <RefreshCw className={`size-4 ${syncing === "kaist" ? "animate-spin" : ""}`} aria-hidden="true" />
                카이스트 동기화
              </Button>
              <Button variant="outline" disabled={syncing !== null} onClick={() => void syncGoogleCalendar()}>
                <RefreshCw className={`size-4 ${syncing === "google" ? "animate-spin" : ""}`} aria-hidden="true" />
                구글 캘린더 동기화
              </Button>
              <Button onClick={openCreate}>
                <Plus className="size-4" aria-hidden="true" />
                일정 추가
              </Button>
            </>
          )}
        />

        <AdminTableCard
          toolbar={(
            <div className="px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <SegmentedControl<SourceFilter>
                  ariaLabel="일정 출처"
                  value={sourceFilter}
                  onChange={(value) => { setSourceFilter(value); setPage(1); }}
                  options={[
                    { value: "all", label: "전체" },
                    { value: "MANUAL", label: "학생회 일정" },
                    { value: "KAIST_ACADEMIC", label: "KAIST 원본" },
                  ]}
                />
                <div className="flex w-full flex-wrap items-center justify-end gap-2 md:w-auto">
                  <AdminSelectDropdown
                    ariaLabel="일정 분류"
                    value={categoryFilter}
                    onChange={(value) => { setCategoryFilter(value as CategoryFilter); setPage(1); }}
                    options={[
                      { value: "all", label: "전체 분류" },
                      { value: "EVENT", label: "행사" },
                      { value: "ACADEMIC", label: "학사일정" },
                      { value: "HOLIDAY", label: "공휴일" },
                    ]}
                    className="w-32"
                  />
                  <AdminSelectDropdown
                    ariaLabel="노출 상태"
                    value={visibilityFilter}
                    onChange={(value) => { setVisibilityFilter(value as VisibilityFilter); setPage(1); }}
                    options={[
                      { value: "all", label: "전체 노출" },
                      { value: "visible", label: "노출 중" },
                      { value: "hidden", label: "숨김" },
                    ]}
                    className="w-28"
                  />
                  <PageSearchField
                    ariaLabel="일정 검색"
                    value={query}
                    onChange={(value) => { setQuery(value); setPage(1); }}
                    onClear={() => { setQuery(""); setPage(1); }}
                    placeholder="제목·장소 검색"
                    className="w-full sm:w-72"
                  />
                </div>
              </div>
            </div>
          )}
          pagination={(
            <Pagination
              currentPage={safePage}
              totalPages={totalPages}
              onPageChange={setPage}
              pageSizeControl={<PageSizeSelect value={pageSize} onChange={(value) => { setPageSize(value); setPage(1); }} />}
              range={`전체 ${filteredEvents.length}건 중 ${rangeStart}-${rangeEnd}`}
            />
          )}
        >
          {eventsQuery.isPending ? (
            <TableSkeleton columns={4} rows={10} />
          ) : eventsQuery.isError ? (
            <div className="px-5 py-16 text-center text-sm font-normal text-rose-600">일정을 불러오지 못했습니다.</div>
          ) : (
            <AdminDataTable minWidth={760}>
              <colgroup>
                <col />
                <col style={{ width: 120 }} />
                <col style={{ width: 130 }} />
                <col style={{ width: 240 }} />
              </colgroup>
              <AdminTableHeader>
                <tr>
                  <AdminTableHead>제목</AdminTableHead>
                  <AdminTableHead>분류</AdminTableHead>
                  <AdminTableHead>출처</AdminTableHead>
                  <AdminSortableHead active ascending={sortDirection === "asc"} onClick={() => setSortDirection((value) => value === "asc" ? "desc" : "asc")}>기간</AdminSortableHead>
                </tr>
              </AdminTableHeader>
              <AdminTableBody>
                {pageItems.length === 0 ? <AdminTableEmpty colSpan={4}>조건에 맞는 일정이 없습니다.</AdminTableEmpty> : pageItems.map((event) => (
                  <tr
                    key={event.calendarEventId}
                    tabIndex={0}
                    aria-label={`${event.titleKo} 설정 열기`}
                    className={`cursor-pointer border-t border-slate-100 transition hover:bg-slate-50/70 focus-visible:bg-slate-50/70 ${event.isHiddenByAdmin ? "opacity-50" : ""}`}
                    onClick={() => openEdit(event)}
                    onKeyDown={(keyEvent) => {
                      if (keyEvent.key !== "Enter" && keyEvent.key !== " ") return;
                      keyEvent.preventDefault();
                      openEdit(event);
                    }}
                  >
                    <AdminTableCell truncate>
                      <span className="block max-w-full truncate text-left text-[14px] font-medium text-[#172033]">{event.titleKo}</span>
                      {event.googleSyncStatus === "FAILED" || event.googleSyncStatus === "CONFLICT" ? (
                        <p className="mt-1 truncate text-xs font-normal text-rose-600">Google 동기화 확인 필요</p>
                      ) : null}
                    </AdminTableCell>
                    <AdminTableCell><span className="text-[14px] font-normal text-[#344054]">{categoryLabel[event.category]}</span></AdminTableCell>
                    <AdminTableCell><span className="text-[14px] font-normal text-[#344054]">{event.sourceType === "KAIST_ACADEMIC" ? "KAIST 원본" : "학생회 일정"}</span></AdminTableCell>
                    <AdminTableCell><span className="text-[14px] font-normal text-[#344054]">{formatPeriod(event)}</span></AdminTableCell>
                  </tr>
                ))}
              </AdminTableBody>
            </AdminDataTable>
          )}
        </AdminTableCard>
      </AdminPageMain>

      <AdminDrawer
        open={drawerOpen}
        onClose={() => !saving && setDrawerOpen(false)}
        title={editingEvent ? "일정 설정" : "일정 추가"}
        footer={(
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDrawerOpen(false)} disabled={saving}>취소</Button>
            <Button type="submit" form="calendar-management-form" disabled={saving}>
              <Save className="size-4" aria-hidden="true" />
              {saving ? "저장 중" : "저장"}
            </Button>
          </div>
        )}
      >
        <form id="calendar-management-form" className="space-y-5" onSubmit={(event) => void saveEvent(event)}>
          {editingEvent?.isReadOnly ? (
            <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
              <CalendarDays className="mt-0.5 size-4 shrink-0 text-[#344054]" aria-hidden="true" />
              <p className="text-sm font-normal leading-5 text-[#344054]">KAIST 원본의 제목과 기간은 자동 동기화됩니다. 이 화면에서는 분류와 공개 여부만 변경할 수 있습니다.</p>
            </div>
          ) : null}
          <AdminFormField label="제목">
            <UiInput required value={draft.titleKo} disabled={editingEvent?.isReadOnly} onChange={(event) => setDraft((current) => ({ ...current, titleKo: event.currentTarget.value }))} />
          </AdminFormField>
          {!editingEvent?.isReadOnly ? (
            <>
              <AdminFormField label="영문 제목">
                <UiInput value={draft.titleEn} onChange={(event) => setDraft((current) => ({ ...current, titleEn: event.currentTarget.value }))} />
              </AdminFormField>
              <div className="grid gap-4 sm:grid-cols-2">
                <AdminFormField label="시작">
                  <UiInput required type="datetime-local" value={draft.startAt} onChange={(event) => setDraft((current) => ({ ...current, startAt: event.currentTarget.value }))} />
                </AdminFormField>
                <AdminFormField label="종료">
                  <UiInput required type="datetime-local" value={draft.endAt} onChange={(event) => setDraft((current) => ({ ...current, endAt: event.currentTarget.value }))} />
                </AdminFormField>
              </div>
              <AdminFormField label="장소">
                <UiInput value={draft.location} onChange={(event) => setDraft((current) => ({ ...current, location: event.currentTarget.value }))} />
              </AdminFormField>
              <AdminFormField label="설명">
                <UiTextarea rows={4} value={draft.descriptionKo} onChange={(event) => setDraft((current) => ({ ...current, descriptionKo: event.currentTarget.value }))} />
              </AdminFormField>
            </>
          ) : (
            <AdminFormField label="기간">
              <UiInput value={editingEvent ? formatPeriod(editingEvent) : ""} disabled />
            </AdminFormField>
          )}
          <AdminFormField label="분류">
            <AdminSelectDropdown
              ariaLabel="일정 분류"
              value={draft.category}
              onChange={(value) => setDraft((current) => ({ ...current, category: value as CategoryDraft }))}
              options={[
                { value: "EVENT", label: "행사" },
                { value: "ACADEMIC", label: "학사일정" },
                { value: "HOLIDAY", label: "공휴일" },
              ]}
            />
          </AdminFormField>
          <AdminFormField label="공개 상태">
            <SegmentedControl
              ariaLabel="일정 공개 상태"
              value={draft.visibility}
              onChange={(value) => setDraft((current) => ({ ...current, visibility: value }))}
              options={[
                { value: "visible", label: "노출" },
                { value: "hidden", label: "숨김" },
              ]}
            />
          </AdminFormField>
        </form>
      </AdminDrawer>
    </AdminPageShell>
  );
}
