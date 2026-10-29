import { useMemo, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { localDate, nowDate } from "@soc/shared";
import type { KoreanHolidayRecord } from "@soc/contracts";
import type { Language } from "@/hooks/use-language";
import type { CalendarEvent } from "@/lib/events-surveys";
import { isCalendarEventOnDay } from "@/lib/events-surveys";
import { getKoreanHolidayName } from "@/lib/korean-holidays";
import { formatShortDateWithWeekday } from "@/lib/date-display";
import { SelectDropdown } from "@/components/atoms/select-dropdown";
import { EventsSurveysDayDetails } from "./events-surveys-day-details";
import {
  buildCalendarGrid,
  buildMobileAgendaGroups,
  toDateKey,
} from "./events-surveys-calendar-utils";

function eventKind(event: CalendarEvent) {
  return event.sourceType === "KAIST_ACADEMIC" || event.category === "ACADEMIC"
    ? "academic"
    : event.kind === "SURVEY" || event.sourceType === "SURVEY"
      ? "survey"
      : "event";
}

export function MobilePublicCalendar({
  calendarEvents,
  selectedDate,
  onSelectedDateChange,
  onCurrentDateChange,
  holidays,
  lang,
  isFetching,
}: {
  calendarEvents: CalendarEvent[];
  selectedDate: Date;
  onSelectedDateChange: (date: Date) => void;
  onCurrentDateChange: (date: Date) => void;
  holidays: KoreanHolidayRecord[];
  lang: Language;
  isFetching: boolean;
}) {
  const [expanded, setExpanded] = useState(true);
  const [filter, setFilter] = useState("all");
  const year = selectedDate.getFullYear(),
    month = selectedDate.getMonth();
  const today = nowDate(),
    selectedKey = toDateKey(selectedDate);
  const holidayMap = useMemo(
    () => new Map(holidays.map((holiday) => [holiday.locdate, holiday])),
    [holidays],
  );
  const visible = useMemo(
    () =>
      calendarEvents.filter(
        (event) => filter === "all" || eventKind(event) === filter,
      ),
    [calendarEvents, filter],
  );
  const groups = useMemo(
    () => buildMobileAgendaGroups(visible, selectedDate),
    [visible, selectedDate],
  );
  const weekdays =
    lang === "ko"
      ? ["일", "월", "화", "수", "목", "금", "토"]
      : ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
  const cells = expanded
    ? buildCalendarGrid(year, month)
    : Array.from({ length: 7 }, (_, index) => {
        const date = localDate(
          year,
          month,
          selectedDate.getDate() - selectedDate.getDay() + index,
        );
        return {
          date,
          day: date.getDate(),
          isCurrentMonth: date.getMonth() === month,
        };
      });
  const select = (date: Date) => {
    onSelectedDateChange(date);
    onCurrentDateChange(localDate(date.getFullYear(), date.getMonth(), 1));
  };
  const move = (direction: number) => {
    if (!expanded) {
      select(localDate(year, month, selectedDate.getDate() + 7 * direction));
      return;
    }
    const max = localDate(year, month + direction + 1, 0).getDate();
    select(
      localDate(year, month + direction, Math.min(selectedDate.getDate(), max)),
    );
  };
  const monthTitle =
    lang === "ko"
      ? `${year}년 ${month + 1}월`
      : new Intl.DateTimeFormat("en-US", {
          year: "numeric",
          month: "long",
        }).format(selectedDate);
  return (
    <section
      className="mobile-public-calendar"
      aria-label={lang === "ko" ? "일정 달력" : "Calendar"}
    >
      <div className="mobile-calendar-overview">
        <div className="mobile-calendar-toolbar">
          <button
            type="button"
            className="mobile-calendar-title"
            aria-expanded={expanded}
            aria-controls="mobile-calendar-dates"
            onClick={() => setExpanded((value) => !value)}
          >
            {monthTitle}
            <ChevronDown
              aria-hidden="true"
              className={expanded ? "rotate-180" : ""}
            />
          </button>
          <div className="mobile-calendar-period-actions">
            <button
              type="button"
              className="today"
              onClick={() => select(today)}
            >
              {lang === "ko" ? "오늘" : "Today"}
            </button>
            <button
              type="button"
              aria-label={
                lang === "ko"
                  ? expanded
                    ? "이전 달"
                    : "이전 주"
                  : expanded
                    ? "Previous month"
                    : "Previous week"
              }
              onClick={() => move(-1)}
            >
              <ChevronLeft aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label={
                lang === "ko"
                  ? expanded
                    ? "다음 달"
                    : "다음 주"
                  : expanded
                    ? "Next month"
                    : "Next week"
              }
              onClick={() => move(1)}
            >
              <ChevronRight aria-hidden="true" />
            </button>
          </div>
        </div>
        <div className="mobile-calendar-weekdays" aria-hidden="true">
          {weekdays.map((name, index) => (
            <span
              key={name}
              data-tone={index === 0 ? "red" : index === 6 ? "blue" : undefined}
            >
              {name}
            </span>
          ))}
        </div>
        <div id="mobile-calendar-dates" className="mobile-calendar-dates">
          {cells.map((cell) => {
            const key = toDateKey(cell.date),
              holiday = holidayMap.get(key);
            const kinds = [
              ...new Set(
                visible
                  .filter((event) => isCalendarEventOnDay(event, cell.date))
                  .map(eventKind),
              ),
            ];
            return (
              <button
                key={key}
                type="button"
                className="mobile-calendar-date"
                data-outside={!cell.isCurrentMonth}
                data-tone={
                  holiday || cell.date.getDay() === 0
                    ? "red"
                    : cell.date.getDay() === 6
                      ? "blue"
                      : undefined
                }
                aria-label={[
                  formatShortDateWithWeekday(cell.date, lang),
                  holiday ? getKoreanHolidayName(holiday.dateName, lang) : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
                aria-current={key === toDateKey(today) ? "date" : undefined}
                aria-pressed={key === selectedKey}
                onClick={() => select(cell.date)}
              >
                <span>{cell.day}</span>
                <i className="mobile-calendar-dots" aria-hidden="true">
                  {kinds.slice(0, 3).map((kind) => (
                    <i key={kind} data-kind={kind} />
                  ))}
                </i>
              </button>
            );
          })}
        </div>
      </div>
      <div className="mobile-calendar-agenda-heading">
        <h2>{lang === "ko" ? "다가오는 일정" : "Upcoming events"}</h2>
        <SelectDropdown
          value={filter}
          onChange={setFilter}
          ariaLabel={lang === "ko" ? "일정 종류" : "Calendar category"}
          className="mobile-calendar-category"
          buttonClassName="mobile-calendar-category-trigger"
          options={[
            { value: "all", label: lang === "ko" ? "전체 일정" : "All events" },
            { value: "event", label: lang === "ko" ? "행사" : "Events" },
            {
              value: "academic",
              label: lang === "ko" ? "학사일정" : "Academic",
            },
            { value: "survey", label: lang === "ko" ? "설문" : "Surveys" },
          ]}
        />
      </div>
      {isFetching && groups.length === 0 ? (
        <div
          className="mobile-calendar-agenda-loading"
          aria-busy="true"
          aria-label={lang === "ko" ? "일정 불러오는 중" : "Loading events"}
        />
      ) : (
        <>
          {!groups.some((group) => toDateKey(group.date) === selectedKey) && (
            <p className="mobile-calendar-no-day">
              {lang === "ko"
                ? `${formatShortDateWithWeekday(selectedDate, lang)}에는 일정이 없습니다.`
                : `No events on ${formatShortDateWithWeekday(selectedDate, lang)}.`}
            </p>
          )}
          {groups.map((group) => (
            <section
              className="mobile-calendar-agenda-group"
              key={toDateKey(group.date)}
            >
              <h3>
                {formatShortDateWithWeekday(group.date, lang)}
                {toDateKey(group.date) === toDateKey(today) && (
                  <span>{lang === "ko" ? "오늘" : "Today"}</span>
                )}
              </h3>
              <EventsSurveysDayDetails
                events={group.events}
                lang={lang}
                selectedDateStr={formatShortDateWithWeekday(group.date, lang)}
                embedded
                agenda
              />
            </section>
          ))}
          {groups.length === 0 && (
            <p className="mobile-calendar-no-day">
              {lang === "ko"
                ? "선택한 기간 이후 등록된 일정이 없습니다."
                : "No upcoming events in this date range."}
            </p>
          )}
        </>
      )}
    </section>
  );
}
