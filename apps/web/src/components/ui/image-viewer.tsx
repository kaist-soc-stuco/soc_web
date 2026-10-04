import { useEffect, useRef, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { Modal } from "./modal";
import { IconButton } from "./icon-button";
import { useMediaQuery } from "@/hooks/use-media-query";

const FULL_IMAGE_BOUNDS = { x: 0, y: 0, width: 1, height: 1 };

/** Image-only zoom surface. Pointer gestures never zoom the page behind it. */
export function ImageViewer({ open, onClose, src, title, lang, mobileContentBounds }: {
  open: boolean; onClose: () => void; src: string; title: string; lang: string;
  mobileContentBounds?: { x: number; y: number; width: number; height: number };
}) {
  const isMobile = useMediaQuery("(max-width: 767px)");
  const bounds = isMobile ? mobileContentBounds ?? FULL_IMAGE_BOUNDS : undefined;
  const [zoom, setZoom] = useState(1);
  const [imageSize, setImageSize] = useState({ width: 1600, height: 900 });
  const viewportRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef(1);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  useEffect(() => {
    if (open) {
      const initialZoom = bounds && bounds !== FULL_IMAGE_BOUNDS ? 1.6 : 1;
      setZoom(initialZoom); zoomRef.current = initialZoom;
    }
    pointers.current.clear();
  }, [open, bounds]);

  const changeZoom = (next: number, x?: number, y?: number) => {
    const viewport = viewportRef.current;
    const value = Math.min(4, Math.max(1, next));
    if (!viewport || value === zoomRef.current) return;
    const rect = viewport.getBoundingClientRect();
    const focusX = x === undefined ? viewport.clientWidth / 2 : x - rect.left;
    const focusY = y === undefined ? viewport.clientHeight / 2 : y - rect.top;
    const ratio = value / zoomRef.current;
    const left = (viewport.scrollLeft + focusX) * ratio - focusX;
    const top = (viewport.scrollTop + focusY) * ratio - focusY;
    zoomRef.current = value;
    setZoom(value);
    requestAnimationFrame(() => { viewport.scrollLeft = left; viewport.scrollTop = top; });
  };

  return <Modal open={open} onClose={onClose} title={title} mobileFullscreen className="image-viewer !h-[calc(100dvh-3rem)] !max-h-none !max-w-[calc(100vw-3rem)] max-sm:!h-dvh max-sm:!max-w-none" bodyClassName="!flex-1 !overflow-hidden !p-0" headerActions={<>
    <IconButton aria-label={lang === "ko" ? "축소" : "Zoom out"} disabled={zoom <= 1} onClick={() => changeZoom(zoom / 1.5)}><Minus aria-hidden="true" /></IconButton>
    <span className="w-12 text-center text-xs tabular-nums text-slate-500" aria-live="polite">{Math.round(zoom * 100)}%</span>
    <IconButton aria-label={lang === "ko" ? "확대" : "Zoom in"} disabled={zoom >= 4} onClick={() => changeZoom(zoom * 1.5)}><Plus aria-hidden="true" /></IconButton>
  </>}>
    <div ref={viewportRef} className={`h-full overflow-auto overscroll-contain bg-slate-50 touch-none ${isMobile ? "scrollbar-hidden" : ""}`} style={{ cursor: zoom > 1 ? "grab" : "default" }}
      onPointerDown={event => {
        event.currentTarget.setPointerCapture(event.pointerId);
        pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
      }}
      onPointerMove={event => {
        const previous = pointers.current.get(event.pointerId);
        if (!previous) return;
        const before = [...pointers.current.values()];
        pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
        const after = [...pointers.current.values()];
        if (after.length === 2) {
          const distance = (points: typeof after) => Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
          const oldDistance = distance(before);
          if (oldDistance > 0) changeZoom(zoomRef.current * distance(after) / oldDistance, (after[0].x + after[1].x) / 2, (after[0].y + after[1].y) / 2);
        } else if (after.length === 1) {
          event.currentTarget.scrollLeft -= event.clientX - previous.x;
          event.currentTarget.scrollTop -= event.clientY - previous.y;
        }
      }}
      onPointerUp={event => pointers.current.delete(event.pointerId)}
      onPointerCancel={event => pointers.current.delete(event.pointerId)}
      onLostPointerCapture={event => pointers.current.delete(event.pointerId)}
      onDoubleClick={event => changeZoom(zoomRef.current > 1 ? 1 : 2, event.clientX, event.clientY)}>
      {bounds ? <div className="image-viewer-mobile-canvas" style={{ width: `${zoom * 100}%` }}>
        <div className="relative w-full overflow-hidden" style={{ aspectRatio: `${imageSize.width * bounds.width} / ${imageSize.height * bounds.height}` }}>
          <img src={src} alt={title} draggable={false} className="absolute block !max-w-none select-none"
            style={{ width: `${100 / bounds.width}%`, left: `${-bounds.x / bounds.width * 100}%`, top: `${-bounds.y / bounds.height * 100}%` }}
            onLoad={event => {
              const image = event.currentTarget;
              setImageSize({ width: image.naturalWidth, height: image.naturalHeight });
              requestAnimationFrame(() => {
                const viewport = viewportRef.current;
                if (viewport) viewport.scrollLeft = (viewport.scrollWidth - viewport.clientWidth) / 2;
              });
            }} />
        </div>
      </div> : <img src={src} alt={title} draggable={false} className="block !max-w-none select-none" style={{ width: `${zoom * 100}%` }} />}
    </div>
  </Modal>;
}
