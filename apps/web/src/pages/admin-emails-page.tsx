import { useState } from 'react';

import { ContactApiError, contactApi } from '@/lib/contact-api';

export function AdminEmailsPage() {
  const [contactIds, setContactIds] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [status, setStatus] = useState('');
  const input = () => ({ contactIds: contactIds.split(',').map((id) => id.trim()).filter(Boolean), subject, body });
  const send = async () => { setStatus(''); try { await contactApi.mailCreate(input()); setStatus('이메일 발송 기능은 현재 사용할 수 없습니다.'); } catch (error) { setStatus(error instanceof ContactApiError && error.status === 503 && error.code === 'feature_disabled' ? '이메일 발송 기능은 현재 사용할 수 없습니다.' : '이메일 요청을 처리하지 못했습니다.'); } };
  const preview = async () => { setStatus(''); try { await contactApi.mailPreview(input()); setStatus('이메일 미리보기 기능은 현재 사용할 수 없습니다.'); } catch (error) { setStatus(error instanceof ContactApiError && error.status === 503 && error.code === 'feature_disabled' ? '이메일 미리보기 기능은 현재 사용할 수 없습니다.' : '이메일 요청을 처리하지 못했습니다.'); } };
  return <section>
    <div className="mb-6 border-b border-kaist-grey/25 pb-4"><h1 className="text-[32px] font-extrabold tracking-tight text-kaist-black">이메일 일괄발송</h1></div>
    <div className="overflow-hidden rounded-[8px] border border-kaist-grey/25 bg-white"><div className="border-b-2 border-kaist-darkgreen-main px-5 py-3 text-base font-extrabold tracking-tight text-kaist-darkgreen">보내기</div>
      <div className="grid gap-0 border-b border-kaist-grey/20">
        <label className="grid gap-4 border-b border-kaist-grey/20 px-5 py-4 md:grid-cols-[120px_1fr_120px] md:items-center"><span className="text-sm font-extrabold text-kaist-black">받는 사람</span><input aria-label="받는 사람" value={contactIds} onChange={(event) => setContactIds(event.target.value)} placeholder="연락처 ID를 쉼표로 구분해 입력해 주세요." className="border-b border-kaist-grey/25 pb-1 text-sm font-semibold" /><span className="text-left text-xs font-bold text-kaist-grey md:text-right">개별</span></label>
        <label className="grid gap-4 px-5 py-4 md:grid-cols-[120px_1fr_120px] md:items-center"><span className="text-sm font-extrabold text-kaist-black">제목</span><input aria-label="제목" value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="제목을 입력해 주세요." className="border-b border-kaist-grey/25 pb-1 text-sm font-semibold" /><span className="text-left text-xs font-bold text-kaist-grey md:text-right">중요</span></label>
      </div>
      <label className="block border-b border-kaist-grey/20 px-5 py-4"><span className="mb-3 block text-sm font-extrabold text-kaist-black">내용</span><textarea aria-label="내용" value={body} onChange={(event) => setBody(event.target.value)} className="min-h-[260px] w-full bg-white text-sm text-kaist-black" /></label>
      {status && <p role="status" className="px-5 py-3 text-sm font-semibold text-kaist-grey">{status}</p>}
      <div className="flex items-center justify-between bg-[#F7FCFC] px-5 py-4"><div className="flex gap-2"><button type="button" onClick={() => void send()} className="rounded-[5px] bg-kaist-darkgreen px-5 py-2 text-xs font-extrabold text-white transition hover:bg-kaist-darkgreen-main">보내기</button><button type="button" onClick={() => void preview()} className="rounded-[5px] border border-kaist-grey/25 px-5 py-2 text-xs font-extrabold">미리보기</button></div><div className="flex items-center gap-2 text-[11px] font-bold text-kaist-grey"><span className="rounded-[5px] border border-kaist-grey/20 bg-white px-2 py-1">HTML</span><span className="rounded-[5px] border border-kaist-grey/20 bg-white px-2 py-1">텍스트</span></div></div>
    </div>
  </section>;
}
