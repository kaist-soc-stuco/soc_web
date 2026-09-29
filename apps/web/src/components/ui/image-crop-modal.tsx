import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { nowMs } from "@soc/shared";
import { Minus, Plus, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { useLanguage } from "@/hooks/use-language";

interface CropPoint {
  x: number;
  y: number;
}

interface ImageCropModalProps {
  aspectRatio: number;
  file: File | null;
  outputHeight: number;
  outputWidth: number;
  onCancel: () => void;
  onComplete: (file: File) => void | Promise<void>;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function getOutputType(file: File) {
  if (file.type === "image/png" || file.type === "image/webp") return file.type;
  return "image/jpeg";
}

function getOutputExtension(type: string) {
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  return "jpg";
}

export function ImageCropModal({
  aspectRatio,
  file,
  outputHeight,
  outputWidth,
  onCancel,
  onComplete,
}: ImageCropModalProps) {
  const { lang } = useLanguage();
  const ko = lang === "ko";
  const { toast } = useToast();
  const stageRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const dragRef = useRef<{ point: CropPoint; offset: CropPoint } | null>(null);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [naturalSize, setNaturalSize] = useState({ height: 0, width: 0 });
  const [stageSize, setStageSize] = useState({ height: 0, width: 0 });
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState<CropPoint>({ x: 0, y: 0 });
  const [processing, setProcessing] = useState(false);
  const processingRef = useRef(false);

  useEffect(() => {
    if (!file) {
      setSourceUrl(null);
      return;
    }
    const nextUrl = URL.createObjectURL(file);
    setSourceUrl(nextUrl);
    setNaturalSize({ height: 0, width: 0 });
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    return () => URL.revokeObjectURL(nextUrl);
  }, [file]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const observer = new ResizeObserver(() => {
      setStageSize({ height: stage.clientHeight, width: stage.clientWidth });
    });
    observer.observe(stage);
    setStageSize({ height: stage.clientHeight, width: stage.clientWidth });
    return () => observer.disconnect();
  }, [aspectRatio, sourceUrl]);

  const frameSize = useMemo(() => {
    if (!stageSize.width || !stageSize.height || !aspectRatio) {
      return { height: 0, width: 0 };
    }
    const inset = Math.min(32, stageSize.width * 0.06);
    const width = Math.min(stageSize.width - inset * 2, (stageSize.height - inset * 2) * aspectRatio);
    return { height: width / aspectRatio, width };
  }, [aspectRatio, stageSize.height, stageSize.width]);

  const baseScale = useMemo(() => {
    if (!naturalSize.width || !naturalSize.height || !frameSize.width || !frameSize.height) return 1;
    return Math.max(frameSize.width / naturalSize.width, frameSize.height / naturalSize.height);
  }, [frameSize.height, frameSize.width, naturalSize.height, naturalSize.width]);

  const renderedSize = {
    height: naturalSize.height * baseScale * zoom,
    width: naturalSize.width * baseScale * zoom,
  };
  const maxOffset = {
    x: Math.max(0, (renderedSize.width - frameSize.width) / 2),
    y: Math.max(0, (renderedSize.height - frameSize.height) / 2),
  };

  const setClampedOffset = useCallback((next: CropPoint) => {
    setOffset({
      x: clamp(next.x, -maxOffset.x, maxOffset.x),
      y: clamp(next.y, -maxOffset.y, maxOffset.y),
    });
  }, [maxOffset.x, maxOffset.y]);

  useEffect(() => {
    setOffset((current) => {
      const next = {
        x: clamp(current.x, -maxOffset.x, maxOffset.x),
        y: clamp(current.y, -maxOffset.y, maxOffset.y),
      };
      return next.x === current.x && next.y === current.y ? current : next;
    });
  }, [maxOffset.x, maxOffset.y]);

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (processingRef.current || !dragRef.current) return;
    setClampedOffset({
      x: dragRef.current.offset.x + event.clientX - dragRef.current.point.x,
      y: dragRef.current.offset.y + event.clientY - dragRef.current.point.y,
    });
  };

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      if (processingRef.current) return;
      const step = event.deltaY < 0 ? 0.1 : -0.1;
      setZoom(value => clamp(Math.round((value + step) * 100) / 100, 1, 3));
    };
    stage.addEventListener("wheel", handleWheel, { passive: false });
    return () => stage.removeEventListener("wheel", handleWheel);
  }, [sourceUrl]);

  const handleCrop = async () => {
    if (
      processingRef.current ||
      !file ||
      !sourceUrl ||
      !naturalSize.width ||
      !naturalSize.height ||
      !stageSize.width ||
      !stageSize.height ||
      !frameSize.width ||
      !frameSize.height
    ) return;
    processingRef.current = true;
    setProcessing(true);
    try {
      const image = imageRef.current;
      if (!image) throw new Error("Image unavailable");
      const scale = renderedSize.width / naturalSize.width;
      const frameLeft = (stageSize.width - frameSize.width) / 2;
      const frameTop = (stageSize.height - frameSize.height) / 2;
      const renderedLeft = (stageSize.width - renderedSize.width) / 2 + offset.x;
      const renderedTop = (stageSize.height - renderedSize.height) / 2 + offset.y;
      const sourceX = Math.max(0, (frameLeft - renderedLeft) / scale);
      const sourceY = Math.max(0, (frameTop - renderedTop) / scale);
      const sourceWidth = Math.min(naturalSize.width - sourceX, frameSize.width / scale);
      const sourceHeight = Math.min(naturalSize.height - sourceY, frameSize.height / scale);
      const canvas = document.createElement("canvas");
      canvas.width = outputWidth;
      canvas.height = outputHeight;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas unavailable");
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, outputWidth, outputHeight);
      const type = getOutputType(file);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, type === "image/jpeg" ? 0.92 : undefined));
      if (!blob) throw new Error("Image conversion failed");
      const baseName = file.name.replace(/\.[^/.]+$/, "");
      onCancel();
      await onComplete(new File([blob], `${baseName}-cropped.${getOutputExtension(type)}`, { type, lastModified: nowMs() }));
    } catch {
      toast({ type: "error", message: ko ? "이미지를 처리하지 못했습니다. 다시 시도해 주세요." : "Could not process the image. Please try again." });
    } finally {
      processingRef.current = false;
      setProcessing(false);
    }
  };

  return (
    <Modal
      open={Boolean(file)}
      onClose={() => { if (!processingRef.current) onCancel(); }}
      showClose={!processing}
      title={ko ? "이미지 자르기" : "Crop image"}
      className="max-w-3xl"
      bodyClassName="space-y-4"
      footer={(
        <>
          <Button type="button" variant="outline" onClick={onCancel} disabled={processing}>{ko ? "취소" : "Cancel"}</Button>
          <Button type="button" onClick={() => void handleCrop()} disabled={processing || !naturalSize.width}>
            {ko ? "적용" : "Apply"}
          </Button>
        </>
      )}
    >
      <div className="space-y-3">
        <div
          ref={stageRef}
          style={{ aspectRatio }}
          tabIndex={processing ? -1 : 0}
          role="group"
          aria-label={ko ? "이미지 위치 조정. 방향키로 이동, Shift와 함께 누르면 크게 이동합니다." : "Image position. Use arrow keys to move, Shift for larger steps."}
          onKeyDown={(event) => {
            if (processingRef.current || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
            event.preventDefault();
            const step = event.shiftKey ? 20 : 4;
            setClampedOffset({x: offset.x + (event.key === "ArrowRight" ? step : event.key === "ArrowLeft" ? -step : 0), y: offset.y + (event.key === "ArrowDown" ? step : event.key === "ArrowUp" ? -step : 0)});
          }}
          className="relative mx-auto flex max-h-[52dvh] w-full max-w-[720px] touch-none select-none items-center justify-center overflow-hidden overscroll-contain rounded-lg bg-zinc-950 cursor-grab active:cursor-grabbing focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
          onPointerDown={(event) => {
            if (processingRef.current || event.button !== 0) return;
            event.currentTarget.focus();
            event.currentTarget.setPointerCapture(event.pointerId);
            dragRef.current = { point: { x: event.clientX, y: event.clientY }, offset };
          }}
          onPointerMove={handlePointerMove}
          onPointerUp={(event) => { dragRef.current = null; if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }}
          onLostPointerCapture={() => { dragRef.current = null; }}
          onPointerCancel={() => { dragRef.current = null; }}
        >
          {sourceUrl ? (
            <img
              ref={imageRef}
              src={sourceUrl}
              alt={ko ? "자르기 대상 이미지" : "Image to crop"}
              draggable={false}
              onLoad={(event) => setNaturalSize({ height: event.currentTarget.naturalHeight, width: event.currentTarget.naturalWidth })}
              onError={() => {
                setNaturalSize({ height: 0, width: 0 });
                toast({ type: "error", message: ko ? "이미지를 열지 못했습니다. 다른 파일을 선택해 주세요." : "Could not open the image. Choose another file." });
                onCancel();
              }}
              className="pointer-events-none absolute max-w-none select-none"
              style={{
                height: renderedSize.height,
                left: `calc(50% - ${renderedSize.width / 2}px + ${offset.x}px)`,
                top: `calc(50% - ${renderedSize.height / 2}px + ${offset.y}px)`,
                width: renderedSize.width,
              }}
            />
          ) : null}
          <div
            className="pointer-events-none absolute border border-white/90 shadow-[0_0_0_9999px_rgb(0_0_0_/_0.5)]"
            style={{
              height: frameSize.height,
              left: `calc(50% - ${frameSize.width / 2}px)`,
              top: `calc(50% - ${frameSize.height / 2}px)`,
              width: frameSize.width,
            }}
          >

          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500">
          <div className="flex min-w-0 flex-1 basis-56 items-center gap-2">
          <Button type="button" variant="ghost" size="icon" className="size-7 shrink-0" aria-label={ko ? "축소" : "Zoom out"} onClick={() => setZoom((value) => Math.max(1, value - 0.1))} disabled={processing || zoom <= 1}><Minus aria-hidden="true" className="size-3.5" /></Button>
          <span className="w-10 shrink-0 text-center tabular-nums">{Math.round(zoom * 100)}%</span>
          <Button type="button" variant="ghost" size="icon" className="size-7 shrink-0" aria-label={ko ? "확대" : "Zoom in"} onClick={() => setZoom((value) => Math.min(3, value + 0.1))} disabled={processing || zoom >= 3}><Plus aria-hidden="true" className="size-3.5" /></Button>
          <Button type="button" variant="ghost" size="icon" className="size-8 shrink-0" aria-label={ko ? "초기화" : "Reset"} disabled={processing || (zoom === 1 && offset.x === 0 && offset.y === 0)} onClick={() => { setZoom(1); setOffset({x:0,y:0}); }}><RotateCcw aria-hidden="true" className="size-4" /></Button>
          <input
            aria-label={ko ? "확대 비율" : "Zoom"}
            type="range"
            min="1"
            max="3"
            step="0.01"
            value={zoom}
            disabled={processing}
            onChange={(event) => setZoom(Number(event.currentTarget.value))}
            className="crop-zoom-slider min-w-12 flex-1"
          />
          </div>
          <span className="ml-auto shrink-0 font-mono text-xs text-slate-400">{outputWidth} × {outputHeight}px</span>
        </div>
      </div>
    </Modal>
  );
}
