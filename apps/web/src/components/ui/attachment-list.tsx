import type { ArticleAssetItem } from "@soc/contracts";
import { Download, Paperclip } from "lucide-react";

import { resolveAssetUrl } from "@/lib/asset-url";

type AttachmentListProps = {
  assets: ArticleAssetItem[];
  className?: string;
  lang?: string;
  title?: string;
};

export function AttachmentList({
  assets,
  className,
  lang = "ko",
  title,
}: AttachmentListProps) {
  if (assets.length === 0) return null;

  return (
    <section className={className}>
      <h2 className="mb-3 text-[13px] font-semibold text-slate-500">
        {title ??
          (lang === "ko"
            ? `첨부파일 (${assets.length})`
            : `Attachments (${assets.length})`)}
      </h2>

      <div className="w-full overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full border-collapse text-left">
          <tbody className="divide-y divide-slate-100">
            {assets.map((asset) => {
              const assetUrl = resolveAssetUrl(asset.storageKey);

              return (
                <tr
                  key={asset.assetId}
                  className="transition-colors hover:bg-slate-50/50"
                >
                  <td className="min-w-0 px-4 py-2.5 align-middle">
                    <a
                      href={assetUrl}
                      download={asset.originalFilename}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex min-w-0 items-center gap-2 transition-colors hover:text-kaist-darkgreen"
                    >
                      <Paperclip className="h-4 w-4 shrink-0 text-slate-400" />
                      <span className="truncate text-[13px] font-medium text-slate-700">
                        {asset.originalFilename}
                      </span>
                      <span className="shrink-0 text-[11px] font-medium text-slate-400">
                        ({formatFileSize(asset.sizeBytes)})
                      </span>
                    </a>
                  </td>
                  <td className="w-10 shrink-0 py-2.5 pl-2 pr-4 text-right align-middle">
                    <a
                      href={assetUrl}
                      download={asset.originalFilename}
                      target="_blank"
                      rel="noreferrer"
                      className="text-slate-400 transition-colors hover:text-slate-650"
                      title={lang === "ko" ? "다운로드" : "Download"}
                    >
                      <Download className="inline-block h-4 w-4" />
                    </a>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function formatFileSize(sizeBytes: number) {
  if (sizeBytes >= 1024 * 1024) {
    return `${(sizeBytes / (1024 * 1024)).toFixed(1)}MB`;
  }
  if (sizeBytes >= 1024) {
    return `${(sizeBytes / 1024).toFixed(1)}KB`;
  }
  return `${sizeBytes}B`;
}
