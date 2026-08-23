import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";

interface FilterSheetProps {
  children: ReactNode;
  onClose: () => void;
  open: boolean;
  title: string;
}

export function FilterSheet({ children, onClose, open, title }: FilterSheetProps) {
  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, open]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[120] md:hidden">
      <Button
        type="button"
        variant="ghost"
        aria-label="필터 닫기"
        className="absolute inset-0 h-full w-full rounded-none bg-slate-950/35 p-0 hover:bg-slate-950/35"
        onClick={onClose}
      />
      <section
        aria-modal="true"
        aria-labelledby="mobile-filter-sheet-title"
        role="dialog"
        className="scrollbar-hidden absolute inset-x-0 bottom-0 max-h-[82dvh] overflow-y-auto rounded-t-[18px] bg-white px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 shadow-elevated"
      >
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2 id="mobile-filter-sheet-title" className="text-[length:var(--ui-text-title-sm-size)] font-semibold leading-6 text-app-text-strong">
            {title}
          </h2>
          <IconButton size="sm" tone="navigation" aria-label="필터 닫기" onClick={onClose}>
            <X aria-hidden="true" />
          </IconButton>
        </div>
        {children}
      </section>
    </div>,
    document.body,
  );
}
