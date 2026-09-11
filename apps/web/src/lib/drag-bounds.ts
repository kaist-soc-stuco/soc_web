import type { Modifier } from "@dnd-kit/core";

// Keep translated items inside the current list and viewport, so they cannot grow scroll height.
export const restrictListDrag: Modifier = ({ transform, activeNodeRect, containerNodeRect, windowRect }) => {
  if (!activeNodeRect) return transform;
  const top = Math.max(containerNodeRect?.top ?? -Infinity, windowRect?.top ?? -Infinity);
  const bottom = Math.min(containerNodeRect?.bottom ?? Infinity, windowRect?.bottom ?? Infinity);
  return { ...transform, x: 0, y: Math.max(top - activeNodeRect.top, Math.min(transform.y, bottom - activeNodeRect.bottom)) };
};
