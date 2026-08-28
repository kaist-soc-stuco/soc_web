import { useMemo, useState } from "react";
import { createApiClient } from "@soc/api-client";

import { ImageUploadField } from "@/components/ui/image-upload-field";
import { resolveApiBaseUrl } from "@/lib/api-base-url";
import { resolveAssetUrl } from "@/lib/asset-url";

interface SurveyImageFieldProps {
  value?: string | null;
  onChange: (value: string | null) => void;
  disabled?: boolean;
  label?: string;
}

export function SurveyImageField({
  value,
  onChange,
  disabled = false,
  label = "이미지",
}: SurveyImageFieldProps) {
  const client = useMemo(() => createApiClient({ baseUrl: resolveApiBaseUrl() }), []);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-1.5">
      <ImageUploadField
        alt={`${label} 미리보기`}
        disabled={disabled || uploading}
        imageUrl={value ? resolveAssetUrl(value) : undefined}
        onRemove={() => onChange(null)}
        onSelect={async (file) => {
          if (!file.type.startsWith("image/")) {
            setError("이미지 파일만 등록할 수 있습니다.");
            return;
          }
          setUploading(true);
          setError(null);
          try {
            const asset = await client.uploadAsset(file);
            onChange(asset.storageKey);
          } catch {
            setError("이미지를 업로드하지 못했습니다.");
          } finally {
            setUploading(false);
          }
        }}
        removeLabel="제거"
        selectLabel={value ? "이미지 변경" : `${label} 추가`}
      />
      {error ? <p className="text-xs font-normal text-rose-600">{error}</p> : null}
    </div>
  );
}
