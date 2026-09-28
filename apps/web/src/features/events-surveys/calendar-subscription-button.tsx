import { CalendarPlus, Copy, Download } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { PopoverPanel } from "@/components/ui/popover-panel";

export function CalendarSubscriptionButton({
  feedUrl,
  lang,
}: {
  feedUrl: string;
  lang: string;
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
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
      toast({ type: "success", message: lang === "ko" ? "구독 주소를 복사했습니다." : "Subscription URL copied." });
    } catch {
      toast({ type: "error", message: lang === "ko" ? "주소를 복사하지 못했습니다. 다시 시도해 주세요." : "Could not copy the URL. Please try again." });
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
        <PopoverPanel id={panelId} className="left-0 top-full mt-2 w-[min(25rem,calc(100vw-3rem))] p-4 sm:left-auto sm:right-0">
          <div className="space-y-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                {lang === "ko" ? "캘린더 구독" : "Subscribe to the calendar"}
              </h2>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
              <code className="min-w-0 flex-1 break-all text-xs leading-4 text-slate-600">{absoluteFeedUrl}</code>
              <Button type="button" variant="ghost" size="sm" className="shrink-0" onClick={() => void copyFeedUrl()}>
                <Copy aria-hidden="true" />
                {lang === "ko" ? "구독 주소 복사" : "Copy subscription URL"}
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
                {lang === "ko" ? "일정 파일 다운로드 (.ics)" : "Download calendar (.ics)"}
              </a>

            </div>
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
