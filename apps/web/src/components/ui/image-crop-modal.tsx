import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { nowMs } from "@soc/shared";
import { Maximize2, Minus, Move, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";

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
  const frameRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const dragRef = useRef<{ point: CropPoint; offset: CropPoint } | null>(null);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [naturalSize, setNaturalSize] = useState({ height: 0, width: 0 });
  const [frameSize, setFrameSize] = useState({ height: 0, width: 0 });
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState<CropPoint>({ x: 0, y: 0 });
  const [processing, setProcessing] = useState(false);

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
    const frame = frameRef.current;
    if (!frame) return;
    const observer = new ResizeObserver(() => {
      setFrameSize({ height: frame.clientHeight, width: frame.clientWidth });
    });
    observer.observe(frame);
    setFrameSize({ height: frame.clientHeight, width: frame.clientWidth });
    return () => observer.disconnect();
  }, [sourceUrl]);

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
    if (!dragRef.current) return;
    setClampedOffset({
      x: dragRef.current.offset.x + event.clientX - dragRef.current.point.x,
      y: dragRef.current.offset.y + event.clientY - dragRef.current.point.y,
    });
  };

  const handleCrop = async () => {
    if (!file || !sourceUrl || !naturalSize.width || !naturalSize.height || !frameSize.width || !frameSize.height) return;
    setProcessing(true);
    try {
      const image = imageRef.current;
      if (!image) return;
      const scale = renderedSize.width / naturalSize.width;
      const renderedLeft = (frameSize.width - renderedSize.width) / 2 + offset.x;
      const renderedTop = (frameSize.height - renderedSize.height) / 2 + offset.y;
      const sourceX = Math.max(0, -renderedLeft / scale);
      const sourceY = Math.max(0, -renderedTop / scale);
      const sourceWidth = Math.min(naturalSize.width - sourceX, frameSize.width / scale);
      const sourceHeight = Math.min(naturalSize.height - sourceY, frameSize.height / scale);
      const canvas = document.createElement("canvas");
      canvas.width = outputWidth;
      canvas.height = outputHeight;
      const context = canvas.getContext("2d");
      if (!context) return;
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, outputWidth, outputHeight);
      const type = getOutputType(file);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, type === "image/jpeg" ? 0.92 : undefined));
      if (!blob) return;
      const baseName = file.name.replace(/\.[^/.]+$/, "");
      await onComplete(new File([blob], `${baseName}-cropped.${getOutputExtension(type)}`, { type, lastModified: nowMs() }));
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Modal
      open={Boolean(file)}
      onClose={onCancel}
      title="이미지 자르기"
      className="max-w-3xl"
      bodyClassName="space-y-4"
      footer={(
        <>
          <Button type="button" variant="outline" onClick={onCancel} disabled={processing}>취소</Button>
          <Button type="button" onClick={() => void handleCrop()} disabled={processing || !naturalSize.width}>
            {processing ? "적용 중" : "자르기 적용"}
          </Button>
        </>
      )}
    >
      <div className="space-y-3">
        <div
          ref={frameRef}
          className="relative mx-auto w-full max-w-[720px] touch-none select-none overflow-hidden rounded-xl bg-slate-950"
          style={{ aspectRatio: `${aspectRatio}` }}
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            dragRef.current = { point: { x: event.clientX, y: event.clientY }, offset };
          }}
          onPointerMove={handlePointerMove}
          onPointerUp={() => { dragRef.current = null; }}
          onPointerCancel={() => { dragRef.current = null; }}
        >
          {sourceUrl ? (
            <img
              ref={imageRef}
              src={sourceUrl}
              alt="자르기 대상 이미지"
              draggable={false}
              onLoad={(event) => setNaturalSize({ height: event.currentTarget.naturalHeight, width: event.currentTarget.naturalWidth })}
              className="pointer-events-none absolute max-w-none"
              style={{
                height: renderedSize.height,
                left: `calc(50% - ${renderedSize.width / 2}px + ${offset.x}px)`,
                top: `calc(50% - ${renderedSize.height / 2}px + ${offset.y}px)`,
                width: renderedSize.width,
              }}
            />
          ) : null}
          <div className="pointer-events-none absolute inset-0 border-[1.5px] border-white/90 shadow-[0_0_0_9999px_rgb(2_6_23_/_0.48)]" />
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-white/75">
            <Move aria-hidden="true" className="size-5" />
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-lg bg-slate-50 px-3 py-2.5 text-xs text-slate-600">
          <Maximize2 aria-hidden="true" className="size-4 shrink-0 text-slate-400" />
          <span className="min-w-0 flex-1">{outputWidth} × {outputHeight} 비율로 맞춰집니다. 이미지를 끌어 위치를 조정하세요.</span>
          <div className="flex shrink-0 items-center gap-1">
            <Button type="button" variant="ghost" size="icon" className="size-7" aria-label="축소" onClick={() => setZoom((value) => Math.max(1, value - 0.1))} disabled={zoom <= 1}><Minus aria-hidden="true" className="size-3.5" /></Button>
            <span className="w-10 text-center tabular-nums">{Math.round(zoom * 100)}%</span>
            <Button type="button" variant="ghost" size="icon" className="size-7" aria-label="확대" onClick={() => setZoom((value) => Math.min(3, value + 0.1))} disabled={zoom >= 3}><Plus aria-hidden="true" className="size-3.5" /></Button>
          </div>
        </div>
        <input
          aria-label="확대 비율"
          type="range"
          min="1"
          max="3"
          step="0.01"
          value={zoom}
          onChange={(event) => setZoom(Number(event.currentTarget.value))}
          className={cn("h-1.5 w-full accent-brand-primary")}
        />
      </div>
    </Modal>
  );
}
