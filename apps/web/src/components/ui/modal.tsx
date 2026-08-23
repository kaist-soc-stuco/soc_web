import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

import { IconButton } from "@/components/ui/icon-button";
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
  const previousActiveElementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);

  useEffect(() => {
    if (!open) return;
    previousActiveElementRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusFrame = window.requestAnimationFrame(() => {
      surfaceRef.current?.focus({ preventScroll: true });
    });
    return () => {
      window.cancelAnimationFrame(focusFrame);
      const previous = previousActiveElementRef.current;
      previousActiveElementRef.current = null;
      if (previous && document.contains(previous)) {
        window.requestAnimationFrame(() => previous.focus({ preventScroll: true }));
      }
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div className="ui-modal fixed inset-0 z-[70] flex items-center justify-center px-4 py-6">
      <button
        type="button"
        aria-label="닫기"
        className="ui-modal__scrim absolute inset-0 bg-slate-950/40 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div
        ref={surfaceRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className={cn(
          "ui-modal__surface relative flex max-h-[calc(100vh-3rem)] w-full max-w-md flex-col overflow-hidden rounded-[var(--ui-panel-radius)] border border-[var(--ui-border-subtle)] bg-[var(--card)] shadow-[0_24px_80px_rgba(15,23,42,0.18)]",
          className,
        )}
      >
        <div
          className={cn(
            "ui-modal__header flex min-h-14 shrink-0 items-center justify-between gap-3",
            dividerless ? "px-6" : "px-5",
          )}
        >
          <h2 className="text-[length:var(--ui-text-title-sm-size)] font-semibold leading-6 text-[var(--ui-text-strong)]">{title}</h2>
          <div className="flex shrink-0 items-center gap-1.5">
            {headerActions}
            {showClose ? (
              <IconButton size="sm" aria-label="닫기" onClick={onClose}>
                <X aria-hidden="true" />
              </IconButton>
            ) : null}
          </div>
        </div>
        {children ? <div className={cn("ui-modal__body scrollbar-hidden min-h-0 overflow-y-auto px-5 py-5", bodyClassName)}>{children}</div> : null}
        {footer ? (
          <div
            className={cn(
              "ui-modal__footer flex shrink-0 justify-end gap-2",
              dividerless
                ? "bg-transparent px-6 pb-6 pt-0"
                : "bg-transparent px-5 pb-5 pt-0",
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
