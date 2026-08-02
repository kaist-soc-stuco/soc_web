import { uiText } from "@/lib/i18n/surface-catalog";
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { SurveyDto } from '@soc/contracts';
import { SurveyApiError, surveyApi } from '@/lib/survey-api';
export function AdminSurveysPage() {
    const [items, setItems] = useState<SurveyDto[]>([]);
    const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
    const [error, setError] = useState('');
    useEffect(() => {
        const controller = new AbortController();
        let active = true;
        surveyApi.listAdmin(controller.signal).then((result) => { if (active) {
            setItems(result.items);
            setStatus('ready');
        } }).catch((cause: unknown) => { if (active && !(cause instanceof DOMException && cause.name === 'AbortError')) {
            setStatus('error');
            setError(cause instanceof SurveyApiError && cause.status === 401 ? uiText("pages.admin-surveys-page.2143060fb5") : cause instanceof TypeError ? uiText("pages.admin-surveys-page.883d591e09") : uiText("pages.admin-surveys-page.1aa2f8c99e"));
        } });
        return () => { active = false; controller.abort(); };
    }, []);
    return <section><div className="mb-6 flex items-center justify-between border-b border-kaist-grey/25 pb-4"><h1 className="text-[32px] font-extrabold">{uiText("pages.admin-surveys-page.bfa15aa4f4")}</h1><Link to="/admin/surveys/new/edit" className="rounded bg-kaist-darkgreen-main px-4 py-2 text-white">{uiText("pages.admin-surveys-page.24122c8060")}</Link></div>{status === 'error' && <p role="alert" className="text-red-600">{error}</p>}{status === 'loading' && <p role="status">{uiText("pages.admin-surveys-page.6276e90dc1")}</p>}{status === 'ready' && items.length === 0 && <p>{uiText("pages.admin-surveys-page.8d47845831")}</p>}{status === 'ready' && items.length > 0 && <div className="rounded bg-white p-5 shadow"><table className="w-full text-left"><thead><tr><th>{uiText("pages.admin-surveys-page.ccb3ab2ed4")}</th><th>{uiText("pages.admin-surveys-page.2926977ba7")}</th><th>{uiText("pages.admin-surveys-page.38313ae9b9")}</th><th /></tr></thead><tbody>{items.map((survey) => <tr key={survey.id} className="border-t"><td>{survey.title.value ?? ''}</td><td>{survey.state}</td><td>{new Date(survey.updatedAt).toLocaleString()}</td><td className="flex gap-3"><Link to={`/admin/surveys/${survey.id}/edit`}>{uiText("pages.admin-surveys-page.d482e14b40")}</Link><Link to={`/admin/surveys/${survey.id}/responses`}>{uiText("pages.admin-surveys-page.89f631d48f")}</Link></td></tr>)}</tbody></table></div>}</section>;
}
