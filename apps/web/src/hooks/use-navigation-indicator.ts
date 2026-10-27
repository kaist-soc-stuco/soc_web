import { useLayoutEffect, useRef } from "react";

/** Align a sliding underline to visible label text, independent of hit-area padding and icons. */
export function useNavigationIndicator<T extends HTMLElement>(targetSelector: string | null, selectionKey: string | number | null = targetSelector) {
  const rootRef = useRef<T>(null);
  const indicatorRef = useRef<HTMLSpanElement>(null);
  const previous = useRef<{ left: number; width: number; rootWidth: number } | null>(null);
  const snapUntil = useRef(0);

  useLayoutEffect(() => {
    const root = rootRef.current;
    const indicator = indicatorRef.current;
    if (!root || !indicator) return;
    let cancelled = false;
    const update = (animate: boolean) => {
      const target = targetSelector ? root.querySelector<HTMLElement>(targetSelector) : null;
      const label = target && [...target.querySelectorAll<HTMLElement>("[data-nav-label]")].find(element => element.getBoundingClientRect().width > 0);
      const container = root.getBoundingClientRect();
      if (!label || !container.width) {
        indicator.style.opacity = "0";
        previous.current = null;
        return;
      }
      const bounds = label.getBoundingClientRect();
      // Rectangles include CSS zoom, while width/translate use local CSS pixels.
      const style = getComputedStyle(root);
      const localWidth = Number.parseFloat(style.width) + (style.boxSizing === "border-box" ? 0
        : Number.parseFloat(style.paddingLeft) + Number.parseFloat(style.paddingRight) + Number.parseFloat(style.borderLeftWidth) + Number.parseFloat(style.borderRightWidth));
      const scale = localWidth > 0 ? container.width / localWidth : 1;
      const left = (bounds.left - container.left) / scale + root.scrollLeft - root.clientLeft - 8;
      const width = bounds.width / scale + 16;
      const prior = previous.current;
      if (prior && Math.abs(prior.left - left) < .01 && Math.abs(prior.width - width) < .01 && prior.rootWidth === container.width) return;
      if (!prior || !animate || prior.rootWidth !== container.width) snapUntil.current = performance.now() + 250;
      // The first position and responsive/font reflows snap; only a selection change slides.
      // Scroll-spy selection can also change in the frame after a responsive reflow.
      const snap = !animate || !prior || prior.rootWidth !== container.width || performance.now() < snapUntil.current;
      indicator.style.transition = snap ? "none" : "";
      // Avoid magnifying fractional-pixel rounding on a 1px-wide element.
      indicator.style.width = `${width}px`;
      indicator.style.transform = `translateX(${left}px)`;
      indicator.style.opacity = "1";
      if (snap) {
        void indicator.offsetWidth;
        indicator.style.transition = "";
      }
      previous.current = { left, width, rootWidth: container.width };
    };
    update(true);
    const observer = new ResizeObserver(() => update(false));
    observer.observe(root);
    root.querySelectorAll("[data-nav-label]").forEach(label => observer.observe(label));
    const onResize = () => { snapUntil.current = performance.now() + 250; update(false); };
    window.addEventListener("resize", onResize);
    void document.fonts.ready.then(() => { if (!cancelled) update(false); });
    return () => {
      cancelled = true;
      observer.disconnect();
      window.removeEventListener("resize", onResize);
    };
  }, [targetSelector, selectionKey]);

  return { rootRef, indicatorRef };
}
