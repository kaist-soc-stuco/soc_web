import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { createApiClient } from "@soc/api-client";
import { isoToMs, nowMs } from "@soc/shared";
import { ChevronRight } from "lucide-react";
import { resolveApiBaseUrl } from "@/lib/api-base-url";
import { formatNumericDate } from "@/lib/date-display";
import { SectionHeader } from "@/components/ui/section-header";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { EmptyState } from "@/components/ui/data-state";
import { useLanguage } from "@/hooks/use-language";

interface NoticeItemProps {
  id: string;
  category: string;
  categoryLabel: string;
  lang: string;
  author: string;
  title: string;
  date: string;
  commentCount?: number;
  isImportant?: boolean;
  isNew?: boolean;
  showGroupDivider?: boolean;
  showCategoryBadge?: boolean;
}

const HOME_NOTICE_LIMIT = 8;

function NoticeItem({
  id,
  category,
  categoryLabel,
  lang,
  author,
  title,
  date,
  commentCount,
  isImportant,
  isNew,
  showGroupDivider,
  showCategoryBadge,
}: NoticeItemProps) {
  return (
    <Link
      to={`/board/${category}/${id}`}
      className={`flex min-h-[2.5rem] items-center overflow-hidden border-b border-slate-100 px-3 transition-colors ${
        isImportant
          ? "bg-brand-primary-light/35 hover:bg-brand-primary/10"
          : "hover:bg-slate-50/80"
      } ${showGroupDivider ? "border-t border-brand-primary-border/50" : ""}`}
    >
      <div className="flex w-full min-w-0 items-center justify-between gap-4 py-0.5">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {showCategoryBadge ? (
            <span className="inline-flex shrink-0 items-center rounded-md border-0 bg-slate-100 px-2 py-0.5 text-[length:var(--ui-text-caption-size)] font-semibold tracking-tight text-slate-700">
              {categoryLabel}
            </span>
          ) : null}
          <div
            className={`home-board-title flex min-w-0 items-center gap-1.5 truncate text-slate-700 hover:text-brand-primary ${
              isImportant ? "is-important" : ""
            }`}
          >
            <span className="min-w-0 truncate">{title}</span>
            {commentCount && commentCount > 0 ? (
              <span
                aria-label={
                  lang === "ko"
                    ? `댓글 ${commentCount}개`
                    : `${commentCount} comments`
                }
                className="shrink-0 self-end text-xs font-normal leading-4 text-[#1769AA]"
              >
                [{commentCount}]
              </span>
            ) : null}
            {isNew ? (
              <span
                className="h-[5px] w-[5px] shrink-0 rounded-full bg-rose-500"
              title={lang === "ko" ? "새 글" : "New post"}
              >
                <span className="sr-only">{lang === "ko" ? "새 글" : "New post"}</span>
              </span>
            ) : null}
          </div>
        </div>
        <div className="home-notice-meta grid w-[10.5rem] min-w-0 shrink-0 grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-1.5 text-right">
          <span className="home-meta-text min-w-0 truncate text-slate-400">
            {author}
          </span>
          <span aria-hidden="true" className="home-meta-text text-center text-slate-300">
            ·
          </span>
          <time className="home-meta-text shrink-0 tabular-nums text-slate-400">
            {date}
          </time>
        </div>
      </div>
    </Link>
  );
}

function formatDate(dateIso: string) {
  return formatNumericDate(dateIso);
}

export function NoticeBoard() {
  const { lang } = useLanguage();
  const [activeTab, setActiveTab] = useState(0);
  const [notices, setNotices] = useState<Record<string, NoticeItemProps[]>>({});
  const [lastLoadedNotices, setLastLoadedNotices] = useState<NoticeItemProps[]>([]);

  const tabs = [
    { code: "공지", labelKo: "공지", labelEn: "Notice" },
    { code: "HoC", labelKo: "HoC", labelEn: "HoC" },
    { code: "홍보글", labelKo: "홍보글", labelEn: "Promotional Posts" },
    { code: "연구실", labelKo: "연구실", labelEn: "Research Labs" },
  ];

  const apiClient = useMemo(
    () => createApiClient({ baseUrl: resolveApiBaseUrl() }),
    [],
  );
  const activeCategory = tabs[activeTab].code;
  const activeNoticeKey = `${activeCategory}:${lang}`;
  const getCategoryLabel = (code: string) => {
    const tab = tabs.find((item) => item.code === code);
    if (!tab) return code;
    return lang === "ko" ? tab.labelKo : tab.labelEn;
  };

  const currentNotices = notices[activeNoticeKey] || [];
  const hasCurrentNoticeData = Object.prototype.hasOwnProperty.call(
    notices,
    activeNoticeKey,
  );

  const displayNotices = useMemo(() => {
    const pinned = currentNotices.filter((notice) => notice.isImportant).slice(0, 3);
    const regular = currentNotices.filter((notice) => !notice.isImportant);
    return [...pinned, ...regular];
  }, [currentNotices]);
  const visibleNotices = displayNotices.slice(0, HOME_NOTICE_LIMIT);
  const renderedNotices = hasCurrentNoticeData
    ? visibleNotices
    : lastLoadedNotices.slice(0, HOME_NOTICE_LIMIT);
  useEffect(() => {
    let active = true;
    const fetchNotices = async () => {
      try {
        const res = await apiClient.getArticles(activeCategory, { limit: 20 });
        // Filter out items with blank/empty titles
        const items = res.items
          .filter(
            (item) => item.boardCode !== "_EVENT" && item.boardCode !== "FAQ",
          )
          .filter((item) => item.titleKo && item.titleKo.trim() !== "")
          .sort((a, b) => {
            if (a.isPinned !== b.isPinned) {
              return Number(b.isPinned) - Number(a.isPinned);
            }
            return isoToMs(b.postedAt) - isoToMs(a.postedAt);
          })
          .map((item) => ({
            id: item.articleId,
            category: activeCategory,
            categoryLabel: getCategoryLabel(activeCategory),
            lang,
            author: item.isAnonymous
              ? lang === "ko"
                ? "익명"
                : "Anonymous"
              : item.author.name,
            title: lang === "ko" ? item.titleKo : item.titleEn || item.titleKo,
            date: formatDate(item.postedAt),
            isImportant: item.isPinned,
            isNew: (() => {
              if (activeCategory !== "공지") {
                return false;
              }
              return isoToMs(item.postedAt) >= nowMs() - 4 * 24 * 60 * 60 * 1000;
            })(),
            commentCount: item.commentCount,
        }));
        if (active) {
          setNotices((prev) => ({ ...prev, [activeNoticeKey]: items }));
          setLastLoadedNotices(items);
        }
      } catch (err) {
        console.error(err);
      }
    };

    if (!notices[activeNoticeKey]) {
      void fetchNotices();
    }
  }, [
    activeCategory,
    activeNoticeKey,
    lang,
    notices,
    apiClient,
  ]);

  return (
    <section className="home-bento-card flex min-h-[24rem] min-w-0 flex-col overflow-hidden">
      <div className="mx-auto flex h-full min-h-0 w-full flex-col">
        <SectionHeader
          navigation={
            <SegmentedControl
              ariaLabel={lang === "ko" ? "게시판 카테고리" : "Board categories"}
              className="home-board-tabs clean-segmented-control max-w-full"
              itemClassName="!text-xs"
              options={tabs.map((tab) => ({
                label: lang === "ko" ? tab.labelKo : tab.labelEn,
                value: tab.code,
              }))}
              value={activeCategory}
              onChange={(value) => {
                const nextIndex = tabs.findIndex((tab) => tab.code === value);
                if (nextIndex >= 0) setActiveTab(nextIndex);
              }}
            />
          }
          action={
            <Link
              to={`/board/${activeCategory}`}
              className="home-more-link shrink-0"
            >
              <span>{lang === "ko" ? "더보기" : "More"}</span>
              <ChevronRight className="h-3 w-3" />
            </Link>
          }
        />

        {/* Notice List */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-1 pb-1 pt-1">
          {renderedNotices.length > 0 ? (
            <div
              className="grid min-h-0 flex-none content-start"
              style={{
                gridTemplateRows: `repeat(${renderedNotices.length}, 2.5rem)`,
              }}
            >
              {renderedNotices.map((notice, index) => (
                <NoticeItem
                  key={notice.id}
                  {...notice}
                  lang={lang}
                  showCategoryBadge={false}
                  showGroupDivider={
                    index > 0 &&
                    !notice.isImportant &&
                    Boolean(visibleNotices[index - 1]?.isImportant)
                  }
                />
              ))}
            </div>
          ) : (
            <EmptyState
              className="min-h-0 flex-1 rounded-none border-0 bg-transparent p-4"
              message={lang === "ko" ? "등록된 게시글이 없습니다." : "No posts available."}
              minHeightClassName="min-h-0"
            />
          )}
        </div>
      </div>
    </section>
  );
}
