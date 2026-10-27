import { useEffect, useRef, type PointerEvent } from "react";

export function SheetHandle({ onClose }: { onClose: () => void }) {
  const drag = useRef<{ startY: number; surface: HTMLElement } | null>(null);
  const closing = useRef(false);
  const animations = useRef<Animation[]>([]);
  useEffect(() => () => { animations.current.forEach(animation => animation.cancel()); }, []);
  const finish = (event: PointerEvent<HTMLDivElement>, cancelled = false) => {
    const current = drag.current;
    if (!current) return;
    drag.current = null;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (cancelled || event.clientY - current.startY <= 64) {
      current.surface.style.transition = reducedMotion ? "none" : "transform 160ms ease-out";
      current.surface.style.transform = "";
      return;
    }
    if (reducedMotion) { onClose(); return; }
    closing.current = true;
    current.surface.style.transition = "none";
    const timing: KeyframeAnimationOptions = { duration: 220, easing: "cubic-bezier(.22,.61,.36,1)", fill: "forwards" };
    const slide = current.surface.animate([
      { transform: current.surface.style.transform || "translateY(0)", opacity: 1 },
      { transform: "translateY(calc(100% + 1rem))", opacity: 0 },
    ], timing);
    animations.current.push(slide);
    const backdrop = current.surface.parentElement?.querySelector<HTMLElement>(":scope > button");
    if (backdrop) animations.current.push(backdrop.animate([{ opacity: 1 }, { opacity: 0 }], timing));
    slide.onfinish = onClose;
  };

  return <div className="mobile-sheet-handle" aria-hidden="true"
    onPointerDown={event => {
      if (event.button !== 0 || closing.current || drag.current) return;
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
    onPointerUp={event => finish(event)} onPointerCancel={event => finish(event, true)} onLostPointerCapture={event => finish(event, true)}
  ><span /></div>;
}
