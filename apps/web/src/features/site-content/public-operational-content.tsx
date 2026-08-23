import { ExternalLink, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useLocation } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
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
  const notices = visible.filter((block) => block.type === "TOP_BANNER");

  const dismiss = (contentBlockId: string) => {
    const next = [...new Set([...dismissed, contentBlockId])];
    setDismissed(next);
    window.sessionStorage.setItem(dismissedKey, JSON.stringify(next));
  };

  if (location.pathname.startsWith("/admin")) return null;

  return (
    <>
      {notices.length ? <div className="fixed left-1/2 top-[calc(var(--ui-header-height)+12px)] z-[45] grid w-[min(720px,calc(100vw-32px))] -translate-x-1/2 gap-2">{notices.map((notice) => {
        const noticeText = resolveContentBlockText(notice, lang);
        return <aside key={notice.contentBlockId} className="flex items-center gap-3 rounded-xl border border-slate-200/90 bg-white/95 px-4 py-3 shadow-[0_12px_35px_rgba(15,23,42,0.12)] backdrop-blur" aria-label="상단 공지">
          <div className="min-w-0 flex-1"><p className="truncate text-sm font-normal text-[#172033]">{noticeText.title}</p>{noticeText.body ? <p className="mt-0.5 truncate text-xs font-normal text-[#344054]">{noticeText.body}</p> : null}</div>
          {notice.linkUrl ? <Button asChild size="sm" variant="ghost"><a href={notice.linkUrl} onClick={() => dismiss(notice.contentBlockId)}>{lang === "en" ? "View" : "보기"}<ExternalLink aria-hidden="true" /></a></Button> : null}
          <IconButton size="sm" aria-label={lang === "en" ? "Dismiss" : "닫기"} onClick={() => dismiss(notice.contentBlockId)}><X aria-hidden="true" /></IconButton>
        </aside>;
      })}</div> : null}
    </>
  );
}
