import { CalendarPlus, Check, Copy, Download } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { PopoverPanel } from "@/components/ui/popover-panel";

export function CalendarSubscriptionButton({
  feedUrl,
  lang,
}: {
  feedUrl: string;
  lang: string;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const absoluteFeedUrl = toAbsoluteUrl(feedUrl);

  useEffect(() => {
    if (!open) return;

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
  }, [open]);

  const copyFeedUrl = async () => {
    try {
      await navigator.clipboard.writeText(absoluteFeedUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <Button
        type="button"
        variant="outline"
        aria-controls={panelId}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <CalendarPlus aria-hidden="true" />
        {lang === "ko" ? "캘린더 구독" : "Subscribe to calendar"}
      </Button>
      {open ? (
        <PopoverPanel id={panelId} className="right-0 top-full mt-2 w-[min(25rem,calc(100vw-2rem))] p-4">
          <div className="space-y-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                {lang === "ko" ? "캘린더 구독" : "Subscribe to the calendar"}
              </h2>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                {lang === "ko"
                  ? "구독 주소를 캘린더 앱에 추가하면 공개 일정이 자동으로 갱신됩니다."
                  : "Add this feed URL to your calendar app to receive updated public schedules."}
              </p>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
              <code className="min-w-0 flex-1 break-all text-xs leading-4 text-slate-600">{absoluteFeedUrl}</code>
              <Button type="button" size="sm" className="shrink-0" onClick={() => void copyFeedUrl()}>
                {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
                {copied ? (lang === "ko" ? "복사됨" : "Copied") : lang === "ko" ? "구독 주소 복사" : "Copy subscription URL"}
              </Button>
            </div>
            <div className="border-t border-slate-100 pt-2">
              <a
                className="inline-flex min-h-9 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
                download="soc-calendar.ics"
                href={absoluteFeedUrl}
                rel="noreferrer"
                target="_blank"
              >
                <Download aria-hidden="true" className="size-3.5" />
                {lang === "ko" ? "iCal 파일 다운로드" : "Download iCal file"}
              </a>
              <p className="px-2 text-xs leading-5 text-slate-500">
                {lang === "ko"
                  ? "파일로 가져온 일정은 자동으로 갱신되지 않습니다."
                  : "Events imported from a file do not update automatically."}
              </p>
            </div>
            <p className="text-xs leading-4 text-slate-400">
              {lang === "ko" ? "로그인이 필요한 투표 일정은 구독 피드에 포함되지 않습니다." : "Vote schedules that require sign-in are not included in this public feed."}
            </p>
          </div>
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
