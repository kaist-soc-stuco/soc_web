import { Eye, EyeOff, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ContactDto, CreateContactRequest } from '@soc/contracts';
import { uiFormat, uiText } from '@/lib/i18n/surface-catalog';
import { ContactApiError, contactApi } from '@/lib/contact-api';

const fields = [
  ['name', uiText('pages.admin-contacts-page.9aa18e5071')],
  ['role', uiText('pages.admin-contacts-page.351fa08e43')],
  ['email', uiText('pages.admin-contacts-page.3c37764a2b')],
  ['phone', uiText('pages.admin-contacts-page.9a1c3aaaca')],
  ['affiliation', uiText('pages.admin-contacts-page.24a8d34991')],
  ['note', uiText('pages.admin-contacts-page.75cffa413d')],
  ['kaistUid', 'KAIST UID'],
  ['year', uiText('pages.admin-contacts-page.74cdc7b526')],
] as const;

type Field = (typeof fields)[number][0];
type Form = Record<Field, string>;

const emptyForm = (): Form => ({ name: '', role: '', email: '', phone: '', affiliation: '', note: '', kaistUid: '', year: '' });
const contactForm = (contact: ContactDto): Form => Object.fromEntries(fields.map(([key]) => [key, contact[key] ?? ''])) as Form;
const requestForm = (form: Form): CreateContactRequest => ({
  name: form.name.trim(),
  role: form.role.trim() || null,
  email: form.email.trim() || null,
  phone: form.phone.trim() || null,
  affiliation: form.affiliation.trim() || null,
  note: form.note.trim() || null,
  kaistUid: form.kaistUid.trim() || null,
  year: form.year.trim() || null,
});

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
    contactApi
      .list(mode, undefined, cursor)
      .then((page) => {
        setContacts((current) => cursor ? [...current, ...page.items] : page.items);
        setNextCursor(page.nextCursor);
        setStatus('ready');
      })
      .catch((error: unknown) => {
        setStatus('error');
        setMessage(error instanceof ContactApiError && error.status === 403 ? uiText('pages.admin-contacts-page.01dec59969') : uiText('pages.admin-contacts-page.383ea5fbd1'));
      });
  };

  useEffect(() => {
    load(projection);
  }, [projection]);

  const update = (field: Field, value: string) => setForm((current) => ({ ...current, [field]: value }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage('');
    if (submitting) return;
    if (!form.name.trim()) {
      setMessage(uiText('pages.admin-contacts-page.d788cd6be3'));
      return;
    }
    setSubmitting(true);
    try {
      if (editing) await contactApi.patch(editing, requestForm(form));
      else await contactApi.create(requestForm(form));
      setForm(emptyForm());
      setEditing(null);
      load();
    } catch (error) {
      setMessage(error instanceof ContactApiError && error.status === 422 ? uiText('pages.admin-contacts-page.9cd0db9df1') : uiText('pages.admin-contacts-page.11f3567052'));
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async () => {
    if (!pendingDelete || submitting) return;
    setSubmitting(true);
    try {
      await contactApi.remove(pendingDelete.id, { reasonCode: 'ADMIN_REQUEST' });
      setContacts((current) => current.filter((contact) => contact.id !== pendingDelete.id));
      setPendingDelete(null);
    } catch {
      setMessage(uiText('pages.admin-contacts-page.b8f488c804'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section>
      <div className="admin-page-heading">
        <div>
          <p className="admin-eyebrow">People</p>
          <h1>{uiText('pages.admin-contacts-page.3ccbaaa53c')}</h1>
          <p>집행위 구성원의 연락처, 역할, 소속 정보를 한 곳에서 관리합니다.</p>
        </div>
        <div className="admin-heading-stat">
          <span>{contacts.length}</span>
          <p>loaded contacts</p>
        </div>
      </div>

      {message ? <p role="alert">{message}</p> : null}

      <div className="grid gap-5 xl:grid-cols-[420px_minmax(0,1fr)] 2xl:grid-cols-[480px_minmax(0,1fr)]">
        <form onSubmit={submit} className="admin-panel grid content-start gap-3">
          <div className="admin-panel-header">
            <div>
              <p className="admin-eyebrow">{editing ? 'Edit' : 'Create'}</p>
              <h2>{editing ? uiText('pages.admin-contacts-page.21db63003b') : uiText('pages.admin-contacts-page.dd20a05416')}</h2>
            </div>
          </div>

          {fields.map(([key, label]) => (
            <label key={key}>
              {label}
              <input aria-label={label} value={form[key]} onChange={(event) => update(key, event.target.value)} />
            </label>
          ))}

          <div className="flex flex-wrap gap-2 border-t border-[#98A0AC]/25 pt-4">
            <button type="submit" disabled={submitting}>{submitting ? uiText('pages.admin-contacts-page.5d68706086') : editing ? uiText('pages.admin-contacts-page.21db63003b') : uiText('pages.admin-contacts-page.dd20a05416')}</button>
            {editing ? (
              <button type="button" onClick={() => { setEditing(null); setForm(emptyForm()); }} disabled={submitting}>
                {uiText('pages.admin-contacts-page.19b2d19bc1')}
              </button>
            ) : null}
          </div>
        </form>

        <div className="admin-panel">
          <div className="admin-panel-header">
            <div>
              <p className="admin-eyebrow">Directory</p>
              <h2>{uiText('pages.admin-contacts-page.3ccbaaa53c')}</h2>
            </div>
            <label className="inline-flex items-center gap-2">
              {projection === 'FULL' ? <Eye className="h-4 w-4" aria-hidden="true" /> : <EyeOff className="h-4 w-4" aria-hidden="true" />}
              <select aria-label={uiText('pages.admin-contacts-page.fcd8972fd6')} value={projection} onChange={(event) => setProjection(event.target.value as 'MASKED' | 'FULL')}>
                <option value="MASKED">{uiText('pages.admin-contacts-page.cfa8704a04')}</option>
                <option value="FULL">{uiText('pages.admin-contacts-page.fa57c146e0')}</option>
              </select>
            </label>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-[980px] text-left">
              <thead>
                <tr>
                  <th className="p-3">{uiText('pages.admin-contacts-page.9aa18e5071')}</th>
                  <th className="p-3">{uiText('pages.admin-contacts-page.351fa08e43')}</th>
                  <th className="p-3">{uiText('pages.admin-contacts-page.3c37764a2b')}</th>
                  <th className="p-3">{uiText('pages.admin-contacts-page.9a1c3aaaca')}</th>
                  <th className="p-3">{uiText('pages.admin-contacts-page.24a8d34991')}</th>
                  <th className="p-3">{uiText('pages.admin-contacts-page.c29fba5a7c')}</th>
                </tr>
              </thead>
              <tbody>
                {status === 'loading' ? (
                  <tr><td colSpan={6} className="p-8 text-center">{uiText('pages.admin-contacts-page.ea054df653')}</td></tr>
                ) : null}
                {status === 'ready' && contacts.length === 0 ? (
                  <tr><td colSpan={6} className="p-8 text-center">{uiText('pages.admin-contacts-page.04aa59647e')}</td></tr>
                ) : null}
                {status === 'ready' ? contacts.map((contact) => (
                  <tr key={contact.id}>
                    <td className="p-3 font-extrabold">{contact.name}</td>
                    <td className="p-3">{contact.role ?? '-'}</td>
                    <td className="p-3">{contact.email ?? '-'}</td>
                    <td className="p-3">{contact.phone ?? '-'}</td>
                    <td className="p-3">{contact.affiliation ?? '-'}</td>
                    <td className="p-3">
                      <div className="flex gap-2">
                        <button type="button" aria-label={uiFormat('pages.admin-contacts-page.template.47a3173507', [contact.name])} onClick={() => { setEditing(contact.id); setForm(contactForm(contact)); }}>
                          {uiText('pages.admin-contacts-page.e1407b5115')}
                        </button>
                        <button type="button" aria-label={uiFormat('pages.admin-contacts-page.template.48c1c4355f', [contact.name])} onClick={() => setPendingDelete(contact)} disabled={submitting} className="text-red-700">
                          {uiText('pages.admin-contacts-page.fc81e222b9')}
                        </button>
                      </div>
                    </td>
                  </tr>
                )) : null}
              </tbody>
            </table>
          </div>

          {nextCursor && status === 'ready' ? (
            <button type="button" onClick={() => load(projection, nextCursor)} className="mt-4">
              {uiText('pages.admin-contacts-page.dcd42d6cce')}
            </button>
          ) : null}
        </div>
      </div>

      {pendingDelete ? (
        <div role="dialog" aria-modal="true" aria-labelledby="contact-delete-title" className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <div className="w-full max-w-md">
            <Users className="mb-3 h-7 w-7 text-[#006B4A]" aria-hidden="true" />
            <h2 id="contact-delete-title" className="text-lg font-extrabold">
              {pendingDelete.name} {uiText('pages.admin-contacts-page.828c27233f')}
            </h2>
            <p className="mt-2">{uiText('pages.admin-contacts-page.cdfb991d17')}</p>
            <div className="mt-5 flex justify-end gap-3">
              <button type="button" disabled={submitting} onClick={() => setPendingDelete(null)}>{uiText('pages.admin-contacts-page.19b2d19bc1')}</button>
              <button type="button" disabled={submitting} onClick={() => void remove()} className="bg-red-700 text-white">
                {submitting ? uiText('pages.admin-contacts-page.d2884b2998') : uiFormat('pages.admin-contacts-page.template.1a35ff3415', [pendingDelete.name])}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
