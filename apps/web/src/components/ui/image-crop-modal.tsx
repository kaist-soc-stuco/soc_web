import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { nowMs } from "@soc/shared";
import { Minus, Move, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";

interface CropPoint {
  x: number;
  y: number;
}

interface CropRect {
  height: number;
  width: number;
  x: number;
  y: number;
}

interface ImageFrame {
  height: number;
  left: number;
  top: number;
  width: number;
}

type ResizeHandle = "e" | "n" | "ne" | "nw" | "s" | "se" | "sw" | "w";

type CropInteraction =
  | { kind: "move"; point: CropPoint; rect: CropRect }
  | { handle: ResizeHandle; kind: "resize"; point: CropPoint; rect: CropRect };

interface ImageCropModalProps {
  allowFreeAspectRatio?: boolean;
  aspectRatio: number;
  file: File | null;
  outputHeight: number;
  outputWidth: number;
  onCancel: () => void;
  onComplete: (file: File) => void | Promise<void>;
}

const STAGE_ASPECT_RATIO = 16 / 9;
const MIN_CROP_SIZE = 32;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const clampCropRect = (rect: CropRect, bounds: CropRect): CropRect => {
  const width = Math.min(Math.max(rect.width, MIN_CROP_SIZE), bounds.width);
  const height = Math.min(Math.max(rect.height, MIN_CROP_SIZE), bounds.height);

  return {
    height,
    width,
    x: clamp(rect.x, bounds.x, bounds.x + bounds.width - width),
    y: clamp(rect.y, bounds.y, bounds.y + bounds.height - height),
  };
};

const getInitialCropRect = (
  bounds: CropRect,
  aspectRatio: number,
  allowFreeAspectRatio: boolean,
): CropRect => {
  if (allowFreeAspectRatio) {
    const width = bounds.width * 0.82;
    const height = bounds.height * 0.82;
    return {
      height,
      width,
      x: bounds.x + (bounds.width - width) / 2,
      y: bounds.y + (bounds.height - height) / 2,
    };
  }

  const width = Math.min(bounds.width * 0.82, bounds.height * 0.82 * aspectRatio);
  const height = width / aspectRatio;
  return {
    height,
    width,
    x: bounds.x + (bounds.width - width) / 2,
    y: bounds.y + (bounds.height - height) / 2,
  };
};

function getOutputType(file: File) {
  if (file.type === "image/png" || file.type === "image/webp") return file.type;
  return "image/jpeg";
}

function getOutputExtension(type: string) {
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  return "jpg";
}

const HANDLE_STYLES: Record<ResizeHandle, { className: string; cursor: string }> = {
  nw: { className: "left-[-5px] top-[-5px]", cursor: "nwse-resize" },
  n: { className: "left-1/2 top-[-5px] -translate-x-1/2", cursor: "ns-resize" },
  ne: { className: "right-[-5px] top-[-5px]", cursor: "nesw-resize" },
  e: { className: "right-[-5px] top-1/2 -translate-y-1/2", cursor: "ew-resize" },
  se: { className: "bottom-[-5px] right-[-5px]", cursor: "nwse-resize" },
  s: { className: "bottom-[-5px] left-1/2 -translate-x-1/2", cursor: "ns-resize" },
  sw: { className: "bottom-[-5px] left-[-5px]", cursor: "nesw-resize" },
  w: { className: "left-[-5px] top-1/2 -translate-y-1/2", cursor: "ew-resize" },
};

const RESIZE_HANDLES: ResizeHandle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];

export function ImageCropModal({
  allowFreeAspectRatio = false,
  aspectRatio,
  file,
  outputHeight,
  outputWidth,
  onCancel,
  onComplete,
}: ImageCropModalProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const interactionRef = useRef<CropInteraction | null>(null);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [naturalSize, setNaturalSize] = useState({ height: 0, width: 0 });
  const [stageSize, setStageSize] = useState({ height: 0, width: 0 });
  const [zoom, setZoom] = useState(1);
  const [cropRect, setCropRect] = useState<CropRect | null>(null);
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
    setCropRect(null);
    interactionRef.current = null;
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
  }, [sourceUrl]);

  const imageFrame = useMemo<ImageFrame | null>(() => {
    if (!naturalSize.width || !naturalSize.height || !stageSize.width || !stageSize.height) {
      return null;
    }

    const scale = Math.max(
      stageSize.width / naturalSize.width,
      stageSize.height / naturalSize.height,
    ) * zoom;
    const width = naturalSize.width * scale;
    const height = naturalSize.height * scale;

    return {
      height,
      left: (stageSize.width - width) / 2,
      top: (stageSize.height - height) / 2,
      width,
    };
  }, [naturalSize.height, naturalSize.width, stageSize.height, stageSize.width, zoom]);

  const cropBounds = useMemo<CropRect | null>(() => {
    if (!imageFrame || !stageSize.width || !stageSize.height) return null;

    const left = Math.max(0, imageFrame.left);
    const top = Math.max(0, imageFrame.top);
    const right = Math.min(stageSize.width, imageFrame.left + imageFrame.width);
    const bottom = Math.min(stageSize.height, imageFrame.top + imageFrame.height);

    return {
      height: Math.max(0, bottom - top),
      width: Math.max(0, right - left),
      x: left,
      y: top,
    };
  }, [imageFrame, stageSize.height, stageSize.width]);

  useEffect(() => {
    if (!cropBounds || cropBounds.width <= MIN_CROP_SIZE || cropBounds.height <= MIN_CROP_SIZE) {
      return;
    }

    setCropRect((current) =>
      current
        ? clampCropRect(current, cropBounds)
        : getInitialCropRect(cropBounds, aspectRatio, allowFreeAspectRatio),
    );
  }, [allowFreeAspectRatio, aspectRatio, cropBounds]);

  const beginMove = (event: PointerEvent<HTMLElement>) => {
    if (!cropRect || processing) return;
    event.preventDefault();
    event.stopPropagation();
    stageRef.current?.setPointerCapture(event.pointerId);
    interactionRef.current = {
      kind: "move",
      point: { x: event.clientX, y: event.clientY },
      rect: cropRect,
    };
  };

  const beginResize = (event: PointerEvent<HTMLButtonElement>, handle: ResizeHandle) => {
    if (!cropRect || processing) return;
    event.preventDefault();
    event.stopPropagation();
    stageRef.current?.setPointerCapture(event.pointerId);
    interactionRef.current = {
      handle,
      kind: "resize",
      point: { x: event.clientX, y: event.clientY },
      rect: cropRect,
    };
  };

  const resizeCropRect = useCallback(
    (rect: CropRect, handle: ResizeHandle, delta: CropPoint, bounds: CropRect): CropRect => {
      const right = rect.x + rect.width;
      const bottom = rect.y + rect.height;
      let left = rect.x;
      let nextRight = right;
      let top = rect.y;
      let nextBottom = bottom;

      if (handle.includes("w")) left = clamp(rect.x + delta.x, bounds.x, right - MIN_CROP_SIZE);
      if (handle.includes("e")) nextRight = clamp(right + delta.x, rect.x + MIN_CROP_SIZE, bounds.x + bounds.width);
      if (handle.includes("n")) top = clamp(rect.y + delta.y, bounds.y, bottom - MIN_CROP_SIZE);
      if (handle.includes("s")) nextBottom = clamp(bottom + delta.y, rect.y + MIN_CROP_SIZE, bounds.y + bounds.height);

      return {
        height: nextBottom - top,
        width: nextRight - left,
        x: left,
        y: top,
      };
    },
    [],
  );

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const interaction = interactionRef.current;
    if (!interaction || !cropBounds) return;

    const delta = {
      x: event.clientX - interaction.point.x,
      y: event.clientY - interaction.point.y,
    };

    if (interaction.kind === "move") {
      setCropRect({
        ...interaction.rect,
        x: clamp(interaction.rect.x + delta.x, cropBounds.x, cropBounds.x + cropBounds.width - interaction.rect.width),
        y: clamp(interaction.rect.y + delta.y, cropBounds.y, cropBounds.y + cropBounds.height - interaction.rect.height),
      });
      return;
    }

    setCropRect(resizeCropRect(interaction.rect, interaction.handle, delta, cropBounds));
  };

  const finishPointerInteraction = (event: PointerEvent<HTMLDivElement>) => {
    if (stageRef.current?.hasPointerCapture(event.pointerId)) {
      stageRef.current.releasePointerCapture(event.pointerId);
    }
    interactionRef.current = null;
  };

  const handleCrop = async () => {
    if (!file || !sourceUrl || !imageFrame || !cropRect || !naturalSize.width || !naturalSize.height) return;

    setProcessing(true);
    try {
      const image = imageRef.current;
      if (!image) return;

      const scale = imageFrame.width / naturalSize.width;
      const sourceX = clamp((cropRect.x - imageFrame.left) / scale, 0, naturalSize.width);
      const sourceY = clamp((cropRect.y - imageFrame.top) / scale, 0, naturalSize.height);
      const sourceWidth = clamp(cropRect.width / scale, 1, naturalSize.width - sourceX);
      const sourceHeight = clamp(cropRect.height / scale, 1, naturalSize.height - sourceY);
      const finalHeight = allowFreeAspectRatio
        ? Math.max(1, Math.round(outputWidth * (sourceHeight / sourceWidth)))
        : outputHeight;
      const canvas = document.createElement("canvas");
      canvas.width = outputWidth;
      canvas.height = finalHeight;
      const context = canvas.getContext("2d");
      if (!context) return;

      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.drawImage(
        image,
        sourceX,
        sourceY,
        sourceWidth,
        sourceHeight,
        0,
        0,
        outputWidth,
        finalHeight,
      );

      const type = getOutputType(file);
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, type, type === "image/jpeg" ? 0.92 : undefined),
      );
      if (!blob) return;

      const baseName = file.name.replace(/\.[^/.]+$/, "");
      await onComplete(
        new File([blob], `${baseName}-cropped.${getOutputExtension(type)}`, {
          lastModified: nowMs(),
          type,
        }),
      );
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
          <Button type="button" onClick={() => void handleCrop()} disabled={processing || !naturalSize.width || !cropRect}>
            {processing ? "적용 중" : "자르기 적용"}
          </Button>
        </>
      )}
    >
      <div className="space-y-4">
        <div
          ref={stageRef}
          className="relative mx-auto w-full max-w-[720px] touch-none select-none overflow-hidden rounded-xl bg-slate-950"
          style={{ aspectRatio: `${STAGE_ASPECT_RATIO}` }}
          onPointerMove={handlePointerMove}
          onPointerUp={finishPointerInteraction}
          onPointerCancel={finishPointerInteraction}
        >
          {sourceUrl ? (
            <>
              <img
                ref={imageRef}
                src={sourceUrl}
                alt="자르기 대상 이미지"
                draggable={false}
                onLoad={(event) => setNaturalSize({ height: event.currentTarget.naturalHeight, width: event.currentTarget.naturalWidth })}
                className={imageFrame
                  ? "pointer-events-none absolute max-w-none select-none brightness-[0.42]"
                  : "pointer-events-none absolute inset-0 h-full w-full object-contain opacity-0"}
                style={imageFrame
                  ? {
                    height: imageFrame.height,
                    left: imageFrame.left,
                    top: imageFrame.top,
                    width: imageFrame.width,
                  }
                  : undefined}
              />

              {imageFrame && cropRect ? (
                <div
                  className="absolute cursor-move overflow-visible border-2 border-white shadow-[0_0_0_9999px_rgba(2,6,23,0.58)]"
                  style={{ height: cropRect.height, left: cropRect.x, top: cropRect.y, width: cropRect.width }}
                  onPointerDown={beginMove}
                >
                  <div className="pointer-events-none absolute inset-0 overflow-hidden">
                    <img
                      src={sourceUrl}
                      alt=""
                      draggable={false}
                      className="pointer-events-none absolute max-w-none select-none"
                      style={{
                        height: imageFrame.height,
                        left: imageFrame.left - cropRect.x,
                        top: imageFrame.top - cropRect.y,
                        width: imageFrame.width,
                      }}
                    />
                    <div
                      aria-hidden="true"
                      className="absolute inset-0"
                      style={{
                        backgroundImage: "linear-gradient(to right, rgba(255,255,255,0.58) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.58) 1px, transparent 1px)",
                        backgroundSize: "33.3333% 100%, 100% 33.3333%",
                      }}
                    />
                  </div>
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-white/80">
                    <Move aria-hidden="true" className="size-5 drop-shadow" />
                  </div>
                  {allowFreeAspectRatio ? RESIZE_HANDLES.map((handle) => {
                    const style = HANDLE_STYLES[handle];
                    return (
                      <button
                        key={handle}
                        type="button"
                        aria-label={`자르기 영역 ${handle} 크기 조절`}
                        className={`absolute z-10 size-2.5 rounded-full border border-white bg-white shadow ${style.className}`}
                        style={{ cursor: style.cursor }}
                        onPointerDown={(event) => beginResize(event, handle)}
                      />
                    );
                  }) : null}
                </div>
              ) : null}
              {!imageFrame ? (
                <div className="absolute inset-0 grid place-items-center text-sm text-white/70">이미지를 불러오는 중입니다.</div>
              ) : null}
            </>
          ) : (
            <div className="absolute inset-0 grid place-items-center text-sm text-white/70">이미지를 불러오는 중입니다.</div>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex min-w-0 items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 shrink-0 rounded-full"
              aria-label="축소"
              onClick={() => setZoom((value) => Math.max(1, value - 0.1))}
              disabled={zoom <= 1}
            >
              <Minus aria-hidden="true" className="size-3.5" />
            </Button>
            <input
              aria-label="확대 비율"
              type="range"
              min="1"
              max="3"
              step="0.01"
              value={zoom}
              onChange={(event) => setZoom(Number(event.currentTarget.value))}
              className="h-1.5 min-w-0 flex-1 accent-brand-primary"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 shrink-0 rounded-full"
              aria-label="확대"
              onClick={() => setZoom((value) => Math.min(3, value + 0.1))}
              disabled={zoom >= 3}
            >
              <Plus aria-hidden="true" className="size-3.5" />
            </Button>
            <output className="w-12 shrink-0 text-right text-sm tabular-nums text-slate-600">{Math.round(zoom * 100)}%</output>
          </div>
          <p className="text-xs text-slate-500">
            {allowFreeAspectRatio
              ? "선택 영역을 끌어 이동하고 모서리·변의 핸들로 자유롭게 조절하세요."
              : `${outputWidth} × ${outputHeight} 비율로 저장됩니다. 선택 영역을 끌어 위치를 조정하세요.`}
          </p>
        </div>
      </div>
    </Modal>
  );
}
