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
    setPending(true); setMessage('');
    try {
      const result = send ? await contactApi.mailCreate(input()) : await contactApi.mailPreview(input());
      if (!result.ok) setMessage('메일 서비스가 구성되지 않았습니다.');
      else if ('recipients' in result) setMessage(`${result.recipients}명에게 발송할 메일을 확인했습니다.`);
      else setMessage(`메일을 발송했습니다. (${result.id})`);
    } catch { setMessage('메일 요청을 처리하지 못했습니다.'); }
    finally { setPending(false); }
  };
  return <section aria-labelledby="mail-title"><div className="mb-6 border-b pb-4"><h1 id="mail-title" className="text-[32px] font-extrabold">이메일 일괄발송</h1></div><div className="grid max-w-2xl gap-4 rounded border bg-white p-6">
    <label>연락처 ID (쉼표 또는 줄바꿈)<textarea aria-label="연락처 ID" value={contactIds} onChange={(e) => setContactIds(e.target.value)} className="mt-1 block w-full border p-2" /></label>
    <label>제목<input aria-label="메일 제목" value={subject} onChange={(e) => setSubject(e.target.value)} className="mt-1 block w-full border p-2" /></label>
    <label>본문<textarea aria-label="메일 본문" value={body} onChange={(e) => setBody(e.target.value)} rows={10} className="mt-1 block w-full border p-2" /></label>
    {message && <p role="status">{message}</p>}<div className="flex gap-3"><button disabled={pending} onClick={() => void act(false)} className="rounded border px-4 py-2">미리보기</button><button disabled={pending} onClick={() => void act(true)} className="rounded bg-kaist-darkgreen px-4 py-2 text-white">발송</button></div>
  </div></section>;
}
