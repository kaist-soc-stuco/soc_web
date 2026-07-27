import { useEffect, useState } from 'react';

import { contactApi } from '@/lib/contact-api';

export function ChatPage() {
  const [notice, setNotice] = useState<{ externalUrl: string; notice: string } | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  useEffect(() => { const controller = new AbortController(); contactApi.chatPage(controller.signal).then((page) => { setNotice(page); setStatus('ready'); }).catch(() => { setStatus('error'); }); return () => controller.abort(); }, []);
  return <main className="mx-auto max-w-3xl px-6 py-12"><h1 className="mb-6 text-[32px] font-extrabold tracking-tight text-kaist-black">채팅</h1>{status === 'loading' && <p>채팅 안내를 불러오는 중입니다.</p>}{status === 'error' && <p role="alert">채팅 안내를 불러오지 못했습니다.</p>}{notice && <section className="rounded-[8px] border border-kaist-grey/25 bg-white p-6"><p className="mb-4 text-kaist-black">{notice.notice}</p><a href={notice.externalUrl} target="_blank" rel="noreferrer" className="font-bold text-kaist-darkgreen underline">ChatGPT에서 계속하기</a></section>}</main>;
}
