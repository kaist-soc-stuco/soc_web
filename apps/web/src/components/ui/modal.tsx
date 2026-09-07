import { useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

import { IconButton } from "@/components/ui/icon-button";
import { useOverlayBehavior } from "@/components/ui/use-overlay-behavior";
import { cn } from "@/lib/utils";

export function Modal({
  children,
  className,
  bodyClassName,
  dividerless = false,
  footer,
  headerActions,
  onClose,
  open,
  showClose = true,
  title,
}: {
  children?: ReactNode;
  className?: string;
  bodyClassName?: string;
  dividerless?: boolean;
  footer?: ReactNode;
  headerActions?: ReactNode;
  onClose: () => void;
  open: boolean;
  showClose?: boolean;
  title: ReactNode;
}) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const handleOverlayKeyDown = useOverlayBehavior({
    onClose,
    open,
    surfaceRef,
  });

  if (!open) return null;

  return createPortal(
    <div className="ui-modal fixed inset-0 z-[70] flex items-end justify-center p-0 sm:items-center sm:px-4 sm:py-6">
      <button
        type="button"
        aria-label="닫기"
        tabIndex={-1}
        className="ui-modal__scrim absolute inset-0 bg-slate-950/40 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div
        ref={surfaceRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={handleOverlayKeyDown}
        className={cn(
          "ui-modal__surface relative flex max-h-[calc(100dvh-1rem)] w-full max-w-md flex-col overflow-hidden rounded-t-[var(--ui-panel-radius)] border border-[var(--ui-border-subtle)] bg-[var(--card)] shadow-[0_24px_80px_rgba(15,23,42,0.18)] sm:max-h-[calc(100dvh-3rem)] sm:rounded-[var(--ui-panel-radius)]",
          className,
        )}
      >
        <div
          className={cn(
            "ui-modal__header flex min-h-14 shrink-0 items-center justify-between gap-3",
            dividerless ? "px-6" : "px-5",
          )}
        >
          <h2 id={titleId} className="min-w-0 break-words text-lg font-semibold leading-6 text-[var(--ui-text-strong)]">{title}</h2>
          <div className="flex shrink-0 items-center gap-1.5">
            {headerActions}
            {showClose ? (
              <IconButton aria-label="닫기" onClick={onClose}>
                <X aria-hidden="true" />
              </IconButton>
            ) : null}
          </div>
        </div>
        {children ? <div className={cn("ui-modal__body scrollbar-hidden min-h-0 overflow-y-auto px-5 py-5", bodyClassName)}>{children}</div> : null}
        {footer ? (
          <div
            className={cn(
              "ui-modal__footer flex shrink-0 flex-wrap justify-end gap-2",
              dividerless
                ? "bg-transparent px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-0"
                : "bg-transparent px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-0",
            )}
          >
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
