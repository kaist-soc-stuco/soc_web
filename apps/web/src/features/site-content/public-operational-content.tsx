import { ExternalLink, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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
    return JSON.parse(window.localStorage.getItem(dismissedKey) || "[]") as string[];
  } catch {
    return [];
  }
}

export function PublicOperationalContent() {
  const location = useLocation();
  const { lang } = useLanguage();
  const { data } = usePublicContentBlocks();
  const [dismissed, setDismissed] = useState<string[]>(readDismissed);
  const [closing, setClosing] = useState<string[]>([]);

  const visible = useMemo(
    () => (data?.items ?? []).filter((block) => !dismissed.includes(block.contentBlockId)),
    [data?.items, dismissed],
  );
  const notices = visible.filter((block) => block.type === "TOP_BANNER");
  const hasVisibleNotice = notices.some(
    (notice) => !closing.includes(notice.contentBlockId),
  );

  useEffect(() => {
    document.documentElement.classList.toggle(
      "has-public-top-banner",
      hasVisibleNotice && !location.pathname.startsWith("/admin"),
    );
    return () => document.documentElement.classList.remove("has-public-top-banner");
  }, [hasVisibleNotice, location.pathname]);

  const dismiss = (contentBlockId: string) => {
    if (closing.includes(contentBlockId)) return;

    setClosing((current) => [...new Set([...current, contentBlockId])]);
    window.setTimeout(() => {
      setDismissed((current) => {
        const next = [...new Set([...current, contentBlockId])];
        window.localStorage.setItem(dismissedKey, JSON.stringify(next));
        return next;
      });
      setClosing((current) => current.filter((id) => id !== contentBlockId));
    }, 220);
  };

  if (location.pathname.startsWith("/admin")) return null;

  return (
    <>
      {notices.length ? (
        <div
          className="fixed left-0 right-0 top-[var(--ui-header-height)] z-[45] grid gap-0"
        >
          {notices.map((notice) => {
            const noticeText = resolveContentBlockText(notice, lang);
            const isClosing = closing.includes(notice.contentBlockId);

            return (
              <aside
                key={notice.contentBlockId}
                aria-hidden={isClosing}
                aria-label="상단 공지"
                className={`flex items-center gap-3 overflow-hidden border-y border-white/10 bg-[#112d25]/95 px-4 py-2 text-white shadow-none backdrop-blur transition-[max-height,opacity,transform,padding] duration-200 ease-out ${
                  isClosing
                    ? "pointer-events-none max-h-0 -translate-y-2 border-transparent px-4 py-0 opacity-0"
                    : "max-h-14 translate-y-0 opacity-100"
                }`}
              >
                <p className="min-w-0 flex-1 truncate text-sm font-normal text-white">
                  {noticeText.title}
                  {noticeText.body ? (
                    <span className="ml-2 text-xs text-white/65">{noticeText.body}</span>
                  ) : null}
                </p>
                {notice.linkUrl ? (
                  <Button asChild size="sm" variant="ghost" className="shrink-0 text-white hover:bg-white/10 hover:text-white">
                    <a href={notice.linkUrl} onClick={() => dismiss(notice.contentBlockId)}>
                      {lang === "en" ? "View" : "보기"}
                      <ExternalLink aria-hidden="true" />
                    </a>
                  </Button>
                ) : null}
                <IconButton
                  size="sm"
                  aria-label={lang === "en" ? "Dismiss" : "닫기"}
                  onClick={() => dismiss(notice.contentBlockId)}
                  className="text-white/70 hover:bg-white/10 hover:text-white"
                >
                  <X aria-hidden="true" />
                </IconButton>
              </aside>
            );
          })}
        </div>
      ) : null}
    </>
  );
}
