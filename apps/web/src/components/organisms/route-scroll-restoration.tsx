import { useEffect, useLayoutEffect, useRef } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

type Position = { x: number; y: number };

/** Restore history entries after async page content has enough height. */
export function RouteScrollRestoration() {
  const location = useLocation();
  const navigationType = useNavigationType();
  const positions = useRef(new Map<string, Position>());
  const previous = useRef<{ pathname: string; position: Position } | null>(null);

  useEffect(() => {
    const original = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";
    return () => { window.history.scrollRestoration = original; };
  }, []);

  useLayoutEffect(() => {
    const saved = navigationType === "POP" ? positions.current.get(location.key) : undefined;
    const preserve = previous.current?.pathname === location.pathname && location.state?.preserveScroll;
    const target = saved ?? (preserve ? previous.current!.position : { x: 0, y: 0 });
    let anchor: string | null = null;
    if (!saved && location.hash) {
      try { anchor = decodeURIComponent(location.hash.slice(1)); } catch { anchor = location.hash.slice(1); }
    }
    let pending = true;
    let lastPosition = target;
    let frame = 0;
    const stop = () => {
      pending = false;
      observer.disconnect();
      lastPosition = { x: window.scrollX, y: window.scrollY };
    };
    const restore = () => {
      if (!pending) return;
      if (anchor) {
        const element = document.getElementById(anchor);
        if (!element) return;
        element.scrollIntoView();
        stop();
      } else {
        window.scrollTo({ left: target.x, top: target.y, behavior: "instant" });
        if (document.documentElement.scrollHeight - window.innerHeight >= target.y) stop();
      }
    };
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(restore);
    });
    const record = () => {
      if (!pending) lastPosition = { x: window.scrollX, y: window.scrollY };
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "].includes(event.key)) stop();
    };
    observer.observe(document.body);
    restore();
    const timeout = window.setTimeout(stop, 10000);
    window.addEventListener("scroll", record, { passive: true });
    window.addEventListener("wheel", stop, { passive: true });
    window.addEventListener("touchstart", stop, { passive: true });
    window.addEventListener("pointerdown", stop, { passive: true });
    window.addEventListener("keydown", onKeyDown);
    return () => {
      positions.current.set(location.key, lastPosition);
      if (positions.current.size > 100) positions.current.delete(positions.current.keys().next().value!);
      previous.current = { pathname: location.pathname, position: lastPosition };
      observer.disconnect();
      cancelAnimationFrame(frame);
      window.clearTimeout(timeout);
      window.removeEventListener("scroll", record);
      window.removeEventListener("wheel", stop);
      window.removeEventListener("touchstart", stop);
      window.removeEventListener("pointerdown", stop);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [location.key, location.pathname, location.hash, location.state, navigationType]);

  return null;
}
