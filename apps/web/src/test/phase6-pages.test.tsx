import '@testing-library/jest-dom/vitest';

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => {
  class ContactApiError extends Error {
    constructor(public readonly status: number, public readonly code?: string) { super(`HTTP ${status}`); }
  }
  return {
    ContactApiError,
    contactApi: { list: vi.fn(), create: vi.fn(), patch: vi.fn(), remove: vi.fn(), mailPreview: vi.fn(), mailCreate: vi.fn(), chatPage: vi.fn(), chatMessage: vi.fn() },
  };
});
vi.mock('@/lib/contact-api', () => api);

import { AdminContactsPage } from '@/pages/admin-contacts-page';
import { AdminEmailsPage } from '@/pages/admin-emails-page';
import { ChatPage } from '@/pages/chat-page';

const fullContact = {
  id: 'contact-1', projection: 'FULL' as const, name: '홍길동', role: '위원', email: 'hong@example.test', phone: '010-1234-5678', affiliation: 'KAIST', note: '비고', kaistUid: 'hong', year: '2026',
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', deletedAt: null, retentionDeadlineAt: '2027-01-01T00:00:00.000Z', holdUntil: null,
};
const maskedContact = { ...fullContact, projection: 'MASKED' as const, note: null };

const setField = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe('Phase 6 contact, mail, and chat pages', () => {
  it('loads masked contacts by default without rendering ciphertext, supports full projection and all eight-field create/edit/delete requests', async () => {
    api.contactApi.list.mockImplementation((projection: 'MASKED' | 'FULL') => Promise.resolve({ items: projection === 'MASKED' ? [maskedContact] : [fullContact], nextCursor: null }));
    api.contactApi.create.mockResolvedValue(fullContact);
    api.contactApi.patch.mockResolvedValue(fullContact);
    api.contactApi.remove.mockResolvedValue(undefined);

    render(<AdminContactsPage />);

    expect(await screen.findByText('홍길동')).toBeVisible();
    expect(api.contactApi.list).toHaveBeenCalledWith('MASKED', undefined, undefined);
    expect(screen.getByText('-')).toBeVisible();
    expect(screen.queryByText('ciphertext')).not.toBeInTheDocument();
    expect(screen.getByLabelText('이름')).toBeVisible();
    expect(screen.getByLabelText('직책')).toBeVisible();
    expect(screen.getByLabelText('이메일')).toBeVisible();
    expect(screen.getByLabelText('전화번호')).toBeVisible();
    expect(screen.getByLabelText('직장')).toBeVisible();
    expect(screen.getByLabelText('비고')).toBeVisible();
    expect(screen.getByLabelText('KAIST UID')).toBeVisible();
    expect(screen.getByLabelText('학년도')).toBeVisible();

    fireEvent.change(screen.getByLabelText('연락처 표시 방식'), { target: { value: 'FULL' } });
    await waitFor(() => expect(api.contactApi.list).toHaveBeenLastCalledWith('FULL', undefined, undefined));
    expect(screen.getAllByText('비고').length).toBeGreaterThan(1);

    setField('이름', ' 새 이름 '); setField('직책', ' 역할 '); setField('이메일', ' email@example.test '); setField('전화번호', ' 010 ');
    setField('직장', ' 소속 '); setField('비고', ' 메모 '); setField('KAIST UID', ' uid '); setField('학년도', ' 2027 ');
    fireEvent.click(screen.getByRole('button', { name: '연락처 추가' }));
    await waitFor(() => expect(api.contactApi.create).toHaveBeenCalledWith({ name: '새 이름', role: '역할', email: 'email@example.test', phone: '010', affiliation: '소속', note: '메모', kaistUid: 'uid', year: '2027' }));

    fireEvent.click(screen.getByRole('button', { name: '홍길동 수정' }));
    expect((screen.getByLabelText('KAIST UID') as HTMLInputElement).value).toBe('hong');
    fireEvent.click(screen.getByRole('button', { name: '수정 저장' }));
    await waitFor(() => expect(api.contactApi.patch).toHaveBeenCalledWith('contact-1', { name: '홍길동', role: '위원', email: 'hong@example.test', phone: '010-1234-5678', affiliation: 'KAIST', note: '비고', kaistUid: 'hong', year: '2026' }));

    fireEvent.click(screen.getByRole('button', { name: '홍길동 삭제' }));
    expect(screen.getByRole('dialog', { name: '홍길동 연락처 삭제' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: '홍길동 삭제 확인' }));
    await waitFor(() => expect(api.contactApi.remove).toHaveBeenCalledWith('contact-1', { reasonCode: 'ADMIN_REQUEST' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: '홍길동 삭제' })).not.toBeInTheDocument());
  });

  it('shows live loading, error, and empty contact states without mock fallback data', async () => {
    let resolve!: (value: { items: never[]; nextCursor: null }) => void;
    api.contactApi.list.mockReturnValueOnce(new Promise((done) => { resolve = done; }));
    render(<AdminContactsPage />);
    expect(screen.getByText('연락처 정보를 불러오는 중입니다.')).toBeVisible();
    resolve({ items: [], nextCursor: null });
    expect(await screen.findByText('연락처 정보가 없습니다.')).toBeVisible();
    expect(screen.queryByText('홍길동')).not.toBeInTheDocument();

    cleanup();
    api.contactApi.list.mockRejectedValueOnce(new api.ContactApiError(403, 'forbidden'));
    render(<AdminContactsPage />);
    expect(await screen.findByText('연락처 관리 권한이 없습니다.')).toBeVisible();
    expect(screen.queryByText('홍길동')).not.toBeInTheDocument();
  });

  it('previews and sends configured mail composition', async () => {
    api.contactApi.mailPreview.mockResolvedValue({ ok: true, recipients: 1, subject: '제목', body: '본문' });
    api.contactApi.mailCreate.mockResolvedValue({ ok: true, id: 'mail-1', status: 'SENT' });
    render(<AdminEmailsPage />);
    fireEvent.change(screen.getByLabelText('연락처 ID'), { target: { value: '10000000-0000-4000-8000-000000000001' } });
    fireEvent.change(screen.getByLabelText('메일 제목'), { target: { value: ' 제목 ' } });
    fireEvent.change(screen.getByLabelText('메일 본문'), { target: { value: ' 본문 ' } });
    fireEvent.click(screen.getByRole('button', { name: '미리보기' }));
    expect(await screen.findByText('1명에게 발송할 메일을 확인했습니다.')).toBeVisible();
    expect(api.contactApi.mailPreview).toHaveBeenCalledWith({ contactIds: ['10000000-0000-4000-8000-000000000001'], subject: '제목', body: '본문' });
    fireEvent.click(screen.getByRole('button', { name: '발송' }));
    expect(await screen.findByText('메일을 발송했습니다. (mail-1)')).toBeVisible();
  });

  it('loads the static external chat link without browser storage or a message submission surface', async () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem');
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    api.contactApi.chatPage.mockResolvedValue({ kind: 'EXTERNAL_LINK_NOTICE', externalUrl: 'https://chat.example.test/continue' });
    render(<ChatPage />);

    const link = await screen.findByRole('link', { name: 'ChatGPT에서 계속하기' });
    expect(screen.getByText('채팅 API가 구성되지 않아 이 서버로 메시지를 전송하지 않습니다.')).toBeVisible();
    expect(link).toHaveAttribute('href', 'https://chat.example.test/continue');
    expect(link).toHaveAttribute('target', '_blank');
    expect(screen.queryByLabelText('메시지')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '메시지 보내기' })).not.toBeInTheDocument();
    expect(api.contactApi.chatMessage).not.toHaveBeenCalled();
    expect(getItem).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
  });
  it('submits messages when the internal chat provider is configured', async () => {
    api.contactApi.chatPage.mockResolvedValue({ kind: 'INTERNAL_CHAT' });
    api.contactApi.chatMessage.mockResolvedValue({ ok: true, reply: '응답' });
    render(<ChatPage />);
    expect(await screen.findByText('메시지는 구성된 학생회 채팅 서비스로 전송됩니다.')).toBeVisible();
    fireEvent.change(await screen.findByLabelText('메시지'), { target: { value: '질문' } });
    fireEvent.click(screen.getByRole('button', { name: '전송' }));
    expect(await screen.findByText('응답')).toBeVisible();
    expect(api.contactApi.chatMessage).toHaveBeenCalledWith({ body: '질문' });
  });
});
