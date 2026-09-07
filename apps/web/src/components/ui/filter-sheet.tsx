import { useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { useOverlayBehavior } from "@/components/ui/use-overlay-behavior";

interface FilterSheetProps {
  children: ReactNode;
  closeLabel?: string;
  onClose: () => void;
  open: boolean;
  title: string;
}

export function FilterSheet({
  children,
  closeLabel = "필터 닫기",
  onClose,
  open,
  title,
}: FilterSheetProps) {
  const surfaceRef = useRef<HTMLElement>(null);
  const titleId = useId();
  const handleOverlayKeyDown = useOverlayBehavior({
    onClose,
    open,
    surfaceRef,
  });

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[120]">
        <Button
          type="button"
          variant="ghost"
          aria-label={closeLabel}
        tabIndex={-1}
        className="absolute inset-0 h-full w-full rounded-none bg-slate-950/35 p-0 hover:bg-slate-950/35"
        onClick={onClose}
      />
      <section
        ref={surfaceRef}
        aria-modal="true"
        aria-labelledby={titleId}
        role="dialog"
        tabIndex={-1}
        onKeyDown={handleOverlayKeyDown}
        className="scrollbar-hidden absolute inset-x-0 bottom-0 flex max-h-[min(82dvh,42rem)] flex-col overflow-hidden rounded-t-[18px] bg-white px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 shadow-elevated sm:inset-y-0 sm:inset-x-auto sm:right-0 sm:max-w-md sm:rounded-none sm:border-l sm:border-slate-200 sm:pt-5"
      >
        <div className="mb-5 flex shrink-0 items-center justify-between gap-3">
          <h2 id={titleId} className="min-w-0 break-words text-[length:var(--ui-text-title-sm-size)] font-semibold leading-6 text-app-text-strong">
            {title}
          </h2>
          <IconButton tone="navigation" aria-label={closeLabel} onClick={onClose}>
            <X aria-hidden="true" />
          </IconButton>
        </div>
        <div className="scrollbar-hidden min-h-0 flex-1 overflow-y-auto">
          {children}
        </div>
      </section>
    </div>,
    document.body,
  );
}
