import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
} from "react";
import { nowMs } from "@soc/shared";
import { Minus, Plus, RotateCcw, RotateCw, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));
const MIN_ZOOM = 0.05;
const MAX_ZOOM = 3;
const checkerboardStyle = {
  backgroundColor: "#e2e8f0",
  backgroundImage:
    "conic-gradient(#cbd5e1 25%, transparent 0 50%, #cbd5e1 0 75%, transparent 0)",
  backgroundSize: "12px 12px",
};
type CropBackground = "white" | "black" | "transparent";

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
  const [rotation, setRotation] = useState(0);
  const [background, setBackground] = useState<CropBackground>("white");
  const [dragging, setDragging] = useState(false);
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
    setRotation(0);
    setBackground(
      file.type === "image/png" || file.type === "image/webp"
        ? "transparent"
        : "white",
    );
    setDragging(false);
    dragRef.current = null;
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
    const inset = Math.min(24, stageSize.width * 0.04, stageSize.height * 0.08);
    const width = Math.min(
      stageSize.width - inset * 2,
      (stageSize.height - inset * 2) * aspectRatio,
    );
    return { height: width / aspectRatio, width };
  }, [aspectRatio, stageSize.height, stageSize.width]);

  const rotatedSize =
    rotation % 2
      ? { width: naturalSize.height, height: naturalSize.width }
      : naturalSize;
  const baseScale =
    !rotatedSize.width ||
    !rotatedSize.height ||
    !frameSize.width ||
    !frameSize.height
      ? 1
      : Math.max(
          frameSize.width / rotatedSize.width,
          frameSize.height / rotatedSize.height,
        );
  const imageScale = baseScale * zoom;
  const exportWidth = outputWidth * 3;
  const exportHeight = outputHeight * 3;

  const renderedSize = {
    height: rotatedSize.height * imageScale,
    width: rotatedSize.width * imageScale,
  };
  const maxOffset = {
    x: Math.abs(renderedSize.width - frameSize.width) / 2,
    y: Math.abs(renderedSize.height - frameSize.height) / 2,
  };

  const setClampedOffset = useCallback(
    (next: CropPoint) => {
      setOffset({
        x: clamp(next.x, -maxOffset.x, maxOffset.x),
        y: clamp(next.y, -maxOffset.y, maxOffset.y),
      });
    },
    [maxOffset.x, maxOffset.y],
  );

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
      setZoom((value) =>
        clamp(Math.round((value + step) * 100) / 100, MIN_ZOOM, MAX_ZOOM),
      );
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
    )
      return;
    processingRef.current = true;
    setProcessing(true);
    try {
      const image = imageRef.current;
      if (!image) throw new Error("Image unavailable");
      const canvas = document.createElement("canvas");
      canvas.width = exportWidth;
      canvas.height = exportHeight;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas unavailable");
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      if (background !== "transparent") {
        context.fillStyle = background === "white" ? "#ffffff" : "#000000";
        context.fillRect(0, 0, exportWidth, exportHeight);
      }
      // Draw the full image at preview scale; canvas clipping preserves crop and uncovered margins.
      const exportScale = exportWidth / frameSize.width;
      context.translate(
        exportWidth / 2 + offset.x * exportScale,
        exportHeight / 2 + offset.y * exportScale,
      );
      context.rotate((rotation * Math.PI) / 2);
      const width = naturalSize.width * imageScale * exportScale;
      const height = naturalSize.height * imageScale * exportScale;
      context.drawImage(image, -width / 2, -height / 2, width, height);
      const type =
        background === "transparent" ? "image/png" : getOutputType(file);
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, type, type === "image/jpeg" ? 0.92 : undefined),
      );
      if (!blob) throw new Error("Image conversion failed");
      const baseName = file.name.replace(/\.[^/.]+$/, "");
      onCancel();
      await onComplete(
        new File([blob], `${baseName}-cropped.${getOutputExtension(type)}`, {
          type,
          lastModified: nowMs(),
        }),
      );
    } catch {
      toast({
        type: "error",
        message: ko
          ? "이미지를 처리하지 못했습니다. 다시 시도해 주세요."
          : "Could not process the image. Please try again.",
      });
    } finally {
      processingRef.current = false;
      setProcessing(false);
    }
  };

  return (
    <Modal
      open={Boolean(file)}
      onClose={() => {
        if (!processingRef.current) onCancel();
      }}
      showClose={!processing}
      title={ko ? "이미지 자르기" : "Crop image"}
      headerActions={<Badge className="h-6 whitespace-nowrap px-2 text-xs tabular-nums">{exportWidth} × {exportHeight}px</Badge>}
      size="wide"
      bodyClassName="space-y-4"
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={processing}
          >
            {ko ? "취소" : "Cancel"}
          </Button>
          <Button
            type="button"
            onClick={() => void handleCrop()}
            disabled={processing || !naturalSize.width}
          >
            {ko ? "적용" : "Apply"}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div
          ref={stageRef}
          style={{ aspectRatio }}
          tabIndex={processing ? -1 : 0}
          role="group"
          aria-label={
            ko
              ? "이미지 위치 조정. 방향키로 이동, Shift와 함께 누르면 크게 이동합니다."
              : "Image position. Use arrow keys to move, Shift for larger steps."
          }
          onKeyDown={(event) => {
            if (
              processingRef.current ||
              !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(
                event.key,
              )
            )
              return;
            event.preventDefault();
            const step = event.shiftKey ? 20 : 4;
            setClampedOffset({
              x:
                offset.x +
                (event.key === "ArrowRight"
                  ? step
                  : event.key === "ArrowLeft"
                    ? -step
                    : 0),
              y:
                offset.y +
                (event.key === "ArrowDown"
                  ? step
                  : event.key === "ArrowUp"
                    ? -step
                    : 0),
            });
          }}
          className="relative mx-auto flex max-h-[52dvh] w-full max-w-[720px] touch-none select-none items-center justify-center overflow-hidden overscroll-contain rounded-lg bg-slate-900 cursor-grab active:cursor-grabbing focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
          onPointerDown={(event) => {
            if (processingRef.current || event.button !== 0) return;
            event.currentTarget.focus();
            event.currentTarget.setPointerCapture(event.pointerId);
            dragRef.current = {
              point: { x: event.clientX, y: event.clientY },
              offset,
            };
            setDragging(true);
          }}
          onPointerMove={handlePointerMove}
          onPointerUp={(event) => {
            dragRef.current = null;
            setDragging(false);
            if (event.currentTarget.hasPointerCapture(event.pointerId))
              event.currentTarget.releasePointerCapture(event.pointerId);
          }}
          onLostPointerCapture={() => {
            dragRef.current = null;
            setDragging(false);
          }}
          onPointerCancel={() => {
            dragRef.current = null;
            setDragging(false);
          }}
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute"
            style={{
              width: frameSize.width,
              height: frameSize.height,
              left: (stageSize.width - frameSize.width) / 2,
              top: (stageSize.height - frameSize.height) / 2,
              ...(background === "transparent"
                ? checkerboardStyle
                : {
                    backgroundColor: background === "white" ? "#fff" : "#000",
                  }),
            }}
          />
          {sourceUrl ? (
            <img
              ref={imageRef}
              src={sourceUrl}
              alt={ko ? "자르기 대상 이미지" : "Image to crop"}
              draggable={false}
              onLoad={(event) =>
                setNaturalSize({
                  height: event.currentTarget.naturalHeight,
                  width: event.currentTarget.naturalWidth,
                })
              }
              onError={() => {
                setNaturalSize({ height: 0, width: 0 });
                toast({
                  type: "error",
                  message: ko
                    ? "이미지를 열지 못했습니다. 다른 파일을 선택해 주세요."
                    : "Could not open the image. Choose another file.",
                });
                onCancel();
              }}
              className="pointer-events-none absolute max-w-none select-none"
              style={{
                height: naturalSize.height * imageScale,
                left: `calc(50% + ${offset.x}px)`,
                top: `calc(50% + ${offset.y}px)`,
                width: naturalSize.width * imageScale,
                transform: `translate(-50%, -50%) rotate(${rotation * 90}deg)`,
              }}
            />
          ) : null}
          <div
            className="pointer-events-none absolute border border-white/90 shadow-[0_0_0_9999px_rgb(15_23_42_/_0.55)]"
            style={{
              height: frameSize.height,
              left: `calc(50% - ${frameSize.width / 2}px)`,
              top: `calc(50% - ${frameSize.height / 2}px)`,
              width: frameSize.width,
            }}
            aria-hidden="true"
          >
            {dragging ? (
              <div
                data-crop-grid
                className="absolute inset-0 grid grid-cols-3 grid-rows-3 [filter:drop-shadow(0_0_1px_#000)]"
              >
                {Array.from({ length: 9 }, (_, index) => (
                  <div
                    key={index}
                    className={`${index % 3 !== 2 ? "border-r border-white/30" : ""} ${index < 6 ? "border-b border-white/30" : ""}`}
                  />
                ))}
              </div>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-slate-500">
          <div className="flex shrink-0 items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 border border-slate-200"
              aria-label={ko ? "초기화" : "Reset"}
              disabled={
                processing ||
                (zoom === 1 &&
                  rotation === 0 &&
                  offset.x === 0 &&
                  offset.y === 0)
              }
              onClick={() => {
                setZoom(1);
                setRotation(0);
                setOffset({ x: 0, y: 0 });
              }}
            >
              <RotateCcw aria-hidden="true" className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 border border-slate-200"
              aria-label={ko ? "오른쪽으로 90도 회전" : "Rotate 90 degrees clockwise"}
              disabled={processing}
              onClick={() => {
                setRotation(value => (value + 1) % 4);
                setOffset({ x: 0, y: 0 });
              }}
            >
              <RotateCw className="size-4" aria-hidden="true" />
            </Button>
          </div>
          <div className="flex min-w-0 flex-1 items-center gap-1 rounded-lg bg-slate-50 px-2 py-1 sm:max-w-sm sm:gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 shrink-0"
              aria-label={ko ? "축소" : "Zoom out"}
              onClick={() =>
                setZoom((value) => Math.max(MIN_ZOOM, value - 0.1))
              }
              disabled={processing || zoom <= MIN_ZOOM}
            >
              <Minus aria-hidden="true" className="size-3.5" />
            </Button>
            <input
              aria-label={ko ? "확대 비율" : "Zoom"}
              type="range"
              min={MIN_ZOOM}
              max={MAX_ZOOM}
              step="0.01"
              value={zoom}
              disabled={processing}
              onChange={(event) => setZoom(Number(event.currentTarget.value))}
              className="crop-zoom-slider min-w-6 flex-1 sm:min-w-12"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 shrink-0"
              aria-label={ko ? "확대" : "Zoom in"}
              onClick={() =>
                setZoom((value) => Math.min(MAX_ZOOM, value + 0.1))
              }
              disabled={processing || zoom >= MAX_ZOOM}
            >
              <Plus aria-hidden="true" className="size-3.5" />
            </Button>
            <span className="w-8 shrink-0 text-center tabular-nums sm:w-10">
              {Math.round(zoom * 100)}%
            </span>
          </div>
        </div>
        <div
          className="flex flex-wrap items-center justify-center gap-2 text-xs"
          role="group"
          aria-label={ko ? "여백 배경색" : "Margin background"}
        >
          <span className="mr-1 text-slate-500">
            {ko ? "여백" : "Background"}
          </span>
          {(["white", "black", "transparent"] as const).map((value) => (
            <button
              key={value}
              type="button"
              disabled={processing}
              aria-pressed={background === value}
              onClick={() => setBackground(value)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 transition-colors disabled:opacity-50 ${background === value ? "border-slate-500 bg-slate-100 text-slate-900" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}
            >
              <span
                className="size-3 rounded-full border border-slate-300"
                style={
                  value === "transparent"
                    ? checkerboardStyle
                    : { backgroundColor: value === "white" ? "#fff" : "#000" }
                }
              />
              {ko
                ? value === "white"
                  ? "흰색"
                  : value === "black"
                    ? "검은색"
                    : "투명"
                : value === "white"
                  ? "White"
                  : value === "black"
                    ? "Black"
                    : "Transparent"}
              {background === value ? (
                <Check aria-hidden="true" className="size-3" />
              ) : null}
            </button>
          ))}
        </div>
      </div>
    </Modal>
  );
}
