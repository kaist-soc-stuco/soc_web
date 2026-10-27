import { useLayoutEffect, useRef, type ReactNode } from "react";
import "./board-editor.css";

export function BoardEditorColumns({ editor, details }: { editor: ReactNode; details: ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const detailsRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const root = rootRef.current;
    const details = detailsRef.current;
    if (!root || !details) return;
    const update = () => root.style.setProperty("--board-editor-initial-height", `${details.getBoundingClientRect().height}px`);
    const observer = new ResizeObserver(update);
    observer.observe(details);
    update();
    return () => observer.disconnect();
  }, []);
  return <div ref={rootRef} className="board-editor-columns grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_26rem]">
    {editor}
    <div ref={detailsRef} className="board-editor-details min-w-0">{details}</div>
  </div>;
}
