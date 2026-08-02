import { uiText, uiFormat } from '@/lib/i18n/surface-catalog';
import { useState } from 'react';
import { contactApi } from '@/lib/contact-api';
export function AdminEmailsPage() {
    const [contactIds, setContactIds] = useState('');
    const [subject, setSubject] = useState('');
    const [body, setBody] = useState('');
    const [message, setMessage] = useState('');
    const [pending, setPending] = useState(false);
    const input = () => ({ contactIds: contactIds.split(/[\s,]+/).filter(Boolean), subject: subject.trim(), body: body.trim() });
    const act = async (send: boolean) => {
        setPending(true);
        setMessage('');
        try {
            const result = send ? await contactApi.mailCreate(input()) : await contactApi.mailPreview(input());
            if (!result.ok)
                setMessage(uiText("pages.admin-emails-page.c74b1d7600"));
            else if ('recipients' in result)
                setMessage(uiFormat("pages.admin-emails-page.template.eed70c9f7f", [result.recipients]));
            else
                setMessage(uiFormat("pages.admin-emails-page.template.29dd63a716", [result.id]));
        }
        catch {
            setMessage(uiText("pages.admin-emails-page.37b457e4d4"));
        }
        finally {
            setPending(false);
        }
    };
    return <section aria-labelledby="mail-title"><div className="mb-6 border-b pb-4"><h1 id="mail-title" className="text-[32px] font-extrabold">{uiText("pages.admin-emails-page.dce83b45f3")}</h1></div><div className="grid max-w-2xl gap-4 rounded border bg-white p-6">
    <label>{uiText("pages.admin-emails-page.cafff4d0f9")}<textarea aria-label={uiText("pages.admin-emails-page.6996c849ce")} value={contactIds} onChange={(e) => setContactIds(e.target.value)} className="mt-1 block w-full border p-2"/></label>
    <label>{uiText("pages.admin-emails-page.078b3a1b0a")}<input aria-label={uiText("pages.admin-emails-page.67628b2d19")} value={subject} onChange={(e) => setSubject(e.target.value)} className="mt-1 block w-full border p-2"/></label>
    <label>{uiText("pages.admin-emails-page.c67b871882")}<textarea aria-label={uiText("pages.admin-emails-page.57e7b540ad")} value={body} onChange={(e) => setBody(e.target.value)} rows={10} className="mt-1 block w-full border p-2"/></label>
    {message && <p role="status">{message}</p>}<div className="flex gap-3"><button disabled={pending} onClick={() => void act(false)} className="rounded border px-4 py-2">{uiText("pages.admin-emails-page.2f1c9d7bd8")}</button><button disabled={pending} onClick={() => void act(true)} className="rounded bg-kaist-darkgreen px-4 py-2 text-white">{uiText("pages.admin-emails-page.6979bfc484")}</button></div>
  </div></section>;
}
