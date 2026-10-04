import { useRef, type PointerEvent } from "react";

export function SheetHandle({ onClose }: { onClose: () => void }) {
  const drag = useRef<{ startY: number; surface: HTMLElement } | null>(null);
  const finish = (event: PointerEvent<HTMLDivElement>, cancelled = false) => {
    const current = drag.current;
    if (!current) return;
    drag.current = null;
    current.surface.style.transition = "transform 160ms ease-out";
    current.surface.style.transform = "";
    if (!cancelled && event.clientY - current.startY > 64) onClose();
  };

  return <div className="mobile-sheet-handle" aria-hidden="true"
    onPointerDown={event => {
      if (event.button !== 0) return;
      const surface = event.currentTarget.closest<HTMLElement>('[role="dialog"]');
      if (!surface) return;
      drag.current = { startY: event.clientY, surface };
      surface.style.transition = "none";
      event.currentTarget.setPointerCapture(event.pointerId);
    }}
    onPointerMove={event => {
      if (!drag.current) return;
      drag.current.surface.style.transform = `translateY(${Math.max(0, event.clientY - drag.current.startY)}px)`;
    }}
    onPointerUp={event => finish(event)} onPointerCancel={event => finish(event, true)}
  ><span /></div>;
}
