import { ArrowUpRight, CalendarPlus, Check, Copy, EllipsisVertical } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { PopoverPanel } from "@/components/ui/popover-panel";
import { FilterSheet } from "@/components/ui/filter-sheet";
import { useMediaQuery } from "@/hooks/use-media-query";

export function CalendarSubscriptionButton({
  feedUrl,
  lang,
}: {
  feedUrl: string;
  lang: string;
}) {
  const { toast } = useToast();
  const isMobile = useMediaQuery("(width < 768px)");
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const absoluteFeedUrl = toAbsoluteUrl(feedUrl);
  const appleCalendarUrl = absoluteFeedUrl.replace(/^https?:/i, "webcal:");
  const googleCalendarUrl = `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(absoluteFeedUrl)}`;
  const actionClassName = "flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/30";

  useEffect(() => () => {
    if (copyTimer.current) clearTimeout(copyTimer.current);
  }, []);

  useEffect(() => {
    if (!open || isMobile) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && containerRef.current?.contains(event.target)) return;
      setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, isMobile]);

  const copyFeedUrl = async () => {
    try {
      await navigator.clipboard.writeText(absoluteFeedUrl);
      setCopied(true);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 1400);
      toast({ type: "success", message: lang === "ko" ? "iCal 주소를 복사했습니다." : "iCal URL copied." });
    } catch {
      toast({ type: "error", message: lang === "ko" ? "주소를 복사하지 못했습니다. 다시 시도해 주세요." : "Could not copy the URL. Please try again." });
    }
  };

  const content = <div className="calendar-subscription-content space-y-1">
    {!isMobile && <p className="px-3 pb-1 pt-2 text-xs font-medium text-slate-500">{lang === "ko" ? "캘린더에 추가" : "Add to calendar"}</p>}
    <a href={googleCalendarUrl} target="_blank" rel="noopener noreferrer" className={actionClassName}>
      <img src="/icons/google-calendar.svg" alt="" aria-hidden="true" className="size-5 shrink-0" />
      <span className="min-w-0 flex-1">{lang === "ko" ? "Google 캘린더에 추가" : "Add to Google Calendar"}</span>
      <ArrowUpRight aria-hidden="true" className="size-4 shrink-0 text-slate-400" />
    </a>
    <a href={appleCalendarUrl} className={actionClassName}>
      <img src="/icons/apple.svg" alt="" aria-hidden="true" className="size-5 shrink-0" />
      <span className="min-w-0 flex-1">{lang === "ko" ? "Apple 캘린더에 추가" : "Add to Apple Calendar"}</span>
      <ArrowUpRight aria-hidden="true" className="size-4 shrink-0 text-slate-400" />
    </a>
    <div className="border-t border-slate-100 pt-1">
      <button type="button" className={actionClassName} onClick={() => void copyFeedUrl()}>
        {copied ? <Check aria-hidden="true" className="size-5 shrink-0 text-brand-primary" /> : <Copy aria-hidden="true" className="size-5 shrink-0 text-slate-500" />}
        <span>{copied ? (lang === "ko" ? "복사 완료" : "Copied") : (lang === "ko" ? "iCal 주소 복사" : "Copy iCal URL")}</span>
      </button>
    </div>
  </div>;

  return (
    <div ref={containerRef} className="relative">
      <Button
        type="button"
        variant={isMobile ? "ghost" : "outline"}
        className={isMobile ? "mobile-more-trigger !size-11 !min-h-11 !p-0" : undefined}
        aria-label={isMobile ? (lang === "ko" ? "일정 옵션" : "Calendar options") : undefined}
        aria-controls={isMobile ? undefined : panelId}
        aria-haspopup={isMobile ? "dialog" : undefined}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        {isMobile ? <EllipsisVertical aria-hidden="true" /> : <><CalendarPlus aria-hidden="true" />{lang === "ko" ? "캘린더 연동" : "Connect calendar"}</>}
      </Button>
      {isMobile ? <FilterSheet className="mobile-filter-sheet mobile-calendar-subscription" open={open} onClose={() => setOpen(false)} title={lang === "ko" ? "캘린더 연동" : "Connect calendar"} closeLabel={lang === "ko" ? "캘린더 연동 닫기" : "Close calendar connection"}>{content}</FilterSheet> : open ? (
        <PopoverPanel id={panelId} className="left-0 top-full mt-2 w-[min(20rem,calc(100vw-3rem))] p-2 sm:left-auto sm:right-0">
          {content}
        </PopoverPanel>
      ) : null}
    </div>
  );
}

function toAbsoluteUrl(value: string) {
  if (typeof window === "undefined") return value;
  try {
    return new URL(value, window.location.origin).toString();
  } catch {
    return value;
  }
}
