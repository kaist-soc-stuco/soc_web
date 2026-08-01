import '@testing-library/jest-dom/vitest';

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EffectivePermissionGrant } from '@soc/contracts';

const mocks = vi.hoisted(() => ({
  snapshot: { status: 'ready' as 'idle' | 'loading' | 'ready' | 'error', grants: [] as EffectivePermissionGrant[] },
  api: { listUsers: vi.fn(), getUser: vi.fn(), listDefinitions: vi.fn(), listRequests: vi.fn(), listAudit: vi.fn(), requestGrant: vi.fn(), approveRequest: vi.fn(), activateRequest: vi.fn() },
  fee: { listCurrent: vi.fn(), update: vi.fn() },
  refetchAdminGrants: vi.fn(),
}));
vi.mock('@/lib/admin-grants', () => ({ useAdminGrants: () => mocks.snapshot, refetchAdminGrants: mocks.refetchAdminGrants }));
vi.mock('@/lib/admin-identity-api', async () => {
  class AdminIdentityApiError extends Error { constructor(public status: number, public code: string, public requestId: string) { super('failed'); } }
  class AdminIdentityApiProtocolError extends Error {}
  return { adminIdentityApi: mocks.api, AdminIdentityApiError, AdminIdentityApiProtocolError };
});
vi.mock('@/lib/fee-api', () => ({ feeApi: mocks.fee, FeeApiError: class FeeApiError extends Error {} }));

import { AdminAuditLogsPage } from '@/pages/admin-audit-logs-page';
import { AdminPaymentsPage } from '@/pages/admin-payments-page';
import { AdminPermissionsPage } from '@/pages/admin-permissions-page';
import { AdminUsersPage } from '@/pages/admin-users-page';

const grant = (permission: string, scope: 'GLOBAL' | 'BOARD' = 'GLOBAL', scopeId: string | null = null) => ({ id: permission, permission, scope, scopeId, activatedFrom: '2026-01-01T00:00:00Z', expiresAt: null });
const user = { id: 'user-1', kaistUid: 'uid-1', studentOrEmployeeKind: 'STUDENT' as const, studentOrEmployeeNumber: '20260001', nameKr: '홍길동', nameEn: null, majorMask: 1, privacyConsentAt: null, grants: [] };
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => { resolve = resolvePromise; });
  return { promise, resolve };
};

afterEach(() => { cleanup(); vi.clearAllMocks(); mocks.snapshot = { status: 'ready', grants: [] }; });

describe('admin foundation pages', () => {
  it('denies user and audit pages before calling protected APIs without their global grants', () => {
    render(<AdminUsersPage />);
    expect(screen.getByRole('alert')).toHaveTextContent('사용자 관리 권한이 없습니다.');
    expect(mocks.api.listUsers).not.toHaveBeenCalled();
    cleanup();
    render(<AdminAuditLogsPage />);
    expect(screen.getByRole('alert')).toHaveTextContent('감사 로그 조회 권한이 없습니다.');
    expect(mocks.api.listAudit).not.toHaveBeenCalled();
  });
  it('denies the permissions page without a workflow grant and does not load its APIs', () => {
    render(<AdminPermissionsPage />);
    expect(screen.getByRole('alert')).toHaveTextContent('권한 요청 업무 권한이 없습니다.');
    expect(mocks.api.listDefinitions).not.toHaveBeenCalled();
    expect(mocks.api.listRequests).not.toHaveBeenCalled();
  });

  it('loads the default 25-user page, supports exact name search, and only renders retained identity fields and grants', async () => {
    mocks.snapshot = { status: 'ready', grants: [grant('USERS_MANAGE')] };
    mocks.api.listUsers.mockResolvedValue({ items: [user], nextCursor: null });
    mocks.api.getUser.mockResolvedValue(user);
    render(<AdminUsersPage />);
    await waitFor(() => expect(mocks.api.listUsers).toHaveBeenCalledWith({ cursor: undefined, limit: 25 }));
    expect(await screen.findByRole('columnheader', { name: 'KAIST UID' })).toBeVisible();
    fireEvent.change(screen.getByLabelText('정확한 사용자 검색'), { target: { value: ' 홍길동 ' } });
    fireEvent.click(screen.getByRole('button', { name: '조회' }));
    await waitFor(() => expect(mocks.api.listUsers).toHaveBeenLastCalledWith({ name: '홍길동', cursor: undefined, limit: 25 }));
    fireEvent.click(await screen.findByRole('button', { name: /홍길동/ }));
    expect(await screen.findByText('유효 권한')).toBeVisible();
    expect(screen.queryByText('majorMask')).not.toBeInTheDocument();
    expect(screen.queryByText('privacyConsentAt')).not.toBeInTheDocument();
  });

  it('permits a scoped workflow grant to load permission queues while keeping user lookup disabled without USERS_MANAGE', async () => {
    mocks.snapshot = { status: 'ready', grants: [grant('PERMISSION_APPROVE', 'BOARD', 'board-1')] };
    mocks.api.listDefinitions.mockResolvedValue({ items: [{ key: 'PERMISSION_GRANT', description: 'grant' }] });
    mocks.api.listRequests.mockResolvedValue({ items: [], nextCursor: null });
    render(<AdminPermissionsPage />);
    await waitFor(() => expect(mocks.api.listRequests).toHaveBeenCalledTimes(3));
    expect(screen.getByRole('heading', { name: '권한 요청 관리' })).toBeVisible();
    expect(screen.getByLabelText('정확한 대상 사용자 검색')).toBeDisabled();
    expect(screen.getByRole('button', { name: '요청 등록' })).toBeDisabled();
  });
  it('refreshes grants after creating and activating permission changes', async () => {
    mocks.snapshot = { status: 'ready', grants: [grant('USERS_MANAGE'), grant('PERMISSION_GRANT'), grant('PERMISSION_ACTIVATE')] };
    mocks.api.listDefinitions.mockResolvedValue({ items: [{ key: 'USERS_MANAGE', description: 'Manage users' }] });
    const activationItem = {
      id: 'request-1',
      targetUserId: 'user-1',
      action: 'GRANT',
      permission: 'USERS_MANAGE',
      scope: 'GLOBAL',
      scopeId: null,
      status: 'APPROVED',
      requestedAt: '2026-01-01T00:00:00Z',
      approvedAt: '2026-01-01T01:00:00Z',
      activatedAt: null,
      expiresAt: '2026-01-02T00:00:00Z',
    };
    mocks.api.listRequests.mockImplementation(({ stage }: { stage: string }) => Promise.resolve({
      items: stage === 'ACTIVATION' ? [activationItem] : [],
      nextCursor: null,
    }));
    mocks.api.requestGrant.mockResolvedValue({ id: 'request-2', requestHash: 'hash', status: 'PENDING', requestedAt: '2026-01-01T00:00:00Z', expiresAt: '2026-01-02T00:00:00Z' });
    mocks.api.activateRequest.mockResolvedValue({ ...activationItem, status: 'ACTIVATED', activatedAt: '2026-01-01T02:00:00Z' });
    render(<AdminPermissionsPage />);

    await waitFor(() => expect(mocks.api.listRequests).toHaveBeenCalledTimes(3));
    fireEvent.change(screen.getByLabelText('대상 사용자 ID'), { target: { value: 'user-1' } });
    fireEvent.click(screen.getByRole('button', { name: '요청 등록' }));
    await waitFor(() => expect(mocks.api.requestGrant).toHaveBeenCalled());
    await waitFor(() => expect(mocks.refetchAdminGrants).toHaveBeenCalledTimes(1));

    fireEvent.click(await screen.findByRole('button', { name: '활성화' }));
    await waitFor(() => expect(mocks.api.activateRequest).toHaveBeenCalledWith('request-1', { reasonCode: 'ADMIN_REQUEST' }));
    await waitFor(() => expect(mocks.refetchAdminGrants).toHaveBeenCalledTimes(2));
  });

  it('loads audit entries with a basic safe payload', async () => {
    mocks.snapshot = { status: 'ready', grants: [grant('PERMISSION_AUDIT')] };
    mocks.api.listAudit.mockResolvedValue({ items: [{ id: 'audit-1', actorUserId: null, action: 'GRANT', recordId: 'grant-1', changedFieldNames: ['status'], correlationId: 'corr-1', reasonCode: 'ADMIN_REQUEST', occurredAt: '2026-01-01T00:00:00Z' }], nextCursor: null });
    render(<AdminAuditLogsPage />);
    expect(await screen.findByText('grant-1')).toBeVisible();
    expect(screen.getByText('status')).toBeVisible();
    expect(screen.queryByText('corr-1')).not.toBeInTheDocument();
  });

  it('retains the payment-status listing without rendering finance metadata', async () => {
    mocks.fee.listCurrent.mockResolvedValue({ items: [{ id: 'user-1', studentOrEmployeeKind: 'STUDENT', studentOrEmployeeNumber: null, nameKr: '홍길동', nameEn: null, feeStatus: 'PAID', updatedAt: '2026-01-01T00:00:00Z', amount: 50000 }], nextCursor: null });
    render(<AdminPaymentsPage />);
    expect(await screen.findByText('홍길동')).toBeVisible();
    expect(screen.getByText('납부')).toBeVisible();
    expect(screen.queryByText('50000')).not.toBeInTheDocument();
    expect(screen.queryByText(/account|bank|invoice/i)).not.toBeInTheDocument();
  });
  it('requires a reason and confirms an individual fee status change', async () => {
    mocks.fee.listCurrent.mockResolvedValue({ items: [{ id: 'user-1', studentOrEmployeeKind: 'STUDENT', studentOrEmployeeNumber: null, nameKr: '홍길동', nameEn: null, feeStatus: 'UNPAID', updatedAt: '2026-01-01T00:00:00Z' }], nextCursor: null });
    mocks.fee.update.mockResolvedValue({ userId: 'user-1', feeStatus: 'PAID', updatedAt: '2026-01-02T00:00:00Z' });
    render(<AdminPaymentsPage />);
    fireEvent.click(await screen.findByRole('button', { name: '상태 변경' }));
    const confirm = screen.getByRole('button', { name: '변경 확인' });
    expect(confirm).toBeEnabled();
    fireEvent.change(screen.getByLabelText('변경 상태'), { target: { value: 'PAID' } });
    fireEvent.change(screen.getByLabelText('변경 사유'), { target: { value: 'PAYMENT_CONFIRMED' } });
    fireEvent.click(confirm);
    await waitFor(() => expect(mocks.fee.update).toHaveBeenCalledWith('user-1', 'PAID', 'PAYMENT_CONFIRMED', undefined));
    expect(await screen.findByText('납부')).toBeVisible();
  });
  it('shows the direct page loading state until grants resolve', () => {
    mocks.snapshot = { status: 'loading', grants: [] };
    render(<AdminUsersPage />);
    expect(screen.getByText('권한을 확인하는 중입니다.')).toBeVisible();
    expect(mocks.api.listUsers).not.toHaveBeenCalled();
  });

  it('binds pagination to the submitted query and invalidates its cursor when the input changes', async () => {
    mocks.snapshot = { status: 'ready', grants: [grant('USERS_MANAGE')] };
    mocks.api.listUsers
      .mockResolvedValueOnce({ items: [], nextCursor: null })
      .mockResolvedValueOnce({ items: [user], nextCursor: 'cursor-1' })
      .mockResolvedValueOnce({ items: [{ ...user, id: 'user-2', nameKr: '임꺽정' }], nextCursor: null });
    render(<AdminUsersPage />);
    await waitFor(() => expect(mocks.api.listUsers).toHaveBeenCalledWith({ cursor: undefined, limit: 25 }));
    fireEvent.change(screen.getByLabelText('정확한 사용자 검색'), { target: { value: '홍길동' } });
    fireEvent.click(screen.getByRole('button', { name: '조회' }));
    await screen.findByRole('button', { name: /홍길동/ });
    fireEvent.click(screen.getByRole('button', { name: '더 보기' }));
    await waitFor(() => expect(mocks.api.listUsers).toHaveBeenLastCalledWith({ name: '홍길동', cursor: 'cursor-1', limit: 25 }));
    fireEvent.change(screen.getByLabelText('정확한 사용자 검색'), { target: { value: 'uid-2' } });
    expect(screen.queryByRole('button', { name: '더 보기' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /홍길동/ })).not.toBeInTheDocument();
  });

  it('ignores a stale overlapping user search after the submitted query changes', async () => {
    mocks.snapshot = { status: 'ready', grants: [grant('USERS_MANAGE')] };
    const first = deferred<{ items: (typeof user)[]; nextCursor: null }>();
    const second = deferred<{ items: (typeof user)[]; nextCursor: null }>();
    mocks.api.listUsers
      .mockResolvedValueOnce({ items: [], nextCursor: null })
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    render(<AdminUsersPage />);
    await waitFor(() => expect(mocks.api.listUsers).toHaveBeenCalledTimes(1));
    const input = screen.getByLabelText('정확한 사용자 검색');
    fireEvent.change(input, { target: { value: '이전 사용자' } });
    fireEvent.click(screen.getByRole('button', { name: '조회' }));
    fireEvent.change(input, { target: { value: '새 사용자' } });
    fireEvent.click(screen.getByRole('button', { name: '조회' }));
    second.resolve({ items: [{ ...user, id: 'new', nameKr: '새 사용자' }], nextCursor: null });
    expect(await screen.findByRole('button', { name: /새 사용자/ })).toBeVisible();
    first.resolve({ items: [{ ...user, id: 'old', nameKr: '이전 사용자' }], nextCursor: null });
    await waitFor(() => expect(screen.queryByRole('button', { name: /이전 사용자/ })).not.toBeInTheDocument());
  });

  it('refreshes workflow queues and grants after approving a request', async () => {
    mocks.snapshot = { status: 'ready', grants: [grant('PERMISSION_APPROVE'), grant('USERS_MANAGE')] };
    mocks.api.listDefinitions.mockResolvedValue({ items: [{ key: 'PERMISSION_GRANT', description: 'grant' }] });
    mocks.api.listRequests.mockImplementation(({ stage }) => Promise.resolve({
      items: stage === 'APPROVAL' ? [{ id: 'request-1', action: 'GRANT', permission: 'PERMISSION_GRANT', scope: 'GLOBAL', scopeId: null }] : [],
      nextCursor: null,
    }));
    mocks.api.approveRequest.mockResolvedValue({});
    render(<AdminPermissionsPage />);
    fireEvent.click(await screen.findByRole('button', { name: '승인' }));
    await waitFor(() => expect(mocks.api.approveRequest).toHaveBeenCalledWith('request-1', { reasonCode: 'ADMIN_REQUEST' }));
    await waitFor(() => expect(mocks.refetchAdminGrants).toHaveBeenCalledTimes(1));
    expect(mocks.api.listDefinitions).toHaveBeenCalledTimes(2);
  });
});
