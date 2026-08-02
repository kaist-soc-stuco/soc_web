import { uiText, uiFormat } from '@/lib/i18n/surface-catalog';
import { useEffect, useState } from 'react';
import type { ContactDto, CreateContactRequest } from '@soc/contracts';
import { ContactApiError, contactApi } from '@/lib/contact-api';
const fields = [
    ['name', uiText("pages.admin-contacts-page.9aa18e5071")], ['role', uiText("pages.admin-contacts-page.351fa08e43")], ['email', uiText("pages.admin-contacts-page.3c37764a2b")], ['phone', uiText("pages.admin-contacts-page.9a1c3aaaca")], ['affiliation', uiText("pages.admin-contacts-page.24a8d34991")], ['note', uiText("pages.admin-contacts-page.75cffa413d")], ['kaistUid', 'KAIST UID'], ['year', uiText("pages.admin-contacts-page.74cdc7b526")],
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
    const [nextCursor, setNextCursor] = useState<string | null>(null);
    const [pendingDelete, setPendingDelete] = useState<ContactDto | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const load = (mode = projection, cursor?: string) => {
        setStatus('loading');
        setMessage('');
        contactApi.list(mode, undefined, cursor).then((page) => {
            setContacts((current) => cursor ? [...current, ...page.items] : page.items);
            setNextCursor(page.nextCursor);
            setStatus('ready');
        }).catch((error: unknown) => { setStatus('error'); setMessage(error instanceof ContactApiError && error.status === 403 ? uiText("pages.admin-contacts-page.01dec59969") : uiText("pages.admin-contacts-page.383ea5fbd1")); });
    };
    useEffect(() => { load(projection); }, [projection]);
    const update = (field: Field, value: string) => setForm((current) => ({ ...current, [field]: value }));
    const submit = async (event: React.FormEvent) => {
        event.preventDefault();
        setMessage('');
        if (submitting)
            return;
        if (!form.name.trim()) {
            setMessage(uiText("pages.admin-contacts-page.d788cd6be3"));
            return;
        }
        setSubmitting(true);
        try {
            if (editing)
                await contactApi.patch(editing, requestForm(form));
            else
                await contactApi.create(requestForm(form));
            setForm(emptyForm());
            setEditing(null);
            load();
        }
        catch (error) {
            setMessage(error instanceof ContactApiError && error.status === 422 ? uiText("pages.admin-contacts-page.9cd0db9df1") : uiText("pages.admin-contacts-page.11f3567052"));
        }
        finally {
            setSubmitting(false);
        }
    };
    const remove = async () => {
        if (!pendingDelete || submitting)
            return;
        setSubmitting(true);
        try {
            await contactApi.remove(pendingDelete.id, { reasonCode: 'ADMIN_REQUEST' });
            setContacts((current) => current.filter((contact) => contact.id !== pendingDelete.id));
            setPendingDelete(null);
        }
        catch {
            setMessage(uiText("pages.admin-contacts-page.b8f488c804"));
        }
        finally {
            setSubmitting(false);
        }
    };
    return <section>
    <div className="mb-6 border-b border-kaist-grey/25 pb-4"><h1 className="text-[32px] font-extrabold tracking-tight text-kaist-black">{uiText("pages.admin-contacts-page.3ccbaaa53c")}</h1></div>
    <div className="mb-5 flex flex-wrap items-center gap-4 border-b border-kaist-grey/20 pb-5">
      <label className="flex items-center gap-3"><span className="text-base font-extrabold text-kaist-black">{uiText("pages.admin-contacts-page.a61d568e9d")}</span><select aria-label={uiText("pages.admin-contacts-page.fcd8972fd6")} value={projection} onChange={(event) => setProjection(event.target.value as 'MASKED' | 'FULL')} className="rounded-[5px] border border-kaist-grey/25 bg-white px-3 py-1.5 text-sm font-semibold text-kaist-black"><option value="MASKED">{uiText("pages.admin-contacts-page.cfa8704a04")}</option><option value="FULL">{uiText("pages.admin-contacts-page.fa57c146e0")}</option></select></label>
    </div>
    <form onSubmit={submit} className="mb-6 grid gap-3 rounded-[8px] border border-kaist-grey/25 bg-white p-4 md:grid-cols-2">
      {fields.map(([key, label]) => <label key={key} className="text-sm font-bold text-kaist-black">{label}<input aria-label={label} value={form[key]} onChange={(event) => update(key, event.target.value)} className="mt-1 block w-full border-b border-kaist-grey/25 px-1 py-2 font-normal"/></label>)}
      <div className="flex items-end gap-2"><button type="submit" disabled={submitting} className="rounded-[5px] bg-kaist-darkgreen px-5 py-2 text-xs font-extrabold text-white disabled:opacity-50">{submitting ? uiText("pages.admin-contacts-page.5d68706086") : editing ? uiText("pages.admin-contacts-page.21db63003b") : uiText("pages.admin-contacts-page.dd20a05416")}</button>{editing && <button type="button" onClick={() => { setEditing(null); setForm(emptyForm()); }} disabled={submitting} className="rounded-[5px] border border-kaist-grey/25 px-5 py-2 text-xs font-extrabold">{uiText("pages.admin-contacts-page.19b2d19bc1")}</button>}</div>
    </form>
    {message && <p role="alert" className="mb-4 text-sm font-semibold text-red-700">{message}</p>}
    <div className="overflow-x-auto"><div className="grid min-w-[1120px] grid-cols-[1fr_1fr_1.2fr_1.5fr_1.5fr_1.5fr_0.8fr] items-center border-b-2 border-kaist-darkgreen-main py-3 text-sm font-extrabold tracking-tight text-kaist-darkgreen"><div>{uiText("pages.admin-contacts-page.9aa18e5071")}</div><div>{uiText("pages.admin-contacts-page.351fa08e43")}</div><div>{uiText("pages.admin-contacts-page.3c37764a2b")}</div><div>{uiText("pages.admin-contacts-page.9a1c3aaaca")}</div><div>{uiText("pages.admin-contacts-page.24a8d34991")}</div><div>{uiText("pages.admin-contacts-page.75cffa413d")}</div><div>{uiText("pages.admin-contacts-page.c29fba5a7c")}</div></div><div className="min-w-[1120px] divide-y divide-kaist-grey/20 border-b border-kaist-grey/20">
      {status === 'loading' && <div className="py-8 text-center text-sm font-semibold text-[#39404B]">{uiText("pages.admin-contacts-page.ea054df653")}</div>}
      {status === 'ready' && contacts.length === 0 && <div className="py-8 text-center text-sm font-semibold text-[#39404B]">{uiText("pages.admin-contacts-page.04aa59647e")}</div>}
      {status === 'ready' && contacts.map((contact) => <div key={contact.id} className="grid grid-cols-[1fr_1fr_1.2fr_1.5fr_1.5fr_1.5fr_0.8fr] items-center gap-2 py-3 text-sm"><div>{contact.name}</div><div>{contact.role ?? '-'}</div><div>{contact.email ?? '-'}</div><div>{contact.phone ?? '-'}</div><div>{contact.affiliation ?? '-'}</div><div>{contact.note ?? '-'}</div><div className="flex gap-2"><button type="button" aria-label={uiFormat("pages.admin-contacts-page.template.47a3173507", [contact.name])} onClick={() => { setEditing(contact.id); setForm(contactForm(contact)); }} className="text-kaist-darkgreen">{uiText("pages.admin-contacts-page.e1407b5115")}</button><button type="button" aria-label={uiFormat("pages.admin-contacts-page.template.48c1c4355f", [contact.name])} onClick={() => setPendingDelete(contact)} disabled={submitting} className="text-red-700">{uiText("pages.admin-contacts-page.fc81e222b9")}</button></div></div>)}
    </div></div>
    {nextCursor && status === 'ready' && <button type="button" onClick={() => load(projection, nextCursor)} className="mt-4 rounded border px-4 py-2 font-bold">{uiText("pages.admin-contacts-page.dcd42d6cce")}</button>}
    {pendingDelete && <div role="dialog" aria-modal="true" aria-labelledby="contact-delete-title" className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"><div className="rounded bg-white p-6"><h2 id="contact-delete-title" className="text-lg font-extrabold">{pendingDelete.name} {uiText("pages.admin-contacts-page.828c27233f")}</h2><p className="mt-2">{uiText("pages.admin-contacts-page.cdfb991d17")}</p><div className="mt-5 flex justify-end gap-3"><button type="button" disabled={submitting} onClick={() => setPendingDelete(null)}>{uiText("pages.admin-contacts-page.19b2d19bc1")}</button><button type="button" disabled={submitting} onClick={() => void remove()} className="rounded bg-red-700 px-4 py-2 font-bold text-white">{submitting ? uiText("pages.admin-contacts-page.d2884b2998") : uiFormat("pages.admin-contacts-page.template.1a35ff3415", [pendingDelete.name])}</button></div></div></div>}
  </section>;
}
