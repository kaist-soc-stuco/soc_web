import type { ReactNode } from "react";
import { AlertCircle, FileText, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface DataStateProps {
  children?: ReactNode;
  className?: string;
  message: string;
  minHeightClassName?: string;
}

interface ErrorStateProps {
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
  className,
  description = "일시적인 네트워크 오류일 수 있습니다. 잠시 후 다시 시도해 주세요.",
  onRetry,
  retryLabel = "다시 시도",
  title = "목록을 불러오지 못했습니다.",
}: ErrorStateProps) {
  return (
    <div
      className={cn(
        "flex min-h-48 flex-col items-center justify-center px-5 py-12 text-center",
        className,
      )}
      role="alert"
    >
      <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
        <AlertCircle aria-hidden="true" className="size-6" strokeWidth={1.8} />
      </div>
      <h3 className="text-base font-semibold text-slate-800">{title}</h3>
      <p className="mt-1 max-w-sm text-sm font-normal leading-6 text-slate-500">
        {description}
      </p>
      {onRetry ? (
        <Button
          className="mt-5 gap-1.5 border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50 hover:text-slate-900"
          onClick={onRetry}
          size="sm"
          type="button"
          variant="outline"
        >
          <RotateCcw aria-hidden="true" className="size-4 text-slate-500" />
          {retryLabel}
        </Button>
      ) : null}
    </div>
  );
}
