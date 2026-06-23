import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { createApiClient } from "@soc/api-client";
import { isoToDate, isoToMs, nowMs } from "@soc/shared";
import { ChevronRight, Pin } from "lucide-react";
import { resolveApiBaseUrl } from "@/lib/api-base-url";
import { useLanguage } from "@/hooks/use-language";

interface NoticeItemProps {
  id: string;
  category: string;
  categoryLabel: string;
  lang: string;
  title: string;
  date: string;
  isImportant?: boolean;
  isNew?: boolean;
  count?: number;
  showGroupDivider?: boolean;
}

function NoticeItem({
  id,
  category,
  categoryLabel,
  lang,
  title,
  date,
  isImportant,
  isNew,
  showGroupDivider,
}: NoticeItemProps) {
  return (
    <Link
      to={`/board/${category}/${id}`}
      className={`block px-3 transition-colors hover:bg-slate-50/80 ${
        showGroupDivider ? "border-t border-slate-100" : ""
      }`}
    >
      <div className="flex items-center justify-between py-2.5 gap-4">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {isImportant ? (
            <span className="inline-flex items-center bg-brand-primary-light text-brand-primary border border-brand-primary/10 rounded-full px-2 py-0.5 text-[10px] font-bold shrink-0 select-none">
              <span>{categoryLabel}</span>
            </span>
          ) : (
            <span className="bg-brand-primary-light text-brand-primary rounded-full px-2.5 py-0.5 text-[10px] font-bold shrink-0 tracking-tight select-none">
              {categoryLabel}
            </span>
          )}
          <div
            className={`text-[13px] truncate ${
              isImportant
                ? "text-slate-800 font-semibold"
                : "text-slate-600 font-normal hover:text-brand-primary"
            } flex min-w-0 items-center gap-1.5`}
          >
            {isImportant ? (
              <Pin className="mr-1 inline h-3 w-3 align-[-1px] fill-[#E11D48] text-[#E11D48]" />
            ) : null}
            <span className="min-w-0 truncate">{title}</span>
            {isNew && (
              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#f03e3e] text-[9px] font-black text-white select-none">
                N
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <span className="home-meta-text text-slate-500">
            {date}
          </span>
        </div>
      </div>
    </Link>
  );
}

function formatDate(dateIso: string) {
  const d = isoToDate(dateIso);
  if (isNaN(d.getTime())) return "";
  const yy = String(d.getFullYear()).slice(-2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yy}.${mm}.${dd}`;
}

function NoticeBoardSkeleton() {
  return (
    <div className="divide-y divide-slate-100" aria-busy="true">
      {Array.from({ length: 8 }).map((_, index) => (
        <div key={index} className="flex items-center justify-between gap-4 px-3 py-2.5">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <div className="home-loading-surface h-5 w-12 shrink-0 rounded-full" />
            <div
              className={`home-loading-surface h-3.5 min-w-0 rounded ${
                index % 3 === 0
                  ? "w-4/5"
                  : index % 3 === 1
                    ? "w-3/5"
                    : "w-2/3"
              }`}
            />
          </div>
          <div className="home-loading-surface h-3 w-12 shrink-0 rounded" />
        </div>
      ))}
    </div>
  );
}

export function NoticeBoard() {
  const { lang } = useLanguage();
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [notices, setNotices] = useState<Record<string, NoticeItemProps[]>>({});
  const [loading, setLoading] = useState(false);

  const tabs = [
    { code: "all", labelKo: "전체", labelEn: "All" },
    { code: "공지", labelKo: "공지", labelEn: "Notice" },
    { code: "행사", labelKo: "행사", labelEn: "Events" },
    { code: "HoC", labelKo: "HoC", labelEn: "HoC" },
    { code: "홍보글", labelKo: "홍보글", labelEn: "Promotions" },
    { code: "건의사항", labelKo: "건의사항", labelEn: "Suggestions" },
    { code: "연구실", labelKo: "연구실", labelEn: "Labs" },
    { code: "QnA", labelKo: "QnA", labelEn: "Q&A" },
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

  const displayNotices = useMemo(() => {
    return currentNotices;
  }, [currentNotices]);

  useEffect(() => {
    let active = true;
    const fetchNotices = async () => {
      setLoading(true);
      try {
        const res =
          activeCategory === "all"
            ? await apiClient.getAllArticles({ limit: 12, page: 1 })
            : await apiClient.getArticles(activeCategory, { limit: 12 });
        // Filter out items with blank/empty titles
        const items = res.items
          .filter((item) => item.titleKo && item.titleKo.trim() !== "")
          .sort((a, b) => {
            if (a.isPinned !== b.isPinned) {
              return Number(b.isPinned) - Number(a.isPinned);
            }
            return isoToMs(b.postedAt) - isoToMs(a.postedAt);
          })
          .map((item, idx) => ({
            id: item.articleId,
            category:
              activeCategory === "all"
                ? item.boardCode || "공지"
                : activeCategory,
            categoryLabel: getCategoryLabel(
              activeCategory === "all"
                ? item.boardCode || "공지"
                : activeCategory,
            ),
            lang,
            title: lang === "ko" ? item.titleKo : item.titleEn || item.titleKo,
            date: formatDate(item.postedAt),
            isImportant: item.isPinned,
            isNew: (() => {
              if (activeCategory !== "공지" && activeCategory !== "all") {
                return false;
              }
              return isoToMs(item.postedAt) >= nowMs() - 4 * 24 * 60 * 60 * 1000;
            })(),
            count:
              activeCategory === "공지"
                ? [12, 8, 3, 5, 2, 1, 4, 6, 3, 2, 1, 1][idx]
                : undefined,
        }));
        if (active) {
          setNotices((prev) => ({ ...prev, [activeNoticeKey]: items }));
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (active) {
          setLoading(false);
        }
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
    <section className="home-bento-card flex h-full min-w-0 flex-col overflow-hidden px-5 py-2 pt-2.5 pb-1.5 select-none">
      <div className="mx-auto flex min-h-0 w-full flex-1 flex-col">
        {/* Tabs */}
        <div className="mb-1.5 flex shrink-0 items-stretch justify-between gap-4 border-b border-slate-100">
          <div className="flex min-w-0 flex-1 flex-nowrap items-stretch gap-4 overflow-x-auto pr-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {tabs.map((tab, index) => (
              <div
                key={index}
                className="relative group"
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                <button
                  onClick={() => setActiveTab(index)}
                  className={`relative flex h-full items-center justify-center whitespace-nowrap border-0 bg-transparent text-[13px] font-semibold transition-colors cursor-pointer ${
                    activeTab === index
                      ? "text-brand-primary"
                      : "text-slate-400 hover:text-brand-primary"
                  }`}
                >
                  <span className="py-1.5">
                    {lang === "ko" ? tab.labelKo : tab.labelEn}
                  </span>
                  <span
                    className={`absolute bottom-0 left-0 right-0 h-0.5 bg-brand-primary transition-transform duration-200 origin-center rounded-t-full ${
                      activeTab === index
                        ? "scale-x-100"
                        : hoveredIndex === index
                          ? "scale-x-100"
                          : "scale-x-0"
                    }`}
                  />
                </button>
              </div>
            ))}
          </div>

          <Link
            to={activeCategory === "all" ? "/board" : `/board/${activeCategory}`}
            className="home-more-link shrink-0"
            onMouseEnter={() => setHoveredIndex(tabs.length)}
            onMouseLeave={() => setHoveredIndex(null)}
          >
            <span>{lang === "ko" ? "더보기" : "More"}</span>
            <ChevronRight className="h-3 w-3" />
          </Link>
        </div>

        {/* Notice List */}
        <div className="min-h-0 flex-1 overflow-y-auto pt-1 pb-1">
          {loading ? (
            <NoticeBoardSkeleton />
          ) : displayNotices.length > 0 ? (
            displayNotices.map((notice, index) => (
              <NoticeItem
                key={notice.id}
                {...notice}
                lang={lang}
                showGroupDivider={
                  index > 0 &&
                  !notice.isImportant &&
                  Boolean(displayNotices[index - 1]?.isImportant)
                }
              />
            ))
          ) : (
            <div className="flex h-full min-h-[180px] flex-col items-center justify-center text-slate-400 text-sm font-semibold">
              {lang === "ko" ? "게시글이 없습니다." : "No posts available."}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
