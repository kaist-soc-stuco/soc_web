import { useMemo, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createApiClient } from "@soc/api-client";
import type { CalendarEventCreateRequest, CalendarEventRecord } from "@soc/contracts";
import {
  addMs,
  htmlDatetimeLocalToIso,
  isoToHtmlDatetimeLocal,
  msToIso,
  nowDate,
} from "@soc/shared";
import { CalendarDays, Download, FileUp, Pencil, Plus, RefreshCw, Save, Trash2 } from "lucide-react";

import { useCurrentSession } from "@/hooks/use-current-session";
import { useLanguage } from "@/hooks/use-language";
import { resolveApiBaseUrl } from "@/lib/api-base-url";
import { Permissions } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { AdminFormField } from "@/components/ui/admin-page";
import { UiInput, UiTextarea } from "@/components/ui/form-control";
import { Modal } from "@/components/ui/modal";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";
import { IconButton } from "@/components/ui/icon-button";

const QUERY_KEY = ["calendar", "manual-events"] as const;
const controlClassName =
  "min-h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition-[border-color,box-shadow] placeholder:text-slate-400 hover:border-slate-300 focus-visible:border-brand-primary focus-visible:ring-2 focus-visible:ring-brand-primary/20";
const actionClassName =
  "inline-flex min-h-9 items-center gap-1.5 rounded-md px-3 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-brand-primary";

interface EventForm {
  titleKo: string;
  titleEn: string;
  descriptionKo: string;
  descriptionEn: string;
  startAt: string;
  endAt: string;
  location: string;
}

function createEmptyForm(): EventForm {
  const start = nowDate();
  return {
    titleKo: "",
    titleEn: "",
    descriptionKo: "",
    descriptionEn: "",
    startAt: isoToHtmlDatetimeLocal(msToIso(start.valueOf())),
    endAt: isoToHtmlDatetimeLocal(msToIso(addMs(start.valueOf(), 1, "hour"))),
    location: "",
  };
}

function formFromRecord(event: CalendarEventRecord): EventForm {
  return {
    titleKo: event.titleKo,
    titleEn: event.titleEn ?? "",
    descriptionKo: event.descriptionKo ?? "",
    descriptionEn: event.descriptionEn ?? "",
    startAt: isoToHtmlDatetimeLocal(event.startAt),
    endAt: isoToHtmlDatetimeLocal(event.endAt),
    location: event.location ?? "",
  };
}

export function EventsSurveysCalendarManagement() {
  const { lang } = useLanguage();
  const { data: session } = useCurrentSession();
  const apiClient = useMemo(
    () => createApiClient({ baseUrl: resolveApiBaseUrl() }),
    [],
  );
  const queryClient = useQueryClient();
  const { confirm, ConfirmDialog } = useConfirmDialog();
  const [formOpen, setFormOpen] = useState(false);
  const [managementOpen, setManagementOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<EventForm>(createEmptyForm);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const canManage = Permissions.has(
    session?.permission ?? 0,
    Permissions.MANAGE_CONTENT,
  );

  const manualEventsQuery = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => apiClient.getManualCalendarEvents(),
    enabled: canManage,
  });

  if (!canManage) return null;

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
      queryClient.invalidateQueries({ queryKey: ["events-surveys", "calendar-events"] }),
    ]);
  };

  const startCreate = () => {
    setEditingId(null);
    setForm(createEmptyForm());
    setFormOpen(true);
    setMessage(null);
  };

  const startEdit = (event: CalendarEventRecord) => {
    setEditingId(event.calendarEventId);
    setForm(formFromRecord(event));
    setFormOpen(true);
    setMessage(null);
  };

  const closeForm = () => {
    setFormOpen(false);
  };

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.titleKo.trim() || !form.startAt || !form.endAt) {
      setMessage(
        lang === "ko"
          ? "제목과 시작·종료 시간을 입력해 주세요."
          : "Enter a title and start/end time.",
      );
      return;
    }

    const payload: CalendarEventCreateRequest = {
      titleKo: form.titleKo.trim(),
      titleEn: form.titleEn.trim() || undefined,
      descriptionKo: form.descriptionKo || undefined,
      descriptionEn: form.descriptionEn || undefined,
      startAt: htmlDatetimeLocalToIso(form.startAt),
      endAt: htmlDatetimeLocalToIso(form.endAt),
      location: form.location.trim() || undefined,
    };
    if (Date.parse(payload.endAt) < Date.parse(payload.startAt)) {
      setMessage(
        lang === "ko"
          ? "종료 시간은 시작 시간 이후여야 합니다."
          : "End time must be after start time.",
      );
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      if (editingId) {
        await apiClient.updateManualCalendarEvent(editingId, payload);
      } else {
        await apiClient.createManualCalendarEvent(payload);
      }
      closeForm();
      setMessage(
        lang === "ko"
          ? editingId ? "일정을 수정했습니다." : "일정을 저장했습니다."
          : editingId ? "Calendar event updated." : "Calendar event saved.",
      );
      await refresh();
    } catch {
      setMessage(
        lang === "ko"
          ? "일정을 저장하지 못했습니다."
          : "Could not save the event.",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async (event: CalendarEventRecord) => {
    const approved = await confirm({
      title: `‘${event.titleKo}’ 일정을 삭제할까요?`,
      description: "공개 캘린더에서 즉시 숨겨지며 다시 표시하려면 새로 등록해야 합니다.",
      confirmLabel: "일정 삭제",
      tone: "danger",
    });
    if (!approved) return;

    try {
      await apiClient.archiveManualCalendarEvent(event.calendarEventId);
      setMessage("일정을 삭제했습니다.");
      await refresh();
    } catch {
      setMessage("일정을 삭제하지 못했습니다.");
    }
  };

  const handleImport = async (file: File) => {
    try {
      const result = await apiClient.importCalendarIcs(await file.text());
      setMessage(
        lang === "ko"
          ? `${result.importedCount}개 일정을 가져왔습니다. 중복 ${result.skippedCount}개는 건너뛰었습니다.`
          : `Imported ${result.importedCount} event(s); skipped ${result.skippedCount} duplicate(s).`,
      );
      await refresh();
    } catch {
      setMessage(
        lang === "ko"
          ? "ICS 파일을 가져오지 못했습니다."
          : "Could not import the ICS file.",
      );
    }
  };

  const handleExport = async () => {
    try {
      const blob = await apiClient.exportCalendarIcs();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "soc-calendar.ics";
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      setMessage(
        lang === "ko"
          ? "ICS 파일을 내보내지 못했습니다."
          : "Could not export the ICS file.",
      );
    }
  };

  const handleExternalSync = async () => {
    try {
      const result = await apiClient.syncExternalCalendarIcs();
      const failed = result.failedSources.length > 0
        ? ` 실패: ${result.failedSources.join(", ")}`
        : "";
      setMessage(
        lang === "ko"
          ? `외부 캘린더 ${result.sourceCount}개를 확인했습니다. ${result.importedCount}개 추가, ${result.skippedCount}개 중복.${failed}`
          : `Checked ${result.sourceCount} external calendar(s): ${result.importedCount} imported, ${result.skippedCount} duplicate(s).${failed}`,
      );
      await refresh();
    } catch {
      setMessage(
        lang === "ko"
          ? "외부 캘린더 동기화를 실행하지 못했습니다."
          : "Could not sync external calendars.",
      );
    }
  };

  const handleKaistSync = async () => {
    try {
      const result = await apiClient.syncKaistAcademicCalendar(nowDate().getFullYear());
      const failed = result.failedMonths.length > 0
        ? ` 실패 월: ${result.failedMonths.join(", ")}`
        : "";
      setMessage(
        `KAIST 학사일정 ${result.year}년을 동기화했습니다. ${result.fetchedCount}개 확인, ${result.insertedCount}개 추가, ${result.updatedCount}개 수정, ${result.archivedCount}개 숨김.${failed}`,
      );
      await refresh();
    } catch {
      setMessage("KAIST 학사일정을 동기화하지 못했습니다.");
    }
  };

  const handleGoogleSync = async () => {
    try {
      const result = await apiClient.syncGoogleCalendars();
      setMessage(`Google 캘린더 동기화: ${result.succeededCount}개 성공, ${result.failedCount}개 실패.`);
      await refresh();
    } catch {
      setMessage("Google 캘린더 동기화를 실행하지 못했습니다.");
    }
  };

  return (
    <>
      {ConfirmDialog}
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button
          variant="ghost"
          type="button"
          onClick={startCreate}
          className={`${actionClassName} bg-brand-primary text-white hover:bg-brand-primary/90`}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          일정 추가
        </Button>
        <Button
          variant="outline"
          type="button"
          onClick={() => setManagementOpen(true)}
          className={actionClassName}
        >
          <CalendarDays className="h-4 w-4" aria-hidden="true" />
          일정 관리
        </Button>
        <label className={`${actionClassName} cursor-pointer border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 focus-within:outline-2`}>
          <FileUp className="h-4 w-4" aria-hidden="true" />
          ICS 가져오기
          <UiInput
            type="file"
            accept=".ics,text/calendar"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) void handleImport(file);
            }}
          />
        </label>
        <Button
          variant="ghost"
          type="button"
          onClick={() => void handleExport()}
          className={`${actionClassName} border border-slate-200 bg-white text-slate-700 hover:bg-slate-50`}
        >
          <Download className="h-4 w-4" aria-hidden="true" />
          ICS 내보내기
        </Button>

        <details className="relative">
          <summary className={`${actionClassName} cursor-pointer list-none border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 [&::-webkit-details-marker]:hidden`}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            동기화
          </summary>
          <div className="absolute right-0 top-full z-40 mt-2 flex w-44 flex-col rounded-lg border border-slate-200 bg-white p-1.5 shadow-lg">
            <button type="button" onClick={() => void handleExternalSync()} className="rounded-md px-2.5 py-2 text-left text-xs font-semibold text-slate-600 hover:bg-slate-50">
              외부 캘린더
            </button>
            <button type="button" onClick={() => void handleKaistSync()} className="rounded-md px-2.5 py-2 text-left text-xs font-semibold text-slate-600 hover:bg-slate-50">
              KAIST 학사일정
            </button>
            <button type="button" onClick={() => void handleGoogleSync()} className="rounded-md px-2.5 py-2 text-left text-xs font-semibold text-slate-600 hover:bg-slate-50">
              Google 캘린더
            </button>
          </div>
        </details>
      </div>

      {message && (
        <p className="mt-3 w-full text-right text-xs font-medium text-slate-500" role="status">
          {message}
        </p>
      )}

      <Modal
        open={managementOpen}
        onClose={() => setManagementOpen(false)}
        title="수동 일정 관리"
        className="max-w-3xl"
        footer={<Button type="button" variant="outline" onClick={() => setManagementOpen(false)}>닫기</Button>}
      >
        <div className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200">
          {manualEventsQuery.isPending ? (
            <p className="px-4 py-10 text-center text-sm font-normal text-[#344054]">일정을 불러오는 중입니다.</p>
          ) : (manualEventsQuery.data?.items.length ?? 0) === 0 ? (
            <p className="px-4 py-10 text-center text-sm font-normal text-[#344054]">등록한 수동 일정이 없습니다.</p>
          ) : manualEventsQuery.data?.items.map((event) => (
            <div key={event.calendarEventId} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-normal text-[#172033]">{event.titleKo}</p>
                <p className="mt-0.5 truncate text-xs font-normal text-[#344054]">
                  {new Intl.DateTimeFormat("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(event.startAt))}
                  {event.location ? ` · ${event.location}` : ""}
                </p>
              </div>
              {event.isReadOnly ? (
                <span className="text-xs font-normal text-[#344054]">읽기 전용</span>
              ) : (
                <div className="flex shrink-0 items-center gap-1">
                  <IconButton size="sm" aria-label={`${event.titleKo} 수정`} onClick={() => startEdit(event)}><Pencil aria-hidden="true" /></IconButton>
                  <IconButton size="sm" aria-label={`${event.titleKo} 삭제`} className="text-rose-600" onClick={() => void handleArchive(event)}><Trash2 aria-hidden="true" /></IconButton>
                </div>
              )}
            </div>
          ))}
        </div>
      </Modal>

      <Modal
        open={formOpen}
        onClose={closeForm}
        title={editingId ? "일정 수정" : "일정 추가"}
        className="max-w-2xl"
        footer={(
          <>
            <Button variant="outline" type="button" onClick={closeForm}>취소</Button>
            <Button type="submit" form="calendar-event-form" disabled={saving}>
              <Save className="h-4 w-4" aria-hidden="true" />
              {saving ? "저장 중..." : editingId ? "변경 저장" : "일정 저장"}
            </Button>
          </>
        )}
      >
          <form id="calendar-event-form" onSubmit={(event) => void handleSave(event)}>
            <div className="grid gap-4 md:grid-cols-2">
              <AdminFormField label="제목 (한글) *">
                <UiInput required className={controlClassName} value={form.titleKo} onChange={(event) => setForm((current) => ({ ...current, titleKo: event.target.value }))} />
              </AdminFormField>
              <AdminFormField label="제목 (영문)">
                <UiInput className={controlClassName} value={form.titleEn} onChange={(event) => setForm((current) => ({ ...current, titleEn: event.target.value }))} />
              </AdminFormField>
              <AdminFormField label="시작 *">
                <UiInput required type="datetime-local" className={controlClassName} value={form.startAt} onChange={(event) => setForm((current) => ({ ...current, startAt: event.target.value }))} />
              </AdminFormField>
              <AdminFormField label="종료 *">
                <UiInput required type="datetime-local" className={controlClassName} value={form.endAt} onChange={(event) => setForm((current) => ({ ...current, endAt: event.target.value }))} />
              </AdminFormField>
              <AdminFormField label="장소" className="md:col-span-2">
                <UiInput className={controlClassName} value={form.location} onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))} />
              </AdminFormField>
              <AdminFormField label="설명 (한글)">
                <UiTextarea className={`${controlClassName} py-2`} rows={3} value={form.descriptionKo} onChange={(event) => setForm((current) => ({ ...current, descriptionKo: event.target.value }))} />
              </AdminFormField>
              <AdminFormField label="설명 (영문)">
                <UiTextarea className={`${controlClassName} py-2`} rows={3} value={form.descriptionEn} onChange={(event) => setForm((current) => ({ ...current, descriptionEn: event.target.value }))} />
              </AdminFormField>
            </div>
          </form>
      </Modal>
    </>
  );
}
