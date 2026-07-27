import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import type { PublicFaqListResponse } from '@soc/contracts';

import { SiteLayout } from '@/components/organisms/site-layout';
import { getFaqs } from '@/lib/faq-api';
import { localizedText } from '@/lib/localized-content';

type FaqCategory = 'all' | string;

export function FaqPage() {
  const pageContainerClass = 'mx-auto w-full px-[12vw]';
  const [topics, setTopics] = useState<PublicFaqListResponse['topics']>([]);
  const [activeCategory, setActiveCategory] = useState<FaqCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  const loadFaqs = async () => {
    setStatus('loading');

    try {
      const response = await getFaqs();
      setTopics(response.topics);
      setOpenId(response.topics.flatMap((topic) => topic.items)[0]?.id ?? null);
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  };

  useEffect(() => {
    void loadFaqs();
  }, []);

  const categories = useMemo(
    () => topics.map((topic) => ({ id: topic.id, title: localizedText(topic.title) })),
    [topics],
  );

  const filteredItems = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return topics.flatMap((topic) =>
      topic.items
        .filter((item) => {
          const matchesCategory = activeCategory === 'all' || topic.id === activeCategory;
          const matchesSearch =
            normalizedQuery.length === 0 ||
            localizedText(item.question).toLowerCase().includes(normalizedQuery) ||
            localizedText(item.answer).toLowerCase().includes(normalizedQuery) ||
            localizedText(topic.title).toLowerCase().includes(normalizedQuery);

          return matchesCategory && matchesSearch;
        })
        .map((item) => ({
          ...item,
          category: localizedText(topic.title),
          question: localizedText(item.question),
          answer: localizedText(item.answer),
        })),
    );
  }, [activeCategory, searchQuery, topics]);

  const handleCategoryChange = (category: FaqCategory) => {
    setActiveCategory(category);
    setOpenId(null);
  };

  return (
    <SiteLayout>
      <div className="min-h-[calc(100vh-72px)] bg-[#F7FCFC]">
        <div className="bg-[linear-gradient(90deg,#146D4A_40.8%,#C9ECC2_100%)] py-8">
          <div className={pageContainerClass}>
            <h1 className="mb-2 text-[32px] font-extrabold tracking-tight text-kaist-white">FAQ</h1>
            <p className="text-[20px] font-semibold tracking-tight text-kaist-white">자주 묻는 질문을 확인하세요</p>
          </div>
        </div>

        <section className={`${pageContainerClass} pb-16 pt-8`}>
          <div className="w-full">
            <div className="mb-7">
              <h2 className="text-[26px] font-extrabold leading-tight tracking-tight text-kaist-black md:text-[30px]">
                궁금한 사항이 있으신가요?
              </h2>

              <label className="mt-7 flex items-center gap-3 border-b-2 border-kaist-black/60 pb-3">
                <Search className="h-5 w-5 text-kaist-greygreen" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="검색어를 입력해주세요"
                  className="min-w-0 flex-1 bg-transparent text-[16px] font-semibold tracking-tight text-kaist-black placeholder:text-kaist-greygreen focus:outline-none"
                />
              </label>
            </div>

            <div className="mb-8 grid grid-cols-2 border border-kaist-grey/25 bg-white sm:grid-cols-3">
              {status === 'ready'
                ? [{ id: 'all', title: '전체' }, ...categories].map((category) => (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => handleCategoryChange(category.id)}
                      className={`h-[48px] border-b border-r border-kaist-grey/25 text-[14px] font-extrabold tracking-tight transition last:border-r-0 sm:[&:nth-child(3n)]:border-r-0 ${
                        activeCategory === category.id
                          ? 'bg-kaist-darkgreen-main text-kaist-white'
                          : 'bg-white text-kaist-black hover:bg-kaist-grey/10'
                      }`}
                    >
                      {category.title}
                    </button>
                  ))
                : null}
            </div>

            <div className="overflow-hidden rounded-[8px] border border-kaist-grey/15 bg-white">
              {status === 'loading' ? (
                <div className="px-6 py-16 text-center text-kaist-grey">
                  <p className="text-base font-semibold">FAQ를 불러오는 중입니다</p>
                </div>
              ) : status === 'error' ? (
                <div className="px-6 py-16 text-center text-kaist-grey">
                  <p className="text-base font-semibold">FAQ를 불러오지 못했습니다</p>
                  <button
                    type="button"
                    onClick={() => void loadFaqs()}
                    className="mt-4 text-sm font-extrabold text-kaist-darkgreen-main underline"
                  >
                    다시 시도
                  </button>
                </div>
              ) : filteredItems.length > 0 ? (
                filteredItems.map((item) => {
                  const isOpen = openId === item.id;

                  return (
                    <article key={item.id} className="border-b border-kaist-grey/15 last:border-b-0">
                      <button
                        type="button"
                        onClick={() => setOpenId(isOpen ? null : item.id)}
                        className="flex w-full items-start justify-between gap-5 px-6 py-5 text-left transition hover:bg-kaist-grey/5 md:px-7"
                      >
                        <span>
                          <span className="text-[13px] font-extrabold tracking-tight text-kaist-darkgreen-main">#{item.category}</span>
                          <span className="mt-2 block text-[16px] font-extrabold leading-normal tracking-tight text-kaist-black md:text-[18px]">
                            {item.question}
                          </span>
                          <span className="mt-2 block text-[13px] font-semibold tracking-tight text-kaist-greygreen">{item.updatedAt}</span>
                        </span>
                        <ChevronDown
                          className={`mt-7 h-5 w-5 flex-shrink-0 text-kaist-greygreen transition-transform ${isOpen ? 'rotate-180' : ''}`}
                        />
                      </button>

                      {isOpen ? (
                        <div className="px-6 pb-5 text-[14px] font-semibold leading-7 tracking-tight text-kaist-grey md:px-7 md:text-[15px]">
                          {item.answer}
                        </div>
                      ) : null}
                    </article>
                  );
                })
              ) : (
                <div className="px-6 py-16 text-center text-kaist-grey">
                  <p className="text-base font-semibold">
                    {topics.some((topic) => topic.items.length > 0) ? '검색 결과가 없습니다' : '등록된 FAQ가 없습니다'}
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </SiteLayout>
  );
}
