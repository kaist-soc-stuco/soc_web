import { X } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { IconButton } from "@/components/ui/icon-button";
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
    <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label="닫기"
        className="absolute inset-0 h-full w-full bg-slate-950/25 backdrop-blur-[1px]"
        onClick={onClose}
      />
      <section
        className={cn(
          "absolute inset-y-0 right-0 flex w-full flex-col border-l border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.2)]",
          width,
        )}
      >
        <header className="flex min-h-16 items-center justify-between gap-4 px-5">
          <h2 className="min-w-0 truncate text-[length:var(--ui-text-title-sm-size)] font-semibold leading-6 text-[var(--ui-text-strong)]">{title}</h2>
          <IconButton size="sm" aria-label="닫기" onClick={onClose}>
            <X aria-hidden="true" />
          </IconButton>
        </header>
        <div className="scrollbar-hidden min-h-0 flex-1 overflow-y-auto px-5 py-5">{children}</div>
        {footer ? <footer className="px-5 pb-5 pt-0">{footer}</footer> : null}
      </section>
    </div>,
    document.body,
  );
}
