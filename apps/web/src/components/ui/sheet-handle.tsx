import { useEffect, useRef, type PointerEvent } from "react";

export function SheetHandle({ onClose }: { onClose: () => void }) {
  const drag = useRef<{ startY: number; offset: number; lastY: number; lastTime: number; velocity: number; surface: HTMLElement } | null>(null);
  const animation = useRef<Animation | null>(null);
  useEffect(() => () => animation.current?.cancel(), []);
  const finish = (event: PointerEvent<HTMLDivElement>, cancelled = false) => {
    const current = drag.current;
    if (!current) return;
    drag.current = null;
    const distance = event.clientY - current.startY;
    if (!cancelled && (distance > 64 || (distance > 20 && current.velocity > .5 && event.timeStamp - current.lastTime < 100))) {
      onClose();
      return;
    }
    const transform = current.surface.style.transform || "translateY(0)";
    current.surface.style.transform = "";
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      animation.current = current.surface.animate([{ transform }, { transform: "translateY(0)" }], { duration: 300, easing: "cubic-bezier(.16,1,.3,1)" });
    }
  };

  return <div className="mobile-sheet-handle" aria-hidden="true"
    onPointerDown={event => {
      if (event.button !== 0 || drag.current) return;
      const surface = event.currentTarget.closest<HTMLElement>('[role="dialog"]');
      if (!surface || surface.dataset.sheetState === "closing") return;
      const transform = getComputedStyle(surface).transform;
      const offset = Math.max(0, transform === "none" ? 0 : new DOMMatrixReadOnly(transform).m42);
      surface.getAnimations().forEach(motion => motion.cancel());
      surface.style.animation = "none";
      surface.style.transition = "none";
      surface.style.transform = `translateY(${offset}px)`;
      drag.current = { startY: event.clientY, offset, lastY: event.clientY, lastTime: event.timeStamp, velocity: 0, surface };
      event.currentTarget.setPointerCapture(event.pointerId);
    }}
    onPointerMove={event => {
      const current = drag.current;
      if (!current) return;
      const elapsed = event.timeStamp - current.lastTime;
      if (elapsed > 0) current.velocity = (event.clientY - current.lastY) / elapsed;
      current.lastY = event.clientY;
      current.lastTime = event.timeStamp;
      const delta = event.clientY - current.startY;
      // A bottom-anchored sheet must never lift above its resting position.
      current.surface.style.transform = `translateY(${Math.max(0, current.offset + delta)}px)`;
    }}
    onPointerUp={event => finish(event)} onPointerCancel={event => finish(event, true)} onLostPointerCapture={event => finish(event, true)}
  ><span /></div>;
}
