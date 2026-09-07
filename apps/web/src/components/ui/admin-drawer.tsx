import { X } from "lucide-react";
import { useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { IconButton } from "@/components/ui/icon-button";
import { useOverlayBehavior } from "@/components/ui/use-overlay-behavior";
import { cn } from "@/lib/utils";

export function AdminDrawer({
  children,
  footer,
  onClose,
  open,
  title,
  width = "max-w-xl",
}: {
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
  open: boolean;
  title: ReactNode;
  width?: string;
}) {
  const surfaceRef = useRef<HTMLElement>(null);
  const titleId = useId();
  const handleOverlayKeyDown = useOverlayBehavior({
    onClose,
    open,
    surfaceRef,
  });

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[70]">
      <button
        type="button"
        aria-label="닫기"
        tabIndex={-1}
        className="absolute inset-0 h-full w-full bg-slate-950/25 backdrop-blur-[1px]"
        onClick={onClose}
      />
      <section
        ref={surfaceRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={handleOverlayKeyDown}
        className={cn(
          "absolute inset-y-0 right-0 flex w-full flex-col border-l border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.2)]",
          width,
        )}
      >
        <header className="flex min-h-16 items-center justify-between gap-4 px-5">
          <h2 id={titleId} className="min-w-0 break-words text-[length:var(--ui-text-title-sm-size)] font-semibold leading-6 text-[var(--ui-text-strong)]">{title}</h2>
          <IconButton aria-label="닫기" onClick={onClose}>
            <X aria-hidden="true" />
          </IconButton>
        </header>
        <div className="scrollbar-hidden min-h-0 flex-1 overflow-y-auto px-5 py-5">{children}</div>
        {footer ? <footer className="px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-0">{footer}</footer> : null}
      </section>
    </div>,
    document.body,
  );
}
