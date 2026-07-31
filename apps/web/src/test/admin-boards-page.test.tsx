import '@testing-library/jest-dom/vitest';

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({ adminList: vi.fn(), adminCreate: vi.fn(), adminPatch: vi.fn(), adminDelete: vi.fn() }));
const catalog = vi.hoisted(() => ({ load: vi.fn(), invalidate: vi.fn() }));
const grants = vi.hoisted(() => ({ current: { status: 'ready', grants: [] as unknown[] } }));
class ApiError extends Error { constructor(public readonly status: number, public readonly code?: string, message?: string) { super(message); } }
class ProtocolError extends Error {}
vi.mock('@/lib/board-api', () => ({ BoardApiError: ApiError, BoardApiProtocolError: ProtocolError, boardApi: api }));
vi.mock('@/lib/admin-grants', () => ({ useAdminGrants: () => grants.current }));
vi.mock('@/lib/board-catalog', () => ({ loadBoardCatalog: catalog.load, invalidateBoardCatalog: catalog.invalidate }));
vi.mock('@/lib/auth-session', () => ({ getAuthSessionSnapshot: () => ({ status: 'ready' }) }));

const board = { id: 'board-1', code: 'notice', titleKr: '공지', titleEn: 'Notice', descriptionKr: '설명', descriptionEn: 'Description', readPermission: 'PUBLIC', writePermission: 'AUTHENTICATED', commentPermission: 'AUTHENTICATED', commentsAllowed: true, secretArticlesAllowed: false, reactionsAllowed: true, displayOrder: 1, isHidden: false, showOnHome: true, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-02T00:00:00Z' };
const manageGrant = { id: 'g', permission: 'BOARD_MANAGE', scope: 'GLOBAL', scopeId: null, activatedFrom: '2026-01-01T00:00:00Z', expiresAt: null };

beforeEach(() => { vi.resetModules(); grants.current = { status: 'ready', grants: [manageGrant] }; Object.values(api).forEach((mock) => mock.mockReset()); catalog.load.mockReset().mockResolvedValue([]); catalog.invalidate.mockReset(); api.adminList.mockResolvedValue({ items: [board] }); });
afterEach(cleanup);
const Page = async () => (await import('@/pages/admin-boards-page')).AdminBoardsPage;

describe('AdminBoardsPage', () => {
  it('fails closed before it calls board CRUD without the global management grant', async () => {
    grants.current = { status: 'ready', grants: [] };
    const Component = await Page();
    render(<Component />);
    expect(screen.getByRole('alert')).toHaveTextContent('게시판 관리 권한이 없습니다.');
    expect(api.adminList).not.toHaveBeenCalled();
  });

  it('creates a board with trimmed code and refreshes the mounted list', async () => {
    api.adminCreate.mockResolvedValue(board);
    const Component = await Page();
    render(<Component />);
    await screen.findByText('공지');
    const inputs = screen.getAllByRole('textbox');
    fireEvent.change(inputs[0], { target: { value: ' new-board ' } });
    fireEvent.change(inputs[1], { target: { value: '새 게시판' } });
    fireEvent.change(inputs[2], { target: { value: 'New board' } });
    fireEvent.change(inputs[3], { target: { value: '설명' } });
    fireEvent.change(inputs[4], { target: { value: 'Description' } });
    fireEvent.click(screen.getByRole('button', { name: '게시판 만들기' }));
    await waitFor(() => expect(api.adminCreate).toHaveBeenCalledWith(expect.objectContaining({ code: 'new-board', titleKr: '새 게시판' })));
    expect(api.adminList).toHaveBeenCalledTimes(2);
  });

  it('sends the displayed version for edits and reports stale and article-conflict failures', async () => {
    const Component = await Page();
    const { rerender } = render(<Component />);
    await screen.findByText('공지');
    fireEvent.click(screen.getByRole('button', { name: '편집' }));
    fireEvent.change(screen.getAllByRole('textbox')[1], { target: { value: '변경 공지' } });
    api.adminPatch.mockRejectedValueOnce(new ApiError(409, 'board_stale'));
    fireEvent.click(screen.getByRole('button', { name: '변경 저장' }));
    await screen.findByRole('alert');
    expect(api.adminPatch).toHaveBeenCalledWith('board-1', expect.objectContaining({ expectedUpdatedAt: board.updatedAt, titleKr: '변경 공지' }));
    api.adminDelete.mockRejectedValueOnce(new ApiError(409, 'board_has_articles'));
    rerender(<Component />);
    fireEvent.click(screen.getByRole('button', { name: '삭제' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('게시글이 있는 게시판은 삭제할 수 없습니다.'));
  });
  it.each([
    [new ProtocolError(), '서버 응답 형식을 확인할 수 없습니다. 새로고침 후 다시 시도해 주세요.'],
    [new ApiError(401), '게시판 관리 권한이 없거나 세션이 만료되었습니다.'],
    [new ApiError(403), '게시판 관리 권한이 없거나 세션이 만료되었습니다.'],
    [new ApiError(409, 'board_has_articles'), '게시글이 있는 게시판은 삭제할 수 없습니다. 보존 기간이 끝나 게시글 행이 실제로 제거된 뒤 다시 시도해 주세요.'],
    [new ApiError(409, 'board_stale'), '다른 관리자가 먼저 변경했습니다. 목록을 새로고침한 뒤 현재 설정을 다시 적용해 주세요.'],
    [new ApiError(409, 'board_conflict'), '게시판 코드 또는 표시 순서가 이미 사용 중입니다.'],
    [new ApiError(400, 'invalid_board_version'), '게시판 버전 정보가 올바르지 않습니다. 목록을 새로고침해 주세요.'],
    [new ApiError(400, 'invalid_board_order'), '표시 순서는 0 이상의 정수여야 합니다.'],
    [new ApiError(400, 'invalid_board'), '게시판 입력값을 확인해 주세요.'],
    [new ApiError(400, 'invalid_board_id'), '게시판 입력값을 확인해 주세요.'],
    [new ApiError(500), '게시판 요청을 처리하지 못했습니다.'],
    [new TypeError('offline'), '게시판 정보를 처리하지 못했습니다. 네트워크 연결을 확인한 뒤 다시 시도해 주세요.'],
  ] as [unknown, string][])('maps board mutation error %# to its exact Korean UI message', async (error, message) => {
    const Component = await Page();
    render(<Component />);
    await screen.findByText('공지');
    fireEvent.click(screen.getByRole('button', { name: '편집' }));
    api.adminPatch.mockRejectedValueOnce(error);
    fireEvent.click(screen.getByRole('button', { name: '변경 저장' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(message);
  });

  it.each([
    ['create', 'list'],
    ['create', 'catalog'],
    ['patch', 'list'],
    ['patch', 'catalog'],
    ['delete', 'list'],
    ['delete', 'catalog'],
  ] as const)('preserves a committed %s mutation and offers a reconciliation retry when the %s refresh fails', async (operation, refreshTarget) => {
    const saved = { ...board, titleKr: '저장된 공지', updatedAt: '2026-01-03T00:00:00Z' };
    if (refreshTarget === 'list') api.adminList.mockResolvedValueOnce({ items: [board] }).mockRejectedValueOnce(new TypeError('offline'));
    else catalog.load.mockRejectedValueOnce(new TypeError('offline'));
    if (operation === 'create') api.adminCreate.mockResolvedValue(saved);
    if (operation === 'patch') api.adminPatch.mockResolvedValue(saved);
    if (operation === 'delete') api.adminDelete.mockResolvedValue(undefined);
    const Component = await Page();
    render(<Component />);
    await screen.findByText('공지');

    if (operation === 'create') {
      const inputs = screen.getAllByRole('textbox');
      fireEvent.change(inputs[0], { target: { value: 'new-board' } });
      fireEvent.change(inputs[1], { target: { value: '새 게시판' } });
      fireEvent.change(inputs[2], { target: { value: 'New board' } });
      fireEvent.change(inputs[3], { target: { value: '설명' } });
      fireEvent.change(inputs[4], { target: { value: 'Description' } });
      fireEvent.click(screen.getByRole('button', { name: '게시판 만들기' }));
      await waitFor(() => expect(api.adminCreate).toHaveBeenCalled());
    } else if (operation === 'patch') {
      fireEvent.click(screen.getByRole('button', { name: '편집' }));
      fireEvent.click(screen.getByRole('button', { name: '변경 저장' }));
      await waitFor(() => expect(api.adminPatch).toHaveBeenCalled());
    } else {
      fireEvent.click(screen.getByRole('button', { name: '삭제' }));
      await waitFor(() => expect(api.adminDelete).toHaveBeenCalled());
    }

    expect(await screen.findByText(/게시판 변경은 저장되었지만/)).toBeVisible();
    expect(screen.getByRole('button', { name: '새로고침 다시 시도' })).toBeVisible();
  });
  it('hides mutation controls when the admin list endpoint denies an otherwise authorized manager', async () => {
    api.adminList.mockRejectedValueOnce(new ApiError(403));
    const Component = await Page();
    render(<Component />);

    expect(await screen.findByRole('alert')).toHaveTextContent('게시판 관리 권한이 없거나 세션이 만료되었습니다.');
    expect(screen.queryByRole('button', { name: '게시판 만들기' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '편집' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '삭제' })).not.toBeInTheDocument();
  });
  it.each(['loading', 'error'] as const)('invalidates protected board data while stale manager grants are %s', async (status) => {
    let resolveList: (value: { items: (typeof board)[] }) => void = () => undefined;
    api.adminList.mockReturnValueOnce(new Promise((resolve) => { resolveList = resolve; }));
    const Component = await Page();
    const { rerender } = render(<Component />);
    await waitFor(() => expect(api.adminList).toHaveBeenCalledTimes(1));

    grants.current = { status, grants: [manageGrant] };
    rerender(<Component />);

    expect(screen.getByText('권한을 확인하는 중입니다.')).toBeVisible();
    expect(screen.queryByRole('button', { name: '게시판 만들기' })).not.toBeInTheDocument();
    resolveList({ items: [board] });
    await waitFor(() => expect(screen.queryByText('공지')).not.toBeInTheDocument());
  });
});
