import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { createApiClient } from '@soc/api-client';
import { resolveApiBaseUrl } from '@/lib/api';

interface NoticeItemProps {
  id: string;
  category: string;
  title: string;
  date: string;
}

function NoticeItem({ id, category, title, date }: NoticeItemProps) {
  return (
    <Link
      to={`/board/${category}/${id}`}
      className="block hover:bg-kaist-lightgreen/10 transition-colors px-2 rounded-lg"
    >
      <div className="flex items-center justify-between py-[14px] gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="inline-flex items-center rounded-full bg-kaist-darkgreen px-2 py-0.5 text-xs font-semibold tracking-tight text-kaist-white flex-shrink-0">
            {category}
          </span>
          <span className="text-sm font-semibold tracking-tight text-kaist-black truncate">
            {title}
          </span>
        </div>
        <span className="text-xs font-semibold tracking-tight text-kaist-grey flex-shrink-0">
          {date}
        </span>
      </div>
    </Link>
  );
}

function formatDate(dateIso: string) {
  const d = new Date(dateIso);
  if (isNaN(d.getTime())) return "";
  const yy = String(d.getFullYear()).slice(-2);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yy}.${mm}.${dd}`;
}

export function NoticeBoard() {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [notices, setNotices] = useState<Record<string, NoticeItemProps[]>>({});
  const [loading, setLoading] = useState(false);

  const tabs = [
    { label: '공지' },
    { label: '행사' },
    { label: 'HoC' },
    { label: '홍보글' },
    { label: '건의사항' },
    { label: '연구실' },
    { label: 'QnA' },
  ];

  const apiClient = useMemo(() => createApiClient({ baseUrl: resolveApiBaseUrl() }), []);
  const activeCategory = tabs[activeTab].label;
  const currentNotices = notices[activeCategory] || [];

  useEffect(() => {
    let active = true;
    const fetchNotices = async () => {
      setLoading(true);
      try {
        const res = await apiClient.getArticles(activeCategory, { limit: 5 });
        const items = res.items.map((item) => ({
          id: item.articleId,
          category: activeCategory,
          title: item.titleKo,
          date: formatDate(item.postedAt),
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

    // Fetch notice list only if not cached yet
    if (!notices[activeCategory]) {
      void fetchNotices();
    }
  }, [activeCategory, notices, apiClient]);

  return (
    <section className="bg-kaist-white">
      <div className="mx-auto w-full max-w-4xl px-4">
        {/* Tabs */}
        <div className="flex items-stretch justify-between gap-4 border-b-2 border-kaist-grey/30">
          <div className="flex flex-wrap items-stretch gap-4">
            {tabs.map((tab, index) => (
              <div
                key={index}
                className="relative group"
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                <button
                  onClick={() => setActiveTab(index)}
                  className={`relative flex items-center justify-center h-full text-base font-extrabold tracking-tight transition-colors border-0 bg-transparent cursor-pointer ${
                    activeTab === index 
                      ? 'text-kaist-darkgreen' 
                      : 'text-kaist-greygreen hover:text-kaist-darkgreen'
                  }`}
                >
                  <span className="py-2">{tab.label}</span>
                  <span 
                    className={`absolute bottom-0 left-0 right-0 h-1 bg-kaist-darkgreen transition-transform duration-200 origin-center ${
                      activeTab === index ? 'scale-x-100' : hoveredIndex === index ? 'scale-x-100' : 'scale-x-0'
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
            <div className="relative flex items-center justify-center h-full text-base font-extrabold tracking-tight text-kaist-greygreen hover:text-kaist-darkgreen transition-colors">
              <span className="py-2">+</span>
              <span 
                className={`absolute bottom-0 left-0 right-0 h-1 bg-kaist-darkgreen transition-transform duration-200 origin-center ${
                  hoveredIndex === tabs.length ? 'scale-x-100' : 'scale-x-0'
                }`}
              />
            </div>
          </Link>
        </div>

        {/* Notice List */}
        <div className="flex-1 divide-y divide-kaist-grey/20 border-b border-kaist-grey/20 overflow-y-auto min-h-[220px]">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-kaist-darkgreen"></div>
            </div>
          ) : currentNotices.length === 0 ? (
            <div className="flex items-center justify-center py-16 text-sm text-kaist-grey font-bold">
              등록된 게시글이 없습니다.
            </div>
          ) : (
            currentNotices.map((notice) => (
              <NoticeItem key={notice.id} {...notice} />
            ))
          )}
        </div>
      </div>
    </section>
  );
}
