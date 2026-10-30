import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";

/** Retain the menu through its exit and continue from the current frame on reversal. */
export function useMenuMotion(open: boolean, surfaceRef: RefObject<HTMLElement | null>) {
  const [present, setPresent] = useState(open);
  const animationRef = useRef<Animation | null>(null);

  useLayoutEffect(() => {
    if (open && !present) { setPresent(true); return; }
    const surface = surfaceRef.current;
    if (!surface || !present) return;
    const previous = animationRef.current;
    const interrupted = previous?.playState === "running";
    const current = getComputedStyle(surface);
    const from = interrupted
      ? { opacity: current.opacity, transform: current.transform }
      : open
        ? { opacity: 0, transform: "translateY(-8px)" }
        : { opacity: 1, transform: "translateY(0)" };
    previous?.cancel();
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      if (!open) setPresent(false);
      return;
    }
    const animation = surface.animate([
      from,
      open ? { opacity: 1, transform: "translateY(0)" } : { opacity: 0, transform: "translateY(-8px)" },
    ], { duration: open ? 240 : 180, easing: "cubic-bezier(.2,.8,.2,1)", fill: "both" });
    animationRef.current = animation;
    animation.onfinish = () => { if (!open) setPresent(false); };
  }, [open, present, surfaceRef]);

  useEffect(() => () => animationRef.current?.cancel(), []);
  return present;
}
