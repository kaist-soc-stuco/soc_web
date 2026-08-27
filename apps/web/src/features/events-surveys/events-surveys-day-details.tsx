import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createApiClient } from "@soc/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronRight, EyeOff, MoreHorizontal, Pencil } from "lucide-react";

import type { Language } from "@/hooks/use-language";
import { formatNumericDate } from "@/lib/date-display";
import { stripCalendarPrefix, type CalendarEvent } from "@/lib/events-surveys";
import { getCalendarEventStyles } from "./events-surveys-calendar-utils";
import { AdminActionMenuDivider, AdminActionMenuItem, AdminActionMenuPanel } from "@/components/ui/admin-action-menu";
import { IconButton } from "@/components/ui/icon-button";
import { useToast } from "@/components/ui/toast";
import { useCurrentSession } from "@/hooks/use-current-session";
import { resolveApiBaseUrl } from "@/lib/api-base-url";
import { Permissions } from "@/lib/permissions";

interface EventsSurveysDayDetailsProps {
  events: CalendarEvent[];
  lang: Language;
  selectedDateStr: string;
}

export function EventsSurveysDayDetails({
  events,
  lang,
  selectedDateStr,
}: EventsSurveysDayDetailsProps) {
  const apiClient = useMemo(() => createApiClient({ baseUrl: resolveApiBaseUrl() }), []);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { data: session } = useCurrentSession();
  const { toast } = useToast();
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const canManage = Permissions.has(session?.permission ?? 0, Permissions.MANAGE_CALENDAR);

  useEffect(() => {
    if (!openMenuId) return;

    const handlePointerDown = (event: PointerEvent) => {
      const element = event.target instanceof Element ? event.target : null;
      const trigger = element?.closest("[data-calendar-menu-trigger]");
      const menu = element?.closest("[data-calendar-menu]");
      if (
        trigger?.getAttribute("data-calendar-menu-trigger") === openMenuId ||
        menu?.getAttribute("data-calendar-menu") === openMenuId
      ) {
        return;
      }
      setOpenMenuId(null);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setOpenMenuId(null);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [openMenuId]);

  const updatePresentation = async (
    event: CalendarEvent,
    input: { isHiddenByAdmin?: boolean },
    successMessage?: string,
    notify = true,
  ): Promise<boolean> => {
    if (!event.calendarEventId) return false;
    try {
      await apiClient.updateCalendarEventPresentation(event.calendarEventId, input);
      setOpenMenuId(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["events-surveys", "calendar-events"] }),
        queryClient.invalidateQueries({ queryKey: ["calendar", "events"] }),
        queryClient.invalidateQueries({ queryKey: ["admin", "calendar-events"] }),
      ]);
      if (notify) {
        toast({ type: "success", message: successMessage ?? (input.isHiddenByAdmin ? "일정을 숨겼습니다." : "일정 분류를 변경했습니다.") });
      }
      return true;
    } catch {
      toast({ type: "error", message: "일정 설정을 변경하지 못했습니다." });
      return false;
    }
  };

  const hideEvent = async (event: CalendarEvent) => {
    const title = stripCalendarPrefix(event.title).trim() || event.title;
    const updated = await updatePresentation(
      event,
      { isHiddenByAdmin: true },
      undefined,
      false,
    );
    if (!updated) return;
    toast({
      type: "success",
      message: `${title} 일정이 숨겨졌습니다.`,
      action: {
        label: "실행 취소",
        onClick: () => {
          void updatePresentation(
            event,
            { isHiddenByAdmin: false },
            `${title} 일정이 다시 표시되었습니다.`,
          );
        },
      },
    });
  };

  return (
    <>
      <aside className="sticky top-24 flex h-full min-h-[500px] flex-col rounded-lg border border-card-border-subtle bg-white p-5 shadow-none lg:col-span-1">
      <div className="shrink-0 border-b border-slate-100 pb-4 select-none">
        <h3 className="text-lg font-semibold text-slate-800">{selectedDateStr}</h3>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="text-sm font-medium text-slate-400">
            {lang === "ko"
              ? `${events.length}개의 일정`
              : `${events.length} event${events.length === 1 ? "" : "s"}`}
          </p>
        </div>
      </div>

      {events.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center py-12 text-center select-none">
          <p className="text-sm font-semibold text-slate-400">
            {lang === "ko" ? "등록된 일정이 없습니다." : "No events scheduled."}
          </p>
        </div>
      ) : (
        <div className="scrollbar-hidden flex-1 space-y-2.5 overflow-y-auto py-4 pr-1">
          {events.map((event, idx) => {
            const style = getCalendarEventStyles(
              event.kind,
              lang,
              event.sourceType,
              event.category,
            );
            const shortTitle = stripCalendarPrefix(event.title);
            const scheduleText = formatScheduleText(event, lang);
            const eventHref = getCalendarEventHref(event);
            const showAdminMenu =
              !eventHref &&
              canManage &&
              Boolean(event.calendarEventId) &&
              openMenuId === event.calendarEventId;
            const cardClassName =
              `group relative block w-full shrink-0 rounded-lg border border-slate-200 bg-white p-3.5 transition hover:border-slate-300 ${showAdminMenu ? "z-20" : "z-0"}`;
            const cardContent = (
              <>
                <div className="flex items-start gap-2.5">
                  <span
                    className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${style.bullet}`}
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1">
                    <h4 className="text-[length:var(--ui-text-body-sm-size)] font-medium leading-[1.125rem] text-slate-800">
                      {shortTitle}
                    </h4>
                    {event.description && (
                      <p className="mt-1 line-clamp-2 text-xs font-medium leading-relaxed text-slate-500">
                        {event.description}
                      </p>
                    )}
                    <div className="mt-1.5 flex items-center gap-2 text-xs font-normal text-slate-400 select-none">
                      <span className="min-w-0 truncate">{scheduleText}</span>
                    </div>
                  </div>
                  {eventHref ? (
                    <ChevronRight
                      aria-hidden="true"
                      className="mt-0.5 size-4 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-400"
                    />
                  ) : canManage && event.calendarEventId ? (
                    <IconButton
                      size="sm"
                      aria-label={`${shortTitle} 관리`}
                      data-calendar-menu-trigger={event.calendarEventId}
                      onClick={() => setOpenMenuId((current) => current === event.calendarEventId ? null : event.calendarEventId ?? null)}
                    >
                      <MoreHorizontal aria-hidden="true" />
                    </IconButton>
                  ) : null}
                </div>
                {showAdminMenu ? (
                  <AdminActionMenuPanel data-calendar-menu={event.calendarEventId} className="absolute right-3 top-12 z-50 w-44">
                    <AdminActionMenuItem
                      icon={<Pencil aria-hidden="true" />}
                      onClick={() => navigate(`/admin/calendar?event=${encodeURIComponent(event.calendarEventId ?? "")}`)}
                    >
                      {event.sourceType === "KAIST_ACADEMIC" ? "분류·노출 설정" : "일정 수정"}
                    </AdminActionMenuItem>
                    <AdminActionMenuDivider />
                    <AdminActionMenuItem icon={<EyeOff aria-hidden="true" />} onClick={() => void hideEvent(event)}>
                      캘린더에서 숨김
                    </AdminActionMenuItem>
                  </AdminActionMenuPanel>
                ) : null}
              </>
            );

            return eventHref ? (
              <Link key={idx} to={eventHref} className={cardClassName}>
                {cardContent}
              </Link>
            ) : (
              <div key={idx} className={cardClassName}>
                {cardContent}
              </div>
            );
          })}
        </div>
      )}
      </aside>
    </>
  );
}

function getCalendarEventHref(event: CalendarEvent) {
  if (event.sourceType === "ARTICLE" && event.articleId) {
    return `/events/${event.articleId}`;
  }
  if (event.sourceType === "SURVEY" && event.surveyId) {
    return `/survey/${event.surveyId}`;
  }
  return null;
}

function formatDetailDate(date: Date, lang: Language) {
  const weekday = new Intl.DateTimeFormat(lang === "ko" ? "ko-KR" : "en-US", {
    weekday: "short",
  }).format(date);
  return `${formatNumericDate(date)} (${weekday})`;
}

function formatDetailTime(date: Date, lang: Language) {
  return new Intl.DateTimeFormat(lang === "ko" ? "ko-KR" : "en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function formatScheduleText(event: CalendarEvent, lang: Language) {
  const startDate = event.startAt ?? event.date;
  const endDate = event.endAt ?? event.date;
  const sameDay = isSameLocalDay(startDate, endDate);
  const startText = formatDetailDate(startDate, lang);
  const endText = formatDetailDate(endDate, lang);

  if (event.sourceType === "KAIST_ACADEMIC") {
    return sameDay
      ? `${startText} ${lang === "ko" ? "종일" : "All day"}`
      : `${startText} ～ ${endText} ${lang === "ko" ? "종일" : "All day"}`;
  }

  const startTime = formatDetailTime(startDate, lang);
  const endTime = formatDetailTime(endDate, lang);
  if (sameDay) {
    return startTime === endTime
      ? `${startText} ${startTime}`
      : `${startText} ${startTime} ～ ${endTime}`;
  }

  return `${startText} ${startTime} ～ ${endText} ${endTime}`;
}

function isSameLocalDay(first: Date, second: Date) {
  return (
    first.getFullYear() === second.getFullYear() &&
    first.getMonth() === second.getMonth() &&
    first.getDate() === second.getDate()
  );
}
