import { useEffect, useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ImageCropModal } from "@/components/ui/image-crop-modal";
import { useLanguage } from "@/hooks/use-language";
import { cn } from "@/lib/utils";

interface ImageUploadFieldProps {
  accept?: string;
  alt: string;
  className?: string;
  compact?: boolean;
  maxSizeBytes?: number;
  crop?: { width: number; height: number };
  disabled?: boolean;
  emptyText?: string;
  fileName?: string;
  imageUrl?: string;
  onRemove: () => void;
  onSelect: (file: File) => void | Promise<void>;
  previewErrorText?: string;
  removeLabel: string;
  selectLabel: string;
}

export function ImageUploadField({
  accept = "image/jpeg,image/png,image/webp",
  alt,
  className,
  compact = false,
  crop,
  maxSizeBytes = 20_000_000,
  disabled = false,
  emptyText,
  fileName,
  imageUrl,
  onRemove,
  onSelect,
  previewErrorText = "이미지를 불러오지 못했습니다. 다시 선택해 주세요.",
  removeLabel,
  selectLabel,
}: ImageUploadFieldProps) {
  const { lang } = useLanguage();
  const ko = lang === "ko";
  const [dragging, setDragging] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [selecting, setSelecting] = useState(false);
  const selectingRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewFailed, setPreviewFailed] = useState(false);
  const [cropFile, setCropFile] = useState<File | null>(null);

  useEffect(() => {
    setPreviewFailed(false);
  }, [imageUrl]);

  const selectFile = async (file: File) => {
    if (selectingRef.current) return;
    selectingRef.current = true;
    setSelecting(true);
    try { await onSelect(file); }
    catch (error) {
      setFileError(ko ? "이미지를 첨부하지 못했습니다. 다시 시도해 주세요." : "Could not attach the image. Please try again.");
      throw error;
    } finally { selectingRef.current = false; setSelecting(false); }
  };
  const blocked = disabled || selecting;
  const formatHint = accept.split(",").map(value => value.trim().replace("image/", "").replace("*", ko ? "이미지" : "Images").toUpperCase()).join(", ");
  const hasPreview = Boolean(imageUrl && !previewFailed);

  const acceptFile = (file: File | undefined) => {
    setFileError(null);
    if (file && !blocked) {
      const accepted = accept.split(",").some(value => {
        const rule = value.trim().toLowerCase();
        return rule.startsWith(".") ? file.name.toLowerCase().endsWith(rule) : rule.endsWith("/*") ? file.type.startsWith(rule.slice(0, -1)) : file.type === rule;
      });
      if (!accepted) setFileError(ko ? "지원하지 않는 파일 형식입니다." : "This file format is not supported.");
      else if (!file.size || file.size > maxSizeBytes) setFileError(ko ? `0바이트보다 크고 ${maxSizeBytes / 1_000_000}MB 이하인 파일을 선택해 주세요.` : `Choose a non-empty file up to ${maxSizeBytes / 1_000_000}MB.`);
      else if (crop && ["image/jpeg", "image/png", "image/webp"].includes(file.type)) setCropFile(file);
      else void selectFile(file).catch(() => undefined);
    }

  };

  return (
    <>
    <div
      className={cn(
        "space-y-2",
        className,
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        aria-label={selectLabel}
        disabled={blocked}
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          acceptFile(file);
          event.currentTarget.value = "";
        }}
      />

      <div
        className={cn("relative overflow-hidden rounded-lg border border-dashed transition-colors", dragging ? "border-slate-600 bg-slate-100" : "border-slate-300 bg-slate-50/60", blocked && "opacity-60")}
        onDragOver={event => { event.preventDefault(); if (!blocked) { event.dataTransfer.dropEffect = "copy"; setDragging(true); } }}
        onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false); }}
        onDrop={event => { event.preventDefault(); setDragging(false); if (!blocked) acceptFile(event.dataTransfer.files[0]); }}
      >
        <button type="button" disabled={blocked} aria-label={selectLabel} onClick={() => inputRef.current?.click()}
          className="relative flex aspect-video w-full flex-col items-center justify-center gap-2 overflow-hidden p-4 text-slate-500 transition-colors hover:bg-slate-100/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand-primary disabled:cursor-not-allowed">
          {hasPreview ? <img src={imageUrl} alt={alt} draggable={false} onError={() => setPreviewFailed(true)} className="absolute inset-0 size-full object-contain" /> : <>
            <ImagePlus aria-hidden="true" className="size-6 text-slate-400" />
            <span className={compact ? "text-xs font-medium" : "text-sm font-medium"}>{emptyText || (ko ? "이미지를 놓거나 클릭해서 선택" : "Drop an image or click to choose")}</span>
          </>}
        </button>
        {hasPreview && <Button type="button" variant="ghost" size="icon" disabled={blocked} onClick={() => { setFileError(null); onRemove(); }} aria-label={removeLabel} className="absolute right-2 top-2 size-8 rounded-md bg-white/80 text-slate-600 hover:bg-white hover:text-slate-900"><X aria-hidden="true" className="size-4" /></Button>}
      </div>
      {hasPreview && fileName ? <p className="truncate text-xs text-slate-500" title={fileName}>{fileName}</p> : null}
      <p className="text-xs text-slate-400">{formatHint} · {maxSizeBytes / 1_000_000}MB {ko ? "이하" : "max"}</p>
      {fileError || previewFailed ? <p role="alert" className="text-xs text-rose-600">{fileError ?? previewErrorText}</p> : null}
    </div>
    {crop && cropFile ? <ImageCropModal
      file={cropFile}
      aspectRatio={crop.width / crop.height}
      outputWidth={crop.width}
      outputHeight={crop.height}
      onCancel={() => setCropFile(null)}
      onComplete={async (file) => {
        await selectFile(file);
        setCropFile(null);
      }}
    /> : null}
    </>
  );
}
