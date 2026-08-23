import { useRef } from "react";
import { ImagePlus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ImageUploadFieldProps {
  accept?: string;
  alt: string;
  className?: string;
  disabled?: boolean;
  emptyText: string;
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
  disabled = false,
  emptyText,
  imageUrl,
  onRemove,
  onSelect,
  removeLabel,
  selectLabel,
}: ImageUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div
      className={cn(
        "overflow-hidden rounded-[var(--ui-control-radius)] border border-[var(--ui-border-subtle)] bg-white",
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

      {imageUrl ? (
        <div className="grid gap-3 p-3 sm:grid-cols-[12rem_1fr] sm:items-center">
          <div className="aspect-video overflow-hidden rounded-md bg-slate-100">
            <img src={imageUrl} alt={alt} className="h-full w-full object-cover" />
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
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          className="flex w-full items-center gap-3 px-4 py-4 text-left transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-[#344054]">
            <ImagePlus aria-hidden="true" className="size-4" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-normal text-[#172033]">
              {selectLabel}
            </span>
            <span className="mt-0.5 block text-xs font-normal text-[#344054]">
              {emptyText}
            </span>
          </span>
        </button>
      )}
    </div>
  );
}
