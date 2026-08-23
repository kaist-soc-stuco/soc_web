import { X } from "lucide-react";
import { isoToMs, msToDate } from "@soc/shared";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface DraftRestoredBannerProps {
  className?: string;
  onDismiss?: () => void;
  onStartNew?: () => void;
  savedAt?: string | null;
}

function formatSavedAt(value: string) {
  const ms = isoToMs(value);
  if (Number.isNaN(ms)) return value;
  const date = msToDate(ms);
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

/** Shared, dismissible notice used when a saved draft is restored into an editor. */
export function DraftRestoredBanner({
  className,
  onDismiss,
  onStartNew,
  savedAt,
}: DraftRestoredBannerProps) {
  return (
    <div
      className={cn(
        "flex min-h-10 items-center justify-between gap-3 rounded-lg border border-emerald-200/70 bg-emerald-50/70 px-3.5 py-2 text-sm text-emerald-900",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <p className="min-w-0 truncate">
        작성 중이던 초안을 불러왔습니다.
        {savedAt ? ` (최종 저장: ${formatSavedAt(savedAt)})` : ""}
      </p>
      <div className="flex shrink-0 items-center gap-1">
        {onStartNew ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onStartNew}
            className="text-emerald-700 hover:bg-emerald-100/80 hover:text-emerald-800"
          >
            새로 쓰기
          </Button>
        ) : null}
        {onDismiss ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="초안 복구 안내 닫기"
            onClick={onDismiss}
            className="size-8 rounded-md text-emerald-600 hover:bg-emerald-100/80 hover:text-emerald-800"
          >
            <X aria-hidden="true" className="size-4" />
          </Button>
        ) : null}
      </div>
    </div>
  );
}
