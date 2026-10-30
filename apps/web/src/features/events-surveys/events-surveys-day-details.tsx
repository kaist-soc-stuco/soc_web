import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createApiClient } from "@soc/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarDays, ChevronRight, EyeOff, MapPin, MoreHorizontal, Pencil } from "lucide-react";
import { MobileEmptyState } from "@/components/ui/mobile-empty-state";

import { formatNumericDate } from "@/lib/date-display";
import type { Language } from "@/hooks/use-language";
import { stripCalendarPrefix, type CalendarEvent } from "@/lib/events-surveys";
import { formatCalendarScheduleText, getCalendarEventLocation, getCalendarEventStyles } from "./events-surveys-calendar-utils";
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
  embedded?: boolean;
  agenda?: boolean;
}

export function EventsSurveysDayDetails({
  events,
  lang,
  selectedDateStr,
  embedded = false,
  agenda = false,
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
      <aside
        className={agenda ? "mobile-calendar-day-events flex flex-col bg-white" : embedded ? "flex min-h-40 flex-col bg-white" : "scroll-mt-4 flex h-full min-h-0 flex-col self-start rounded-lg border border-card-border-subtle bg-white p-5 shadow-none lg:sticky lg:top-24 lg:min-h-[500px]"}
        id={embedded ? undefined : "calendar-day-details"}
      >
      {!embedded ? <div className="shrink-0 border-b border-slate-100 pb-4 select-none">
        <h3 className="text-lg font-semibold text-slate-800">{selectedDateStr}</h3>
      </div> : null}

      {events.length === 0 ? (
        <><MobileEmptyState icon={CalendarDays} className="mobile-calendar-empty-state" message={lang === "ko" ? "등록된 일정이 없습니다." : "No events scheduled."} />
        <div className="hidden flex-1 flex-col items-center justify-center py-12 text-center select-none md:flex">
          <p className="text-sm font-semibold text-slate-400">
            {lang === "ko" ? "등록된 일정이 없습니다." : "No events scheduled."}
          </p>
        </div></>
      ) : (
        <div className={agenda ? "mobile-calendar-agenda-events mobile-timeline-cards" : "scrollbar-hidden flex-1 space-y-2.5 overflow-y-auto py-4 pr-1"}>
          {events.map((event, idx) => {
            const style = getCalendarEventStyles(
              event.kind,
              lang,
              event.sourceType,
              event.category,
            );
            const shortTitle = stripCalendarPrefix(event.title);
            const scheduleText = formatCalendarScheduleText(event, lang);
            const location = getCalendarEventLocation(event, lang);
            const eventHref = getCalendarEventHref(event);
            const start = event.startAt ?? event.date, end = event.endAt ?? start;
            const allDay = event.isAllDay || event.sourceType === "KAIST_ACADEMIC";
            const timeFormat = new Intl.DateTimeFormat(lang === "ko" ? "ko-KR" : "en-US", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
            const academic = event.category === "ACADEMIC" || event.sourceType === "KAIST_ACADEMIC";
            const holiday = event.category === "HOLIDAY";
            const badgeKind = holiday ? "holiday" : academic ? "academic" : event.kind === "SURVEY" ? "survey" : "event";
            const kindLabel = holiday ? lang === "ko" ? "공휴일" : "Holiday" : academic ? lang === "ko" ? "학사일정" : "Academic" : event.kind === "SURVEY" ? lang === "ko" ? "설문" : "Survey" : lang === "ko" ? "행사" : "Event";
            const range = start.toDateString() !== end.toDateString() ? `${formatNumericDate(start)} — ${formatNumericDate(end)}` : null;
            const showAdminMenu =
              !eventHref &&
              canManage &&
              Boolean(event.calendarEventId) &&
              openMenuId === event.calendarEventId;
            const cardClassName =
              `group ${agenda ? "mobile-calendar-event-card " : ""}relative block min-h-11 w-full shrink-0 select-none rounded-lg bg-transparent px-1 py-3 transition-colors hover:bg-slate-50 ${showAdminMenu ? "z-20" : "z-0"}`;
            const cardContent = (
              <>
                <div className="calendar-agenda-event flex items-start gap-2.5">
                  {!agenda && <span
                    data-calendar-kind={academic ? "academic" : event.kind === "SURVEY" ? "survey" : "event"}
                    className={`calendar-agenda-marker my-0.5 w-[3px] shrink-0 self-stretch rounded-full ${style.bullet}`}
                    aria-hidden="true"
                  />}
                  <div className="min-w-0 flex-1">
                    {agenda && <div className="mobile-calendar-event-time">{range && <span>{range} · </span>}{allDay ? lang === "ko" ? "종일" : "All day" : <span>{timeFormat.format(start)}{timeFormat.format(start) !== timeFormat.format(end) && <> – {timeFormat.format(end)}</>}</span>}</div>}
                    <h4 className="break-words text-[0.9375rem] font-medium leading-5 tracking-tight text-slate-800">
                      {shortTitle}
                    </h4>
                    {event.description && (
                      <p className="mt-1 line-clamp-2 break-words text-xs font-medium leading-relaxed text-slate-500">
                        {event.description}
                      </p>
                    )}
                    {agenda ? <div className="mobile-calendar-event-meta">
                      <span className="mobile-calendar-event-badge" data-calendar-kind={badgeKind}>{kindLabel}</span>
                      {location && <span className="mobile-calendar-event-location"><MapPin aria-hidden="true" /><span>{location}</span></span>}
                    </div> : <>
                    <div className="mt-2 flex items-center gap-2 text-xs font-normal text-slate-600 select-none">
                      <span className="min-w-0 break-words whitespace-normal">{scheduleText}</span>
                    </div>
                    {location && <div className="mt-1 flex items-start gap-1 text-xs font-normal leading-4 text-slate-600">
                      <MapPin aria-hidden="true" className="mt-0.5 size-3 shrink-0" />
                      <span className="min-w-0 break-words">{location}</span>
                    </div>}
                    </>}
                  </div>
                  {eventHref ? (
                    <ChevronRight
                      aria-hidden="true"
                      className="mt-0.5 size-4 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-400"
                    />
                  ) : canManage && event.calendarEventId ? (
                    <IconButton
                      className="min-h-11 min-w-11" aria-expanded={showAdminMenu} aria-haspopup="menu"
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
              <Link key={idx} to={eventHref} target={/^\/(survey|votes)\//.test(eventHref) ? "_blank" : undefined} rel="noopener noreferrer" className={cardClassName}>
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
  if (event.sourceType === "VOTE" && event.voteId) return `/votes/${event.voteId}`;
  if (event.sourceType === "ARTICLE" && event.articleId) {
    return `/events/${event.articleId}`;
  }
  if (event.sourceType === "SURVEY" && event.surveyId) {
    return `/survey/${event.surveyId}`;
  }
  return null;
}
