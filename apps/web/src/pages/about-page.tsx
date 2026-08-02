import { uiText } from "@/lib/i18n/surface-catalog";
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { PublicFaqListResponse } from '@soc/contracts';
import { SiteLayout } from '@/components/organisms/site-layout';
import { getFaqs } from '@/lib/faq-api';
import { localizedText } from '@/lib/localized-content';
export function AboutPage() {
    const pageContainerClass = 'mx-auto w-full px-[12vw]';
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
    return (<SiteLayout>
      <div className="flex min-h-[calc(100vh-72px)] flex-col bg-[#F7FCFC] lg:h-[calc(100vh-72px)] lg:overflow-hidden">
        <div className="bg-[linear-gradient(90deg,#146D4A_40.8%,#C9ECC2_100%)] py-8">
          <div className={pageContainerClass}>
            <h1 className="mb-2 text-[32px] font-extrabold tracking-tight text-kaist-white">{uiText("pages.about-page.0208160d70")}</h1>
            <p className="text-[20px] font-semibold tracking-tight text-kaist-white">{uiText("pages.about-page.bb0d85824a")}</p>
          </div>
        </div>

        <div className="flex flex-1 items-center py-7 lg:py-0">
          <div className={`${pageContainerClass} grid w-full gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,410px)] lg:gap-8 xl:gap-10`}>
            <section className="min-h-[500px] rounded-[8px] border border-kaist-grey/25 bg-white px-6 py-7 sm:px-10 lg:min-h-[520px] lg:px-8 lg:py-8 xl:min-h-[540px] xl:px-9">
              <h2 className="text-[24px] font-extrabold leading-normal tracking-tight text-kaist-darkgreen md:text-[28px] xl:text-[30px]">
                KAIST SoC(School Of Computing)
              </h2>

              <div className="mt-8 space-y-8 text-[15px] font-normal leading-[1.9] tracking-tight text-black md:text-[16px] lg:text-[17px] xl:text-[18px]">
                <p>{uiText("pages.about-page.d90dc4f920")}</p>
                <p>{uiText("pages.about-page.acc3da09c6")}</p>
                <p>{uiText("pages.about-page.c831428c37")}</p>
              </div>
            </section>

            <aside className="flex flex-col gap-6">
              <section className="rounded-[8px] border border-kaist-grey/25 bg-white px-7 py-5 lg:min-h-[370px]">
                <div className="mb-3 flex items-start justify-between gap-4">
                  <h2 className="text-[24px] font-extrabold leading-normal tracking-tight text-kaist-darkgreen md:text-[28px]">FAQ</h2>
                  <Link to="/faq" className="mt-2 inline-flex items-center justify-center rounded-[5px] border border-kaist-darkgreen px-3 py-1.5 text-[13px] font-extrabold tracking-tight text-kaist-darkgreen transition hover:bg-kaist-darkgreen hover:text-kaist-white">{uiText("pages.about-page.b05f43570a")}</Link>
                </div>

                <div className="divide-y divide-[#d7e2da]">
                  {faqStatus === 'loading' ? <p className="py-6 text-sm text-kaist-grey">{uiText("pages.about-page.2036a2150a")}</p> : faqStatus === 'error' ? <p role="alert" className="py-6 text-sm text-kaist-grey">{uiText("pages.about-page.8b9c33a6cc")}</p> : faqItems.length === 0 ? <p className="py-6 text-sm text-kaist-grey">{uiText("pages.about-page.54beaf81ff")}</p> : faqItems.map((item, index) => (<Link key={`${item.id}-${index}`} to="/faq" className="block py-4 first:pt-2 last:pb-0">
                      <p className="text-[15px] font-semibold leading-normal tracking-tight text-kaist-darkgreen-main md:text-[16px]">
                        Q: {localizedText(item.question)}
                      </p>
                      <p className="mt-2 text-[13px] font-normal leading-normal tracking-tight text-kaist-black md:text-[15px]">
                        A: {localizedText(item.answer)}
                      </p>
                    </Link>))}
                </div>
              </section>

              <section className="rounded-[8px] border border-kaist-grey/25 bg-white px-7 py-6">
                <h2 className="mt-1 text-[22px] font-extrabold leading-normal tracking-tight text-kaist-black md:text-[24px]">{uiText("pages.about-page.3113991d60")}</h2>
                <p className="mt-4 text-[14px] font-semibold leading-[1.75] tracking-tight text-[#8192a3] md:text-[15px]">{uiText("pages.about-page.df95348cf5")}</p>
                <Link to="/about/roadmap" className="mt-7 inline-flex items-center justify-center rounded-[5px] bg-kaist-darkgreen px-5 py-3 text-[14px] font-extrabold tracking-tight text-kaist-white transition hover:bg-kaist-darkgreen-main">{uiText("pages.about-page.ef6a222828")}</Link>
              </section>
            </aside>
          </div>
        </div>
      </div>
    </SiteLayout>);
}
