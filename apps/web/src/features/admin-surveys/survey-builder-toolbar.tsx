import { useLayoutEffect, useRef, type ReactNode } from "react";

export function SurveyBuilderToolbar({ active, selectionKey, children }: { active: boolean; selectionKey: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const positionedRef = useRef(false);
  useLayoutEffect(() => {
    const rail = ref.current;
    const workspace = rail?.closest<HTMLElement>(".survey-editor-workspace");
    if (!rail || !workspace) return;
    let frame = 0;
    let revealFrame = 0;
    if (!active) {
      positionedRef.current = false;
      rail.dataset.positioned = "false";
      return;
    }
    const applyPosition = () => {
      if (window.innerWidth < 768) {
        rail.style.removeProperty("left");
        rail.style.removeProperty("top");
        rail.removeAttribute("data-positioned");
        positionedRef.current = false;
        return;
      }

      const bounds = workspace.getBoundingClientRect();
      if (!bounds.width || !bounds.height) {
        positionedRef.current = false;
        rail.dataset.positioned = "false";
        cancelAnimationFrame(revealFrame);
        return;
      }
      const selected = workspace.querySelector<HTMLElement>(".question-inline-editor, .survey-section-surface.is-selected");
      const header = document.querySelector<HTMLElement>("[data-survey-editor-header]");
      const ceiling = Math.max(24, header?.getBoundingClientRect().bottom ?? 120) + 16;
      const floor = Math.min(window.innerHeight - rail.offsetHeight - 16, bounds.bottom - rail.offsetHeight);
      const firstPosition = !positionedRef.current;

      if (firstPosition) rail.dataset.positioned = "false";
      rail.style.left = `${bounds.right - rail.offsetWidth}px`;
      rail.style.top = `${Math.max(ceiling, Math.min(selected?.getBoundingClientRect().top ?? bounds.top, floor))}px`;
      positionedRef.current = true;

      if (firstPosition) {
        revealFrame = requestAnimationFrame(() => rail.dataset.positioned = "true");
      }
    };
    const place = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(applyPosition);
    };
    const update = () => place();
    const resize = new ResizeObserver(update);
    resize.observe(workspace);
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    // Calculate the first fixed position before the browser paints. Delaying
    // this until requestAnimationFrame makes the rail briefly appear at the
    // viewport's default (left) position when entering the Questions tab.
    applyPosition();
    return () => { cancelAnimationFrame(frame); cancelAnimationFrame(revealFrame); resize.disconnect(); window.removeEventListener("scroll", update, true); window.removeEventListener("resize", update); };
  }, [active, selectionKey]);
  return <div className="survey-editor-toolbar-slot"><div ref={ref} role="toolbar" className="survey-editor-floating-toolbar" aria-label="설문 편집 도구">{children}</div></div>;
}
