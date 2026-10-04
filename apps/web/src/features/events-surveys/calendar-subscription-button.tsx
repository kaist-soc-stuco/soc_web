import { CalendarPlus, Check, Copy, Download, EllipsisVertical } from "lucide-react";
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
      toast({ type: "success", message: lang === "ko" ? "구독 주소를 복사했습니다." : "Subscription URL copied." });
    } catch {
      toast({ type: "error", message: lang === "ko" ? "주소를 복사하지 못했습니다. 다시 시도해 주세요." : "Could not copy the URL. Please try again." });
    }
  };

  const content = <div className="calendar-subscription-content space-y-3">
    <p className="text-sm font-normal leading-5 text-slate-600">
      {lang === "ko" ? "캘린더 앱에 등록해 실시간으로 일정을 받아보세요." : "Add this calendar to your app to receive schedule updates."}
    </p>
    <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
      <code className="min-w-0 flex-1 truncate text-xs leading-4 text-slate-600">{absoluteFeedUrl}</code>
      <Button type="button" variant="ghost" size="icon" className="shrink-0"
        aria-label={copied ? (lang === "ko" ? "복사됨" : "Copied") : (lang === "ko" ? "구독 주소 복사" : "Copy subscription URL")}
        onClick={() => void copyFeedUrl()}>
        {copied ? <Check aria-hidden="true" className="text-brand-primary" /> : <Copy aria-hidden="true" />}
      </Button>
    </div>
    <div className="border-t border-slate-100 pt-2">
      <a className="inline-flex min-h-9 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
        download="soc-calendar.ics" href={absoluteFeedUrl} rel="noreferrer" target="_blank">
        <Download aria-hidden="true" className="size-3.5 opacity-70" />
        {lang === "ko" ? ".ics 파일 다운로드" : "Download .ics file"}
      </a>
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
        <PopoverPanel id={panelId} className="left-0 top-full mt-2 w-[min(25rem,calc(100vw-3rem))] p-4 sm:left-auto sm:right-0">
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
