import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";

/** Keep the sheet mounted and scroll locked until its closing motion finishes. */
export function useSheetMotion(open: boolean, surfaceRef: RefObject<HTMLElement | null>, onClose: () => void, enabled: boolean) {
  const [present, setPresent] = useState(open);
  const animations = useRef<Animation[]>([]);
  const closing = useRef(false);
  const notifyOnClose = useRef(false);
  const dismissed = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const cancel = useCallback(() => {
    animations.current.forEach(animation => animation.cancel());
    animations.current = [];
  }, []);

  const close = useCallback((notify: boolean) => {
    notifyOnClose.current ||= notify;
    dismissed.current ||= notify;
    if (closing.current) return;
    const surface = surfaceRef.current;
    const finish = () => {
      setPresent(false);
      closing.current = false;
      if (notifyOnClose.current) onCloseRef.current();
      notifyOnClose.current = false;
    };
    if (!enabled || !surface || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      cancel();
      finish();
      return;
    }
    const transform = getComputedStyle(surface).transform;
    cancel();
    closing.current = true;
    surface.dataset.sheetState = "closing";
    surface.style.animation = "none";
    surface.style.transition = "none";
    const slide = surface.animate([
      { transform: transform === "none" ? "translateY(0)" : transform },
      { transform: "translateY(calc(100% + 1rem))" },
    ], { duration: 240, easing: "cubic-bezier(.32,0,.67,0)", fill: "forwards" });
    const scrim = surface.parentElement?.querySelector<HTMLElement>(":scope > button");
    animations.current = [slide];
    if (scrim) animations.current.push(scrim.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 240, fill: "forwards" }));
    slide.onfinish = finish;
  }, [cancel, enabled, surfaceRef]);

  useLayoutEffect(() => {
    if (!open) dismissed.current = false;
    if (!present) {
      cancel();
      // Router-driven owners can acknowledge onClose in a later render. Do not
      // reopen the finished sheet while its previous open prop is still true.
      if (open && !dismissed.current) setPresent(true);
      return;
    }
    if (!open) { close(false); return; }
    cancel();
    closing.current = false;
    notifyOnClose.current = false;
    const surface = surfaceRef.current;
    if (!surface) return;
    surface.style.transform = "";
    surface.style.transition = "";
    if (!enabled) { surface.style.animation = ""; return; }
    surface.style.animation = "none";
    surface.dataset.sheetState = "open";
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    animations.current = [surface.animate([
      { transform: "translateY(100%)" },
      { transform: "translateY(0)" },
    ], { duration: 300, easing: "cubic-bezier(.2,.8,.2,1)" })];
  }, [cancel, close, enabled, open, present, surfaceRef]);

  useEffect(() => cancel, [cancel]);
  return { present: enabled ? present : open, requestClose: useCallback(() => close(true), [close]) };
}
