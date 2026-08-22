import { ExternalLink, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useLocation } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Modal } from "@/components/ui/modal";
import {
  resolveContentBlockText,
  usePublicContentBlocks,
} from "@/features/site-content/site-content";
import { useLanguage } from "@/hooks/use-language";

const dismissedKey = "soc-dismissed-content-blocks";

function readDismissed(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.sessionStorage.getItem(dismissedKey) || "[]") as string[];
  } catch {
    return [];
  }
}

export function PublicOperationalContent() {
  const location = useLocation();
  const { lang } = useLanguage();
  const { data } = usePublicContentBlocks();
  const [dismissed, setDismissed] = useState<string[]>(readDismissed);

  const visible = useMemo(
    () => (data?.items ?? []).filter((block) => !dismissed.includes(block.contentBlockId)),
    [data?.items, dismissed],
  );
  const banner = visible.find((block) => block.type === "TOP_BANNER" || block.type === "STATUS_NOTICE");
  const popup = visible.find((block) => block.type === "POPUP");

  const dismiss = (contentBlockId: string) => {
    const next = [...new Set([...dismissed, contentBlockId])];
    setDismissed(next);
    window.sessionStorage.setItem(dismissedKey, JSON.stringify(next));
  };

  if (location.pathname.startsWith("/admin")) return null;

  const bannerText = banner ? resolveContentBlockText(banner, lang) : null;
  const popupText = popup ? resolveContentBlockText(popup, lang) : null;

  return (
    <>
      {banner && bannerText ? (
        <aside className="fixed left-1/2 top-[calc(var(--ui-header-height)+12px)] z-[45] flex w-[min(720px,calc(100vw-32px))] -translate-x-1/2 items-center gap-3 rounded-xl border border-slate-200/90 bg-white/95 px-4 py-3 shadow-[0_12px_35px_rgba(15,23,42,0.12)] backdrop-blur" aria-label={banner.type === "STATUS_NOTICE" ? "상태 공지" : "상단 공지"}>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-900">{bannerText.title}</p>
            {bannerText.body ? <p className="mt-0.5 truncate text-xs font-normal text-slate-500">{bannerText.body}</p> : null}
          </div>
          {banner.linkUrl ? (
            <Button asChild size="sm" variant="ghost">
              <a href={banner.linkUrl}>{lang === "en" ? "View" : "보기"}<ExternalLink aria-hidden="true" /></a>
            </Button>
          ) : null}
          <IconButton size="sm" aria-label={lang === "en" ? "Dismiss" : "닫기"} onClick={() => dismiss(banner.contentBlockId)}>
            <X aria-hidden="true" />
          </IconButton>
        </aside>
      ) : null}
      {popup && popupText ? (
        <Modal
          open
          onClose={() => dismiss(popup.contentBlockId)}
          title={popupText.title}
          footer={popup.linkUrl ? (
            <Button asChild>
              <a href={popup.linkUrl}>{lang === "en" ? "View details" : "자세히 보기"}<ExternalLink aria-hidden="true" /></a>
            </Button>
          ) : undefined}
        >
          {popup.imageUrl ? <img src={popup.imageUrl} alt="" className="mb-4 max-h-64 w-full rounded-lg object-cover" /> : null}
          {popupText.body ? <p className="whitespace-pre-line text-sm font-normal leading-6 text-slate-600">{popupText.body}</p> : null}
        </Modal>
      ) : null}
    </>
  );
}
