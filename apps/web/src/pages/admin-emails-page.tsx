import { Eye, Mail, Send } from 'lucide-react';
import { useState } from 'react';
import { uiFormat, uiText } from '@/lib/i18n/surface-catalog';
import { contactApi } from '@/lib/contact-api';

export function AdminEmailsPage() {
  const [contactIds, setContactIds] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);

  const input = () => ({
    contactIds: contactIds.split(/[\s,]+/).filter(Boolean),
    subject: subject.trim(),
    body: body.trim(),
  });

  const act = async (send: boolean) => {
    setPending(true);
    setMessage('');
    try {
      const result = send ? await contactApi.mailCreate(input()) : await contactApi.mailPreview(input());
      if (!result.ok) {
        setMessage(uiText('pages.admin-emails-page.c74b1d7600'));
      } else if ('recipients' in result) {
        setMessage(uiFormat('pages.admin-emails-page.template.eed70c9f7f', [result.recipients]));
      } else {
        setMessage(uiFormat('pages.admin-emails-page.template.29dd63a716', [result.id]));
      }
    } catch {
      setMessage(uiText('pages.admin-emails-page.37b457e4d4'));
    } finally {
      setPending(false);
    }
  };

  return (
    <section aria-labelledby="mail-title">
      <div className="admin-page-heading">
        <div>
          <p className="admin-eyebrow">Operation</p>
          <h1 id="mail-title">{uiText('pages.admin-emails-page.dce83b45f3')}</h1>
          <p>연락망 기반 대상자에게 발송할 메일을 작성하고, 발송 전 수신자 수를 확인합니다.</p>
        </div>
        <div className="admin-heading-stat">
          <Mail className="ml-auto h-8 w-8 text-[#006B4A]" aria-hidden="true" />
          <p>Bulk mail</p>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px] 2xl:grid-cols-[minmax(0,1fr)_420px]">
        <form
          className="admin-panel grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void act(true);
          }}
        >
          <div className="admin-panel-header">
            <div>
              <p className="admin-eyebrow">Compose</p>
              <h2>{uiText('pages.admin-emails-page.dce83b45f3')}</h2>
            </div>
          </div>

          <label>
            {uiText('pages.admin-emails-page.cafff4d0f9')}
            <textarea
              aria-label={uiText('pages.admin-emails-page.6996c849ce')}
              value={contactIds}
              onChange={(event) => setContactIds(event.target.value)}
              placeholder="contact-id-1, contact-id-2"
              rows={4}
            />
          </label>

          <label>
            {uiText('pages.admin-emails-page.078b3a1b0a')}
            <input
              aria-label={uiText('pages.admin-emails-page.67628b2d19')}
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
            />
          </label>

          <label>
            {uiText('pages.admin-emails-page.c67b871882')}
            <textarea
              aria-label={uiText('pages.admin-emails-page.57e7b540ad')}
              value={body}
              onChange={(event) => setBody(event.target.value)}
              rows={12}
            />
          </label>

          {message ? <p role="status">{message}</p> : null}

          <div className="flex flex-wrap justify-end gap-3 border-t border-[#98A0AC]/25 pt-4">
            <button type="button" disabled={pending} onClick={() => void act(false)} className="inline-flex items-center gap-2">
              <Eye className="h-4 w-4" aria-hidden="true" />
              {uiText('pages.admin-emails-page.2f1c9d7bd8')}
            </button>
            <button type="submit" disabled={pending} className="inline-flex items-center gap-2">
              <Send className="h-4 w-4" aria-hidden="true" />
              {uiText('pages.admin-emails-page.6979bfc484')}
            </button>
          </div>
        </form>

        <aside className="admin-panel content-start">
          <div className="admin-panel-header">
            <div>
              <p className="admin-eyebrow">Review</p>
              <h2>발송 점검</h2>
            </div>
          </div>
          <div className="grid gap-3 text-sm font-semibold text-[#39404B]">
            <p className="rounded-[8px] bg-[#F7FCFC] p-3">수신자 ID는 쉼표, 공백, 줄바꿈으로 구분할 수 있습니다.</p>
            <p className="rounded-[8px] bg-[#F7FCFC] p-3">실제 발송 전 미리보기로 대상자 수를 확인하세요.</p>
            <p className="rounded-[8px] bg-[#F7FCFC] p-3">본문은 그대로 전송되므로 링크와 줄바꿈을 확인하세요.</p>
          </div>
        </aside>
      </div>
    </section>
  );
}
