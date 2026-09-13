import { useLayoutEffect, useRef, type ReactNode } from "react";

export function SurveyBuilderToolbar({ selectionKey, children }: { selectionKey: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const rail = ref.current;
    const workspace = rail?.closest<HTMLElement>(".survey-editor-workspace");
    if (!rail || !workspace) return;
    let frame = 0;
    const place = (animate = false) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (window.innerWidth < 768) { rail.style.removeProperty("left"); rail.style.removeProperty("top"); return; }
        const bounds = workspace.getBoundingClientRect();
        const selected = workspace.querySelector<HTMLElement>(".question-inline-editor, .survey-section-surface.is-selected");
        const header = document.querySelector<HTMLElement>("[data-survey-editor-header]");
        const ceiling = Math.max(24, header?.getBoundingClientRect().bottom ?? 120) + 16;
        const floor = Math.min(window.innerHeight - rail.offsetHeight - 16, bounds.bottom - rail.offsetHeight);
        rail.style.transition = animate && !matchMedia("(prefers-reduced-motion: reduce)").matches ? "top 160ms ease" : "none";
        rail.style.left = `${bounds.right - rail.offsetWidth}px`;
        rail.style.top = `${Math.max(ceiling, Math.min(selected?.getBoundingClientRect().top ?? bounds.top, floor))}px`;
      });
    };
    const update = () => place();
    const resize = new ResizeObserver(update);
    resize.observe(workspace);
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    place(true);
    return () => { cancelAnimationFrame(frame); resize.disconnect(); window.removeEventListener("scroll", update, true); window.removeEventListener("resize", update); };
  }, [selectionKey]);
  return <div className="survey-editor-toolbar-slot"><div ref={ref} role="toolbar" className="survey-editor-floating-toolbar" aria-label="설문 편집 도구">{children}</div></div>;
}
