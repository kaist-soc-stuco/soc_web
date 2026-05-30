import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { createApiClient } from "@soc/api-client";
import { isoToDate, isoToMs, nowMs } from "@soc/shared";
import { Pin } from "lucide-react";
import { resolveApiBaseUrl } from "@/lib/api-base-url";

interface NoticeItemProps {
  id: string;
  category: string;
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
  title,
  date,
  isImportant,
  isNew,
  count,
  showGroupDivider,
}: NoticeItemProps) {
  return (
    <Link
      to={`/board/${isImportant ? "공지" : category}/${id}`}
      className={`block px-4 transition-colors hover:bg-slate-50/80 ${
        showGroupDivider ? "border-t border-slate-100" : ""
      }`}
    >
      <div className="flex items-center justify-between py-2.5 gap-4">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {isImportant ? (
            <span className="inline-flex items-center bg-[#e6f4ea] text-[#137333] border border-[#137333]/10 rounded-full px-2 py-0.5 text-[10px] font-extrabold shrink-0 select-none">
              <span>공지</span>
            </span>
          ) : (
            <span className="bg-[#e6f4ea] text-[#137333] rounded-full px-2.5 py-0.5 text-[10px] font-bold shrink-0 tracking-tight select-none">
              {category}
            </span>
          )}
          <span
            className={`text-[13.5px] tracking-tight truncate ${
              isImportant
                ? "text-slate-800 font-semibold"
                : "text-slate-600 font-normal hover:text-kaist-darkgreen"
            }`}
          >
            {isImportant ? (
              <Pin className="mr-1 inline h-3 w-3 align-[-1px] text-slate-400" />
            ) : null}
            {title}
          </span>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <span className="text-[11.5px] font-normal tracking-tight text-slate-400">
            {date}
          </span>

          {isNew && (
            <span className="w-4 h-4 bg-[#f03e3e] text-white rounded-full flex items-center justify-center text-[9px] font-black shrink-0">
              N
            </span>
          )}
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

export function NoticeBoard() {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [notices, setNotices] = useState<Record<string, NoticeItemProps[]>>({});
  const [loading, setLoading] = useState(false);

  const tabs = [
    { label: "공지" },
    { label: "행사" },
    { label: "HoC" },
    { label: "홍보글" },
    { label: "건의사항" },
    { label: "연구실" },
    { label: "QnA" },
  ];

  const apiClient = useMemo(
    () => createApiClient({ baseUrl: resolveApiBaseUrl() }),
    [],
  );
  const activeCategory = tabs[activeTab].label;

  const currentNotices = notices[activeCategory] || [];

  const displayNotices = useMemo(() => {
    return currentNotices.slice(0, 5);
  }, [currentNotices]);

  useEffect(() => {
    let active = true;
    const fetchNotices = async () => {
      setLoading(true);
      try {
        const res = await apiClient.getArticles(activeCategory, { limit: 5 });
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
            category: activeCategory,
            title: item.titleKo,
            date: formatDate(item.postedAt),
            isImportant: item.isPinned,
            isNew: (() => {
              if (activeCategory !== "공지") return false;
              return isoToMs(item.postedAt) >= nowMs() - 4 * 24 * 60 * 60 * 1000;
            })(),
            count:
              activeCategory === "공지" ? [12, 8, 3, 5, 2][idx] : undefined,
          }));
        if (active) {
          setNotices((prev) => ({ ...prev, [activeCategory]: items }));
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    if (!notices[activeCategory]) {
      void fetchNotices();
    }
  }, [activeCategory, notices, apiClient]);

  return (
    <section className="bg-white rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgba(0,0,0,0.025)] px-6 py-2 pt-2.5 pb-1.5 h-full flex flex-col select-none">
      <div className="mx-auto w-full flex-1 flex flex-col justify-between">
        <div>
          {/* Tabs */}
          <div className="flex items-stretch justify-between gap-4 border-b border-slate-100 mb-1.5 shrink-0">
            <div className="flex flex-wrap items-stretch gap-6">
              {tabs.map((tab, index) => (
                <div
                  key={index}
                  className="relative group"
                  onMouseEnter={() => setHoveredIndex(index)}
                  onMouseLeave={() => setHoveredIndex(null)}
                >
                  <button
                    onClick={() => setActiveTab(index)}
                    className={`relative flex items-center justify-center h-full text-[14.5px] tracking-tight transition-colors border-0 bg-transparent cursor-pointer ${
                      activeTab === index
                        ? "text-[#137333] font-semibold"
                        : "text-slate-400 hover:text-[#137333] font-medium"
                    }`}
                  >
                    <span className="py-1.5">{tab.label}</span>
                    <span
                      className={`absolute bottom-0 left-[-10px] right-[-10px] h-0.5 bg-[#137333] transition-transform duration-200 origin-center rounded-t-full ${
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

            {/* Plus Button */}
            <Link
              to={`/board/${tabs[activeTab].label}`}
              className="relative group"
              onMouseEnter={() => setHoveredIndex(tabs.length)}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              <div className="relative flex items-center justify-center h-full text-base tracking-tight text-slate-400 hover:text-[#137333] font-medium transition-colors cursor-pointer">
                <span className="py-1.5">+</span>
                <span
                  className={`absolute bottom-0 left-0 right-0 h-0.5 bg-[#137333] transition-transform duration-200 origin-center rounded-t-full ${
                    hoveredIndex === tabs.length ? "scale-x-100" : "scale-x-0"
                  }`}
                />
              </div>
            </Link>
          </div>

          {/* Notice List */}
          <div className="overflow-y-auto min-h-[225px] pt-1">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-kaist-darkgreen"></div>
              </div>
            ) : displayNotices.length > 0 ? (
              displayNotices.map((notice, index) => (
                <NoticeItem
                  key={notice.id}
                  {...notice}
                  showGroupDivider={
                    index > 0 &&
                    !notice.isImportant &&
                    Boolean(displayNotices[index - 1]?.isImportant)
                  }
                />
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400 text-sm font-semibold">
                게시글이 없습니다.
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
