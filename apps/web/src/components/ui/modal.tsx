import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

import { IconButton } from "@/components/ui/icon-button";
import { useOverlayBehavior } from "@/components/ui/use-overlay-behavior";
import { cn } from "@/lib/utils";

export function Modal({
  children,
  className,
  bodyClassName,
  footer,
  headerActions,
  mobileFullscreen = false,
  onClose,
  open,
  showClose = true,
  size = "standard",
  title,
}: {
  children?: ReactNode;
  className?: string;
  bodyClassName?: string;
  dividerless?: boolean;
  footer?: ReactNode;
  headerActions?: ReactNode;
  mobileFullscreen?: boolean;
  onClose: () => void;
  open: boolean;
  showClose?: boolean;
  size?: "compact" | "standard" | "wide";
  title: ReactNode;
}) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const handleOverlayKeyDown = useOverlayBehavior({
    onClose,
    open,
    surfaceRef,
  });

  useEffect(() => {
    if (!open || typeof document === "undefined") return;

    document.body.classList.add("ui-modal-open");
    return () => document.body.classList.remove("ui-modal-open");
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div className={cn("ui-modal fixed inset-0 z-[70] flex items-center justify-center p-4 sm:py-6", mobileFullscreen && "max-sm:p-0")}>
      <button
        type="button"
        aria-label="닫기"
        tabIndex={-1}
        className="ui-modal__scrim absolute inset-0 bg-slate-950/30"
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
          "ui-modal__surface relative flex max-h-[calc(100dvh-1rem)] w-full flex-col overflow-hidden rounded-2xl border border-[var(--ui-border-subtle)] bg-[var(--card)] shadow-[0_16px_48px_rgba(15,23,42,0.14)] sm:max-h-[calc(100dvh-3rem)] ",
          size === "compact" ? "max-w-[var(--ui-modal-width-compact)]"
            : size === "wide" ? "max-w-[var(--ui-modal-width-wide)]"
            : "max-w-[var(--ui-modal-width-standard)]",
          mobileFullscreen && "ui-modal__surface--mobile-fullscreen",
          className,
        )}
      >
        <div
          className={cn(
            "ui-modal__header flex shrink-0 items-center justify-between gap-3 px-5 pt-5",
          )}
        >
          <h2 id={titleId} className="min-w-0 break-words text-xl font-semibold leading-7 text-[var(--ui-text-strong)]">{title}</h2>
          <div className="flex shrink-0 items-center gap-1.5">
            {headerActions}
            {showClose ? (
              <IconButton aria-label="닫기" onClick={onClose} tone="navigation">
                <X aria-hidden="true" />
              </IconButton>
            ) : null}
          </div>
        </div>
        {children ? <div className={cn("ui-modal__body scrollbar-hidden min-h-0 overflow-y-auto px-5 pt-4 text-sm font-normal leading-6 text-slate-600", footer ? "pb-2" : "pb-5", bodyClassName)}>{children}</div> : null}
        {footer ? (
          <div
            className={cn(
              "ui-modal__footer flex shrink-0 flex-wrap justify-end gap-2 bg-transparent px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4",
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
