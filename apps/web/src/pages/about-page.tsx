import { uiText } from "@/lib/i18n/surface-catalog";
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { PublicFaqListResponse } from '@soc/contracts';
import { SiteLayout } from '@/components/organisms/site-layout';
import { getFaqs } from '@/lib/faq-api';
import { localizedText } from '@/lib/localized-content';
export function AboutPage() {
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
      <div className="min-h-[calc(100vh-56px)] bg-[#92A38D] px-6 py-10">
        <div className="mx-auto max-w-6xl overflow-hidden rounded-[8px] border border-[#c8d5cb] bg-white shadow-[0_20px_70px_rgba(57,64,75,0.12)]">
          <div className="h-4 bg-[linear-gradient(90deg,#006B4A_0%,#8DCDAE_100%)]" />
          <div className="border-b border-[#d8e3db] px-8 py-4">
            <p className="text-xs font-semibold tracking-[0.18em] text-kaist-grey">ABOUT</p>
            <h1 className="mt-2 text-[28px] font-extrabold tracking-tight text-kaist-black">{uiText("pages.about-page.0208160d70")}</h1>
          </div>

          <div className="grid gap-8 px-8 py-8 lg:grid-cols-[1.7fr_0.9fr]">
            <section className="rounded-[6px] border border-[#d7e2da] bg-[#fcfdfc] px-6 py-6">
              <div className="max-w-3xl space-y-5 text-[14px] font-medium leading-7 text-[#3d4a45]">
                <p className="text-[18px] font-extrabold leading-8 text-kaist-black">
                  KAIST SoC(School Of Computing)
                </p>
                <p>{uiText("pages.about-page.d90dc4f920")}</p>
                <p>{uiText("pages.about-page.acc3da09c6")}</p>
                <p>{uiText("pages.about-page.c831428c37")}</p>
              </div>
            </section>

            <aside className="flex flex-col gap-5">
              <section className="rounded-[6px] border border-[#d7e2da] bg-white px-5 py-5">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-[18px] font-extrabold tracking-tight text-kaist-black">FAQ</h2>
                  <Link to="/faq" className="text-xs font-bold text-kaist-darkgreen">{uiText("pages.about-page.b05f43570a")}</Link>
                </div>

                <div className="space-y-3">
                  {faqStatus === 'loading' ? <p className="py-6 text-sm text-kaist-grey">{uiText("pages.about-page.2036a2150a")}</p> : faqStatus === 'error' ? <p role="alert" className="py-6 text-sm text-kaist-grey">{uiText("pages.about-page.8b9c33a6cc")}</p> : faqItems.length === 0 ? <p className="py-6 text-sm text-kaist-grey">{uiText("pages.about-page.54beaf81ff")}</p> : faqItems.map((item, index) => (<Link key={`${item.id}-${index}`} to="/faq" className="block border-b border-[#dfe8e2] pb-3 last:border-b-0 last:pb-0">
                      <p className="text-[13px] font-extrabold tracking-tight text-kaist-darkgreen">
                        {index + 1}. {localizedText(item.question)}
                      </p>
                      <p className="mt-1 text-[12px] font-medium leading-5 text-kaist-grey">
                        {localizedText(item.answer)}
                      </p>
                    </Link>))}
                </div>
              </section>

              <section className="rounded-[6px] border border-[#d7e2da] bg-[#f8fbf8] px-5 py-5">
                <p className="text-xs font-semibold tracking-[0.18em] text-kaist-grey">ROADMAP</p>
                <h2 className="mt-2 text-[18px] font-extrabold tracking-tight text-kaist-black">{uiText("pages.about-page.3113991d60")}</h2>
                <p className="mt-3 text-[12px] font-medium leading-5 text-kaist-grey">{uiText("pages.about-page.df95348cf5")}</p>
                <Link to="/about/roadmap" className="mt-5 inline-flex items-center rounded-[4px] bg-kaist-darkgreen px-4 py-2.5 text-[12px] font-bold text-white transition hover:bg-kaist-darkgreen-main">{uiText("pages.about-page.ef6a222828")}</Link>
              </section>
            </aside>
          </div>
        </div>
      </div>
    </SiteLayout>);
}
