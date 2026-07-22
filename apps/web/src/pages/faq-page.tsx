import { useMemo, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';

import { SiteLayout } from '@/components/organisms/site-layout';
import { faqCategories, faqItems, type FaqCategory } from '@/lib/mock-data';

export function FaqPage() {
  const pageContainerClass = 'mx-auto w-full px-[12vw]';
  const [activeCategory, setActiveCategory] = useState<FaqCategory>('전체');
  const [searchQuery, setSearchQuery] = useState('');
  const [openId, setOpenId] = useState<number | null>(faqItems[0]?.id ?? null);

  const filteredItems = useMemo(
    () =>
      faqItems.filter((item) => {
        const matchesCategory = activeCategory === '전체' || item.category === activeCategory;
        const normalizedQuery = searchQuery.trim().toLowerCase();
        const matchesSearch =
          normalizedQuery.length === 0 ||
          item.question.toLowerCase().includes(normalizedQuery) ||
          item.answer.toLowerCase().includes(normalizedQuery) ||
          item.category.toLowerCase().includes(normalizedQuery);

        return matchesCategory && matchesSearch;
      }),
    [activeCategory, searchQuery],
  );

  const handleCategoryChange = (category: FaqCategory) => {
    setActiveCategory(category);
    setOpenId(null);
  };

  return (
    <SiteLayout>
      <div className="min-h-[calc(100vh-72px)] bg-[#F7FCFC]">
        <div className="bg-[linear-gradient(90deg,#146D4A_40.8%,#C9ECC2_100%)] py-12">
          <div className={pageContainerClass}>
            <h1 className="mb-2 text-[36px] font-extrabold tracking-tight text-kaist-white">FAQ</h1>
            <p className="text-[24px] font-semibold tracking-tight text-kaist-white">자주 묻는 질문을 확인하세요</p>
          </div>
        </div>

        <section className={`${pageContainerClass} pb-16 pt-10`}>
          <div className="w-full">
            <div className="mb-8">
              <h2 className="text-[30px] font-extrabold leading-tight tracking-tight text-kaist-black md:text-[36px]">
                궁금한 사항이 있으신가요?
              </h2>

              <label className="mt-8 flex items-center gap-4 border-b-2 border-kaist-black/60 pb-4">
                <Search className="h-6 w-6 text-kaist-greygreen" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="검색어를 입력해주세요"
                  className="min-w-0 flex-1 bg-transparent text-[18px] font-semibold tracking-tight text-kaist-black placeholder:text-kaist-greygreen focus:outline-none"
                />
              </label>
            </div>

            <div className="mb-10 grid grid-cols-2 border border-kaist-grey/25 bg-white sm:grid-cols-3">
              {faqCategories.map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => handleCategoryChange(category)}
                  className={`h-[56px] border-b border-r border-kaist-grey/25 text-[16px] font-extrabold tracking-tight transition last:border-r-0 sm:[&:nth-child(3n)]:border-r-0 ${
                    activeCategory === category
                      ? 'bg-kaist-darkgreen-main text-kaist-white'
                      : 'bg-white text-kaist-black hover:bg-kaist-grey/10'
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>

            <div className="overflow-hidden rounded-[8px] border border-kaist-grey/15 bg-white">
              {filteredItems.length > 0 ? (
                filteredItems.map((item) => {
                  const isOpen = openId === item.id;

                  return (
                    <article key={item.id} className="border-b border-kaist-grey/15 last:border-b-0">
                      <button
                        type="button"
                        onClick={() => setOpenId(isOpen ? null : item.id)}
                        className="flex w-full items-start justify-between gap-5 px-6 py-6 text-left transition hover:bg-kaist-grey/5 md:px-8"
                      >
                        <span>
                          <span className="text-[13px] font-extrabold tracking-tight text-kaist-darkgreen-main">#{item.category}</span>
                          <span className="mt-2 block text-[18px] font-extrabold leading-normal tracking-tight text-kaist-black md:text-[20px]">
                            {item.question}
                          </span>
                          <span className="mt-2 block text-[13px] font-semibold tracking-tight text-kaist-greygreen">{item.updatedAt}</span>
                        </span>
                        <ChevronDown
                          className={`mt-7 h-5 w-5 flex-shrink-0 text-kaist-greygreen transition-transform ${isOpen ? 'rotate-180' : ''}`}
                        />
                      </button>

                      {isOpen ? (
                        <div className="px-6 pb-6 text-[15px] font-semibold leading-7 tracking-tight text-kaist-grey md:px-8 md:text-[16px]">
                          {item.answer}
                        </div>
                      ) : null}
                    </article>
                  );
                })
              ) : (
                <div className="px-6 py-16 text-center text-kaist-grey">
                  <p className="text-base font-semibold">검색 결과가 없습니다</p>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </SiteLayout>
  );
}
