import { uiText } from "@/lib/i18n/surface-catalog";
import { useEffect, useState } from 'react';
import { contactApi } from '@/lib/contact-api';
import { useLocale } from '@/lib/locale-store';
export function ChatPage() {
    const [locale] = useLocale();
    const [page, setPage] = useState<Awaited<ReturnType<typeof contactApi.chatPage>> | null>(null);
    const [body, setBody] = useState('');
    const [reply, setReply] = useState('');
    const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
    const [pending, setPending] = useState(false);
    const copy = locale === 'ko'
        ? { title: uiText("pages.chat-page.7d8c760fb7"), loading: uiText("pages.chat-page.641fb0a4db"), error: uiText("pages.chat-page.603d36a8f8"), disabled: uiText("pages.chat-page.24e1dbbefa"), failed: uiText("pages.chat-page.5c226c7ab2"), internal: uiText("pages.chat-page.b9ac5381a7"), external: uiText("pages.chat-page.951d86049b"), continue: uiText("pages.chat-page.8c5f5d4303"), message: uiText("pages.chat-page.96330a61aa"), sending: uiText("pages.chat-page.d47f335880"), send: uiText("pages.chat-page.4077ceb9da") }
        : { title: 'Chat', loading: 'Loading chat information.', error: 'Could not load chat information.', disabled: 'Chat is not configured.', failed: 'Could not process the chat request.', internal: 'Messages are sent to the configured student council chat service.', external: 'The chat API is not configured, so messages are not sent to this server.', continue: 'Continue in ChatGPT', message: 'Message', sending: 'Sending...', send: 'Send' };
    useEffect(() => { const controller = new AbortController(); contactApi.chatPage(controller.signal).then((value) => { setPage(value); setStatus('ready'); }).catch(() => setStatus('error')); return () => controller.abort(); }, []);
    const send = async (event: React.FormEvent) => { event.preventDefault(); setPending(true); setReply(''); try {
        const result = await contactApi.chatMessage({ body });
        setReply(result.ok ? result.reply : copy.disabled);
    }
    catch {
        setReply(copy.failed);
    }
    finally {
        setPending(false);
    } };
    return <main className="mx-auto max-w-3xl px-6 py-12"><h1 className="mb-6 text-[32px] font-extrabold">{copy.title}</h1>{status === 'loading' && <p>{copy.loading}</p>}{status === 'error' && <p role="alert">{copy.error}</p>}{page && <section className="rounded border bg-white p-6"><p className="mb-4">{page.kind === 'INTERNAL_CHAT' ? copy.internal : copy.external}</p>{page.kind === 'EXTERNAL_LINK_NOTICE' ? <a href={page.externalUrl} target="_blank" rel="noreferrer" className="font-bold underline">{copy.continue}</a> : <form onSubmit={send} className="grid gap-3"><label>{copy.message}<textarea aria-label={copy.message} required maxLength={4000} value={body} onChange={(e) => setBody(e.target.value)} rows={6} className="mt-1 block w-full border p-2"/></label><button disabled={pending} className="justify-self-start rounded bg-kaist-darkgreen px-4 py-2 text-white">{pending ? copy.sending : copy.send}</button>{reply && <p role="status" className="whitespace-pre-wrap">{reply}</p>}</form>}</section>}</main>;
}
