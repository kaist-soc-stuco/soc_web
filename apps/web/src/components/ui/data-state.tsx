import type { ReactNode } from "react";
import { FileQuestion, FileText, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface DataStateProps {
  children?: ReactNode;
  className?: string;
  message: string;
  minHeightClassName?: string;
}

interface ErrorStateProps {
  actions?: ReactNode;
  className?: string;
  description?: string;
  onRetry?: () => void;
  retryLabel?: string;
  title?: string;
}

export function EmptyState({
  children,
  className,
  message,
  minHeightClassName = "min-h-36",
}: DataStateProps) {
  return (
    <div
      className={cn(
        "select-none flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-5 text-center text-sm font-medium text-slate-400",
        minHeightClassName,
        className,
      )}
    >
      <FileText aria-hidden="true" className="h-5 w-5 text-slate-300" strokeWidth={1.6} />
      <span>{children ?? message}</span>
    </div>
  );
}

export function ErrorState({
  actions,
  className,
  description = "잠시 후 다시 시도해 주세요. 문제가 계속되면 관리자에게 문의해 주세요.",
  onRetry,
  retryLabel = "다시 시도",
  title = "내용을 불러올 수 없습니다",
}: ErrorStateProps) {
  return (
    <div
      className={cn(
        "flex min-h-64 flex-col items-center justify-center rounded-xl border border-slate-200/80 bg-white px-6 py-10 text-center shadow-[0_2px_8px_rgba(15,23,42,0.025)]",
        className,
      )}
      role="alert"
    >
      <div className="mb-5 flex size-14 items-center justify-center rounded-2xl bg-slate-50 text-slate-400">
        <FileQuestion aria-hidden="true" className="size-7" strokeWidth={1.5} />
      </div>
      <h3 className="max-w-full break-words text-base font-semibold leading-6 text-slate-800">{title}</h3>
      <p className="mt-2 max-w-full break-words whitespace-normal text-sm font-normal leading-6 text-slate-500">
        {description}
      </p>
      {onRetry || actions ? <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
      {onRetry ? (
        <Button
          className="gap-1.5 border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900"
          onClick={onRetry}
          size="sm"
          type="button"
          variant="outline"
        >
          <RotateCcw aria-hidden="true" className="size-4 text-slate-500" />
          {retryLabel}
        </Button>
      ) : null}
      {actions}
      </div> : null}
    </div>
  );
}
