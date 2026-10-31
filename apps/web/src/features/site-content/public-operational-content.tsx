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
    return JSON.parse(
      window.localStorage.getItem(dismissedKey) || "[]",
    ) as string[];
  } catch {
    return [];
  }
}

export function PublicOperationalContent() {
  const location = useLocation();
  const isHome = location.pathname === "/";
  const { lang } = useLanguage();
  const { data } = usePublicContentBlocks();
  const [dismissed, setDismissed] = useState<string[]>(readDismissed);
  const [closing, setClosing] = useState<string[]>([]);

  const visible = useMemo(
    () =>
      (data?.items ?? []).filter(
        (block) => !dismissed.includes(block.contentBlockId),
      ),
    [data?.items, dismissed],
  );
  const notices = visible.filter((block) => block.type === "TOP_BANNER");
  const dismiss = (contentBlockId: string) => {
    if (closing.includes(contentBlockId)) return;
    setClosing((current) => [...new Set([...current, contentBlockId])]);
  };
  const finishDismiss = (contentBlockId: string) => {
    const next = [...new Set([...dismissed, contentBlockId])];
    try {
      window.localStorage.setItem(dismissedKey, JSON.stringify(next));
    } catch {
      /* Dismiss even if browser storage is unavailable. */
    }
    setDismissed((current) => [...new Set([...current, contentBlockId])]);
    setClosing((current) => current.filter((id) => id !== contentBlockId));
  };

  if (!isHome) return null;

  return (
    <>
      {notices.length ? (
        <div className="public-site-notices relative z-[55] grid gap-0">
          {notices.map((notice) => {
            const noticeText = resolveContentBlockText(notice, lang);
            const isClosing = closing.includes(notice.contentBlockId);

            return (
              <div
                key={notice.contentBlockId}
                aria-hidden={isClosing}
                inert={isClosing || undefined}
                className={`grid overflow-hidden transition-[grid-template-rows,opacity] duration-300 ease-in-out motion-reduce:duration-1 ${isClosing ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr] opacity-100"}`}
                onTransitionEnd={(event) => {
                  if (
                    isClosing &&
                    event.target === event.currentTarget &&
                    event.propertyName === "grid-template-rows"
                  )
                    finishDismiss(notice.contentBlockId);
                }}
              >
                <div className="min-h-0 overflow-hidden">
                  <aside
                    aria-label="상단 공지"
                    className="relative bg-emerald-700 px-12 py-2 text-white"
                  >
                    <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center">
                      <p className="min-w-0 text-sm font-normal text-white [overflow-wrap:anywhere]">
                        {noticeText.title}
                        {noticeText.body ? (
                          <span className="ml-2 text-xs text-white/80">
                            {noticeText.body}
                          </span>
                        ) : null}
                      </p>
                      {notice.linkUrl ? (
                        <Button
                          asChild
                          size="sm"
                          variant="ghost"
                          className="shrink-0 text-white hover:bg-white/10 hover:text-white"
                        >
                          <a
                            href={
                              new URL(
                                notice.linkUrl,
                                `${window.location.origin}/`,
                              ).href
                            }
                          >
                            {lang === "en" ? "View" : "바로가기"}
                            <ExternalLink aria-hidden="true" />
                          </a>
                        </Button>
                      ) : null}
                    </div>
                    <IconButton
                      size="sm"
                      aria-label={lang === "en" ? "Dismiss" : "닫기"}
                      onClick={() => dismiss(notice.contentBlockId)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 border-0 text-white/70 hover:border-0 hover:bg-white/10 hover:text-white"
                    >
                      <X aria-hidden="true" />
                    </IconButton>
                  </aside>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </>
  );
}
