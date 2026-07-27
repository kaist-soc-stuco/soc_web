import { useEffect, useState } from 'react';
import type { ContactDto, CreateContactRequest } from '@soc/contracts';

import { ContactApiError, contactApi } from '@/lib/contact-api';

const fields = [
  ['name', '이름'], ['role', '직책'], ['email', '이메일'], ['phone', '전화번호'], ['affiliation', '직장'], ['note', '비고'], ['kaistUid', 'KAIST UID'], ['year', '학년도'],
] as const;
type Field = (typeof fields)[number][0];
type Form = Record<Field, string>;
const emptyForm = (): Form => ({ name: '', role: '', email: '', phone: '', affiliation: '', note: '', kaistUid: '', year: '' });
const contactForm = (contact: ContactDto): Form => Object.fromEntries(fields.map(([key]) => [key, contact[key] ?? ''])) as Form;
const requestForm = (form: Form): CreateContactRequest => ({ name: form.name.trim(), role: form.role.trim() || null, email: form.email.trim() || null, phone: form.phone.trim() || null, affiliation: form.affiliation.trim() || null, note: form.note.trim() || null, kaistUid: form.kaistUid.trim() || null, year: form.year.trim() || null });

export function AdminContactsPage() {
  const [contacts, setContacts] = useState<ContactDto[]>([]);
  const [projection, setProjection] = useState<'MASKED' | 'FULL'>('MASKED');
  const [form, setForm] = useState<Form>(emptyForm);
  const [editing, setEditing] = useState<string | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const load = (mode = projection) => {
    setStatus('loading'); setMessage('');
    contactApi.list(mode).then((page) => { setContacts(page.items); setStatus('ready'); }).catch((error: unknown) => { setStatus('error'); setMessage(error instanceof ContactApiError && error.status === 403 ? '연락처 관리 권한이 없습니다.' : '연락처 정보를 불러오지 못했습니다.'); });
  };
  useEffect(() => { load(projection); }, [projection]);
  const update = (field: Field, value: string) => setForm((current) => ({ ...current, [field]: value }));
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setMessage('');
    if (!form.name.trim()) { setMessage('이름을 입력해 주세요.'); return; }
    try { if (editing) await contactApi.patch(editing, requestForm(form)); else await contactApi.create(requestForm(form)); setForm(emptyForm()); setEditing(null); load(); }
    catch (error) { setMessage(error instanceof ContactApiError && error.status === 422 ? '입력 내용을 확인해 주세요.' : '연락처를 저장하지 못했습니다.'); }
  };
  const remove = async (id: string) => { try { await contactApi.remove(id, { reasonCode: 'ADMIN_REQUEST' }); setContacts((current) => current.filter((contact) => contact.id !== id)); } catch { setMessage('연락처를 삭제하지 못했습니다.'); } };
  return <section>
    <div className="mb-6 border-b border-kaist-grey/25 pb-4"><h1 className="text-[32px] font-extrabold tracking-tight text-kaist-black">집행위 연락망</h1></div>
    <div className="mb-5 flex flex-wrap items-center gap-4 border-b border-kaist-grey/20 pb-5">
      <label className="flex items-center gap-3"><span className="text-base font-extrabold text-kaist-black">표시</span><select aria-label="연락처 표시 방식" value={projection} onChange={(event) => setProjection(event.target.value as 'MASKED' | 'FULL')} className="rounded-[5px] border border-kaist-grey/25 bg-white px-3 py-1.5 text-sm font-semibold text-kaist-black"><option value="MASKED">마스킹</option><option value="FULL">전체 정보</option></select></label>
    </div>
    <form onSubmit={submit} className="mb-6 grid gap-3 rounded-[8px] border border-kaist-grey/25 bg-white p-4 md:grid-cols-2">
      {fields.map(([key, label]) => <label key={key} className="text-sm font-bold text-kaist-black">{label}<input aria-label={label} value={form[key]} onChange={(event) => update(key, event.target.value)} className="mt-1 block w-full border-b border-kaist-grey/25 px-1 py-2 font-normal" /></label>)}
      <div className="flex items-end gap-2"><button type="submit" className="rounded-[5px] bg-kaist-darkgreen px-5 py-2 text-xs font-extrabold text-white">{editing ? '수정 저장' : '연락처 추가'}</button>{editing && <button type="button" onClick={() => { setEditing(null); setForm(emptyForm()); }} className="rounded-[5px] border border-kaist-grey/25 px-5 py-2 text-xs font-extrabold">취소</button>}</div>
    </form>
    {message && <p role="alert" className="mb-4 text-sm font-semibold text-red-700">{message}</p>}
    <div className="overflow-x-auto"><div className="grid min-w-[1120px] grid-cols-[1fr_1fr_1.2fr_1.5fr_1.5fr_1.5fr_0.8fr] items-center border-b-2 border-kaist-darkgreen-main py-3 text-sm font-extrabold tracking-tight text-kaist-darkgreen"><div>이름</div><div>직책</div><div>이메일</div><div>전화번호</div><div>직장</div><div>비고</div><div>관리</div></div><div className="min-w-[1120px] divide-y divide-kaist-grey/20 border-b border-kaist-grey/20">
      {status === 'loading' && <div className="py-8 text-center text-sm font-semibold text-[#39404B]">연락처 정보를 불러오는 중입니다.</div>}
      {status === 'ready' && contacts.length === 0 && <div className="py-8 text-center text-sm font-semibold text-[#39404B]">연락처 정보가 없습니다.</div>}
      {status === 'ready' && contacts.map((contact) => <div key={contact.id} className="grid grid-cols-[1fr_1fr_1.2fr_1.5fr_1.5fr_1.5fr_0.8fr] items-center gap-2 py-3 text-sm"><div>{contact.name}</div><div>{contact.role ?? '-'}</div><div>{contact.email ?? '-'}</div><div>{contact.phone ?? '-'}</div><div>{contact.affiliation ?? '-'}</div><div>{contact.note ?? '-'}</div><div className="flex gap-2"><button type="button" aria-label={`${contact.name} 수정`} onClick={() => { setEditing(contact.id); setForm(contactForm(contact)); }} className="text-kaist-darkgreen">수정</button><button type="button" aria-label={`${contact.name} 삭제`} onClick={() => void remove(contact.id)} className="text-red-700">삭제</button></div></div>)}
    </div></div>
  </section>;
}
