import { useEffect, useState } from 'react';
import { contactApi } from '@/lib/contact-api';

export function ChatPage() {
  const [page, setPage] = useState<Awaited<ReturnType<typeof contactApi.chatPage>> | null>(null);
  const [body, setBody] = useState('');
  const [reply, setReply] = useState('');
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [pending, setPending] = useState(false);
  useEffect(() => { const controller = new AbortController(); contactApi.chatPage(controller.signal).then((value) => { setPage(value); setStatus('ready'); }).catch(() => setStatus('error')); return () => controller.abort(); }, []);
  const send = async (event: React.FormEvent) => { event.preventDefault(); setPending(true); setReply(''); try { const result = await contactApi.chatMessage({ body }); setReply(result.ok ? result.reply : '채팅 서비스가 구성되지 않았습니다.'); } catch { setReply('채팅 요청을 처리하지 못했습니다.'); } finally { setPending(false); } };
  return <main className="mx-auto max-w-3xl px-6 py-12"><h1 className="mb-6 text-[32px] font-extrabold">채팅</h1>{status === 'loading' && <p>채팅 안내를 불러오는 중입니다.</p>}{status === 'error' && <p role="alert">채팅 안내를 불러오지 못했습니다.</p>}{page && <section className="rounded border bg-white p-6"><p className="mb-4">{page.notice}</p>{page.kind === 'EXTERNAL_LINK_NOTICE' ? <a href={page.externalUrl} target="_blank" rel="noreferrer" className="font-bold underline">ChatGPT에서 계속하기</a> : <form onSubmit={send} className="grid gap-3"><label>메시지<textarea aria-label="메시지" required maxLength={4000} value={body} onChange={(e) => setBody(e.target.value)} rows={6} className="mt-1 block w-full border p-2" /></label><button disabled={pending} className="justify-self-start rounded bg-kaist-darkgreen px-4 py-2 text-white">{pending ? '전송 중...' : '전송'}</button>{reply && <p role="status" className="whitespace-pre-wrap">{reply}</p>}</form>}</section>}</main>;
}
