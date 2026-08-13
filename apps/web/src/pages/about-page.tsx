import { ArrowRight, BookOpen, HelpCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { PublicFaqListResponse } from '@soc/contracts';
import { SiteLayout } from '@/components/organisms/site-layout';
import { getFaqs } from '@/lib/faq-api';
import { uiText } from '@/lib/i18n/surface-catalog';
import { localizedText } from '@/lib/localized-content';

export function AboutPage() {
  const pageContainerClass = 'mx-auto w-full max-w-[1600px] px-6';
  const headerContainerClass = 'mx-auto max-w-[1600px] px-6';
  const [faqItems, setFaqItems] = useState<PublicFaqListResponse['topics'][number]['items']>([]);
  const [faqStatus, setFaqStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    getFaqs()
      .then((response) => {
        setFaqItems(response.topics.flatMap((topic) => topic.items).slice(0, 3));
        setFaqStatus('ready');
      })
      .catch(() => setFaqStatus('error'));
  }, []);

  return (
    <SiteLayout>
      <div className="min-h-[calc(100vh-72px)] bg-[#F7FCFC]">
        <div className="bg-[linear-gradient(90deg,#146D4A_40.8%,#C9ECC2_100%)] px-8 py-7 lg:py-10">
          <div className={headerContainerClass}>
            <h1 className="mb-4 text-[40px] font-extrabold tracking-tight text-kaist-white">{uiText('pages.about-page.0208160d70')}</h1>
            <p className="max-w-4xl text-[24px] font-semibold leading-normal tracking-tight text-kaist-white">
              KAIST School of Computing의 학부 생활과 학업 정보를 한 곳에서 안내합니다.
            </p>
          </div>
        </div>

        <section className={`${pageContainerClass} pb-16 pt-10`}>
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1.45fr)_minmax(340px,0.65fr)]">
            <main className="overflow-hidden rounded-[8px] border border-kaist-grey/20 bg-white shadow-[0_20px_70px_rgba(57,64,75,0.08)]">
              <div className="border-b border-kaist-grey/20 px-6 py-8 md:px-8 md:py-9">
                <div className="flex flex-wrap items-center gap-5">
                  <img src="/kaist_logo.png" alt="KAIST Logo" className="h-[31px] w-auto" />
                  <div className="h-5 w-px bg-kaist-grey/40" />
                  <img src="/logo.png" alt="SOC Logo" className="mb-2 h-[34px] w-auto" />
                </div>
                <h2 className="mt-6 text-[30px] font-extrabold leading-tight tracking-tight text-kaist-black md:text-[34px]">
                  KAIST SoC
                </h2>
                <p className="mt-2 text-[15px] font-semibold leading-7 text-kaist-grey">
                  School of Computing
                </p>
              </div>

              <div>
                <section className="px-6 py-10 md:px-8 md:py-12">
                  <div className="max-w-5xl space-y-5 text-[15px] font-semibold leading-8 text-[#3d4a45]">
                    <p className="text-[20px] font-extrabold leading-8 text-kaist-black">
                      KAIST SoC(School Of Computing)
                    </p>
                    <p>{uiText('pages.about-page.d90dc4f920')}</p>
                    <p>{uiText('pages.about-page.acc3da09c6')}</p>
                    <p>{uiText('pages.about-page.c831428c37')}</p>
                  </div>
                </section>
              </div>
            </main>

            <aside className="grid content-start gap-5">
              <section className="rounded-[8px] border border-kaist-grey/20 bg-white px-5 py-5 shadow-[0_12px_32px_rgba(57,64,75,0.05)]">
                <div className="mb-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <HelpCircle className="h-5 w-5 text-kaist-darkgreen" aria-hidden="true" />
                    <h2 className="text-[18px] font-extrabold tracking-tight text-kaist-black">FAQ</h2>
                  </div>
                  <Link to="/faq" className="inline-flex items-center gap-1 text-xs font-extrabold text-kaist-darkgreen">
                    {uiText('pages.about-page.b05f43570a')}
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </Link>
                </div>

                <div className="divide-y divide-kaist-grey/15">
                  {faqStatus === 'loading' ? (
                    <p className="py-6 text-sm font-semibold text-kaist-grey">{uiText('pages.about-page.2036a2150a')}</p>
                  ) : faqStatus === 'error' ? (
                    <p role="alert" className="py-6 text-sm font-semibold text-kaist-grey">{uiText('pages.about-page.8b9c33a6cc')}</p>
                  ) : faqItems.length === 0 ? (
                    <p className="py-6 text-sm font-semibold text-kaist-grey">{uiText('pages.about-page.54beaf81ff')}</p>
                  ) : (
                    faqItems.map((item, index) => (
                      <Link key={`${item.id}-${index}`} to="/faq" className="block py-4 first:pt-0 last:pb-0">
                        <p className="line-clamp-2 text-[14px] font-extrabold leading-6 tracking-tight text-kaist-black">
                          {index + 1}. {localizedText(item.question)}
                        </p>
                        <p className="mt-1 line-clamp-2 text-[12px] font-semibold leading-5 text-kaist-grey">
                          {localizedText(item.answer)}
                        </p>
                      </Link>
                    ))
                  )}
                </div>
              </section>

              <section className="rounded-[8px] border border-kaist-grey/20 bg-white px-5 py-5 shadow-[0_12px_32px_rgba(57,64,75,0.05)]">
                <div className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-kaist-darkgreen" aria-hidden="true" />
                  <h2 className="text-[18px] font-extrabold tracking-tight text-kaist-black">{uiText('pages.about-page.3113991d60')}</h2>
                </div>
                <p className="mt-3 text-[13px] font-semibold leading-6 text-kaist-grey">{uiText('pages.about-page.df95348cf5')}</p>
                <Link to="/about/roadmap" className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-[5px] bg-kaist-darkgreen px-4 text-[13px] font-extrabold text-white transition hover:bg-kaist-darkgreen-main">
                  {uiText('pages.about-page.ef6a222828')}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </section>
            </aside>
          </div>
        </section>
      </div>
    </SiteLayout>
  );
}
