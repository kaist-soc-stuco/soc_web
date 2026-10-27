import type { ComponentProps, ReactNode } from "react";
import { ApiClientHttpError } from "@soc/api-client";
import { RefreshCw, FileText } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface DataStateProps {
  children?: ReactNode;
  className?: string;
  message: string;
  minHeightClassName?: string;
}

interface ErrorStateProps {
  error?: unknown;
  actions?: ReactNode;
  className?: string;
  description?: string;
  onRetry?: () => void;
  retryLabel?: string;
  requestId?: string;
  requestIdLabel?: string;
  title?: string;
  headingAs?: "h1" | "h2" | "h3";
}

export function ListStateAction({ icon: Icon, children, className, ...props }: Omit<ComponentProps<typeof Button>, "variant" | "size" | "asChild"> & { icon?: LucideIcon }) {
  return <Button type="button" variant="outline" size="sm"
    className={cn("!h-[var(--ui-control-height-compact)] !min-h-[var(--ui-control-height-compact)] !border-slate-200 !bg-white !text-slate-700 hover:!border-slate-300 hover:!bg-slate-50", className)} {...props}>
    {Icon ? <Icon aria-hidden="true" className="size-4" /> : null}
    {children}
  </Button>;
}

/** Shared slot for an empty list or a recoverable list error. */
export function ListState({
  icon: Icon,
  title,
  description,
  action,
  role = "status",
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
  role?: "status" | "alert";
}) {
  return (
    <div className="list-state flex min-h-72 flex-col items-center justify-center px-5 py-10 text-center" role={role}>
      <div className="mb-4 flex size-11 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
        <Icon aria-hidden="true" className="size-5" strokeWidth={1.7} />
      </div>
      <h2 className="max-w-full break-words text-base font-bold leading-6 text-slate-900">{title}</h2>
      <p className="mt-2 max-w-md break-keep text-[length:var(--ui-text-body-sm-size)] font-normal leading-5 text-slate-500">{description}</p>
      {action ? <div className="mt-5 flex items-center justify-center">{action}</div> : null}
    </div>
  );
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
  error,
  actions,
  className,
  description = "잠시 후 다시 시도해 주세요. 문제가 계속되면 관리자에게 문의해 주세요.",
  onRetry,
  retryLabel = "다시 시도",
  requestId,
  requestIdLabel = "요청 번호",
  title = "내용을 불러올 수 없습니다",
  headingAs: Heading = "h3",
}: ErrorStateProps) {
  const errorRequestId = requestId ?? (error instanceof ApiClientHttpError ? error.requestId : undefined);
  return (
    <div
      className={cn(
        "data-error-state flex min-h-64 flex-col items-center justify-center px-6 py-10 text-center",
        className,
      )}
      role="alert"
    >
      <RefreshCw aria-hidden="true" className="mb-5 size-8 text-slate-400" strokeWidth={1.6} />
      <Heading className={cn("max-w-full break-words font-semibold text-slate-800", Heading === "h1" ? "text-xl leading-7" : "text-base leading-6")}>{title}</Heading>
      <p className="mt-2 max-w-full break-words whitespace-pre-line text-sm font-normal leading-6 text-slate-500">
        {description}
      </p>
      {errorRequestId ? <p className="mt-3 max-w-full break-all text-xs text-slate-500">{requestIdLabel}: {errorRequestId}</p> : null}
      {onRetry || actions ? <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
      {onRetry ? (
        <Button
          onClick={onRetry}
          type="button"
          variant="default"
        >
          {retryLabel}
        </Button>
      ) : null}
      {actions}
      </div> : null}
    </div>
  );
}
