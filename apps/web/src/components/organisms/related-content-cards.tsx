import { uiText } from "@/lib/i18n/surface-catalog";
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { ContentLocale, RelatedContentCard } from '@soc/contracts';
import { surveyApi } from '@/lib/survey-api';
type Subject = {
    articleId: string;
} | {
    eventId: string;
} | {
    surveyId: string;
};
export function RelatedContentCards({ subject, locale }: {
    subject: Subject;
    locale: ContentLocale;
}) {
    const [items, setItems] = useState<RelatedContentCard[]>([]);
    const [failed, setFailed] = useState(false);
    const subjectKey = JSON.stringify(subject);
    useEffect(() => {
        const controller = new AbortController();
        setItems([]);
        setFailed(false);
        void surveyApi.related(subject, locale, controller.signal).then((response) => setItems(response.items)).catch((error: unknown) => {
            if ((error as {
                name?: string;
            }).name !== 'AbortError')
                setFailed(true);
        });
        return () => controller.abort();
    }, [subjectKey, locale]);
    if (failed)
        return <p role="status" className="mt-6 rounded border border-red-200 bg-red-50 p-4">{uiText("components.organisms.related-content-cards.6cf4e06bf3")}</p>;
    if (!items.length)
        return null;
    return <section aria-labelledby="related-content-heading" className="mt-8 border-t pt-6">
    <h3 id="related-content-heading" className="text-xl font-extrabold">{uiText("components.organisms.related-content-cards.efab2527b4")}</h3>
    <ul className="mt-3 grid gap-3 md:grid-cols-2">{items.map((item) => <li key={`${item.kind}-${item.id}`}><Link to={item.href} className="block rounded border bg-white p-4 shadow-sm"><span className="text-xs font-bold text-kaist-darkgreen">{item.kind === 'ARTICLE' ? uiText("components.organisms.related-content-cards.847c8582b6") : item.kind === 'EVENT' ? uiText("components.organisms.related-content-cards.a6e55f8c8f") : uiText("components.organisms.related-content-cards.641da67d79")}</span><strong className="mt-1 block">{item.title}</strong>{item.kind === 'EVENT' && <time className="mt-1 block text-sm text-slate-600">{new Date(item.startsAt).toLocaleDateString(locale === 'en' ? 'en-US' : 'ko-KR')}</time>}{item.kind === 'SURVEY' && item.closesAt && <time className="mt-1 block text-sm text-slate-600">{new Date(item.closesAt).toLocaleDateString(locale === 'en' ? 'en-US' : 'ko-KR')}{uiText("components.organisms.related-content-cards.bf9a528f2b")}</time>}</Link></li>)}</ul>
  </section>;
}
