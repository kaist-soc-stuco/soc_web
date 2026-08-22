import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

import { IconButton } from "@/components/ui/icon-button";
import { cn } from "@/lib/utils";

export function Modal({
  children,
  className,
  footer,
  onClose,
  open,
  title,
}: {
  children?: ReactNode;
  className?: string;
  footer?: ReactNode;
  onClose: () => void;
  open: boolean;
  title: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);

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
        role="dialog"
        aria-modal="true"
        className={cn(
          "ui-modal__surface relative flex max-h-[calc(100vh-3rem)] w-full max-w-md flex-col overflow-hidden rounded-[var(--ui-panel-radius)] border border-[var(--ui-border-subtle)] bg-[var(--card)] shadow-[0_24px_80px_rgba(15,23,42,0.18)]",
          className,
        )}
      >
        <div className="ui-modal__header flex min-h-14 shrink-0 items-center justify-between gap-3 border-b border-[var(--ui-border-subtle)] px-5">
          <h2 className="text-[15px] font-semibold leading-5 text-[var(--ui-text-strong)]">{title}</h2>
          <IconButton size="sm" aria-label="닫기" onClick={onClose}>
            <X aria-hidden="true" />
          </IconButton>
        </div>
        {children ? <div className="ui-modal__body min-h-0 overflow-y-auto px-5 py-5">{children}</div> : null}
        {footer ? <div className="ui-modal__footer flex shrink-0 justify-end gap-2 border-t border-[var(--ui-border-subtle)] bg-[color-mix(in_srgb,var(--ui-surface-muted)_30%,transparent)] px-5 py-3.5">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
}
