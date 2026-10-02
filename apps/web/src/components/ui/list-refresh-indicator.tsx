import { cn } from "@/lib/utils";

export function ListRefreshIndicator({ refreshing, className }: { refreshing: boolean; className?: string }) {
  return (
    <span data-list-refresh-slot="" className={cn("pointer-events-none inline-flex size-4 shrink-0 items-center justify-center", className)}>
      {refreshing ? (
        <span role="status" aria-label="목록 갱신 중" className="size-3 animate-spin rounded-full border-2 border-slate-200 border-t-slate-500">
          <span className="sr-only">목록 갱신 중</span>
        </span>
      ) : null}
    </span>
  );
}
