import { useEffect, useRef, useState } from "react";
import { ImagePlus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ImageUploadFieldProps {
  accept?: string;
  alt: string;
  className?: string;
  compact?: boolean;
  disabled?: boolean;
  emptyText?: string;
  fileName?: string;
  imageUrl?: string;
  onRemove: () => void;
  onSelect: (file: File) => void | Promise<void>;
  removeLabel: string;
  selectLabel: string;
}

export function ImageUploadField({
  accept = "image/jpeg,image/png,image/webp",
  alt,
  className,
  compact = false,
  disabled = false,
  emptyText,
  fileName,
  imageUrl,
  onRemove,
  onSelect,
  removeLabel,
  selectLabel,
}: ImageUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewFailed, setPreviewFailed] = useState(false);

  useEffect(() => {
    setPreviewFailed(false);
  }, [imageUrl]);

  const hasPreview = Boolean(imageUrl && !previewFailed);

  return (
    <div
      className={cn(
        "overflow-hidden rounded-[var(--ui-control-radius)] border border-[var(--ui-border-subtle)] bg-white",
        compact ? "h-[38px]" : undefined,
        className,
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="sr-only"
        disabled={disabled}
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          if (file) void onSelect(file);
          event.currentTarget.value = "";
        }}
      />

      {hasPreview ? (
        compact ? (
          <div className="flex h-full min-w-0 items-center gap-2 px-2">
            <img
              src={imageUrl}
              alt={alt}
              draggable={false}
              onError={() => setPreviewFailed(true)}
              className="size-7 shrink-0 rounded-md object-cover"
            />
            <span className="min-w-0 flex-1 truncate text-xs font-medium text-[#172033]">
              {fileName ?? selectLabel}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={disabled}
              onClick={() => inputRef.current?.click()}
              aria-label={selectLabel}
              className="size-7 shrink-0 rounded-md p-0 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            >
              <ImagePlus aria-hidden="true" className="size-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={disabled}
              onClick={onRemove}
              aria-label={removeLabel}
              data-tooltip={removeLabel}
              className="size-7 shrink-0 rounded-md p-0 text-slate-400 hover:bg-rose-50 hover:text-rose-700"
            >
              <Trash2 aria-hidden="true" className="size-3.5" />
            </Button>
          </div>
        ) : (
          <div className="grid gap-3 p-3 sm:grid-cols-[12rem_1fr] sm:items-center">
            <div className="aspect-video overflow-hidden rounded-md bg-slate-100">
              <img src={imageUrl} alt={alt} draggable={false} onError={() => setPreviewFailed(true)} className="h-full w-full object-cover" />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={disabled}
                onClick={() => inputRef.current?.click()}
                className="!font-normal"
              >
                <ImagePlus aria-hidden="true" />
                {selectLabel}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={disabled}
                onClick={onRemove}
                className="!font-normal text-rose-600 hover:bg-rose-50 hover:text-rose-700"
              >
                <Trash2 aria-hidden="true" />
                {removeLabel}
              </Button>
            </div>
          </div>
        )
      ) : compact ? (
        <button
          type="button"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          className="flex h-full w-full items-center gap-2 px-3 text-left transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <ImagePlus aria-hidden="true" className="size-4 shrink-0 text-slate-500" />
          <span className="truncate text-xs font-medium text-[#172033]">{selectLabel}</span>
        </button>
      ) : (
        <div className="grid gap-3 p-3 sm:grid-cols-[12rem_1fr] sm:items-center">
          <div className="flex aspect-video items-center justify-center overflow-hidden rounded-md bg-slate-100">
            <ImagePlus aria-hidden="true" className="size-5 text-slate-400" />
          </div>
          <div className="min-w-0">
            <button
              type="button"
              disabled={disabled}
              onClick={() => inputRef.current?.click()}
              className="inline-flex min-h-9 items-center gap-2 rounded-md border border-[var(--ui-border-subtle)] bg-white px-3 text-sm font-normal text-[#172033] transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <ImagePlus aria-hidden="true" className="size-4" />
              {selectLabel}
            </button>
            {previewFailed ? (
              <p className="mt-1 text-xs font-normal text-rose-600">이미지를 불러오지 못했습니다. 다시 선택해 주세요.</p>
            ) : emptyText ? (
              <p className="mt-1 text-xs font-normal text-[#344054]">
                {emptyText}
              </p>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
