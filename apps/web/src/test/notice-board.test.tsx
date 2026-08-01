import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NoticeBoard } from '@/components/organisms/notice-board';

const list = vi.hoisted(() => vi.fn());
vi.mock('@/lib/board-api', () => ({ boardApi: { list } }));

const config = { readPermission: 'PUBLIC', writePermission: 'AUTHENTICATED', commentPermission: 'AUTHENTICATED', commentsAllowed: true, secretArticlesAllowed: false, reactionsAllowed: true, displayOrder: 0, isHidden: false, showOnHome: true } as const;
const board = { id: 'board-1', code: 'notice', title: { value: '공지', translationUnavailable: false }, description: { value: '', translationUnavailable: false }, config, updatedAt: '2026-08-01T00:00:00.000Z' };
const article = { id: 'article-1', boardCode: 'notice', title: { value: '중요 공지', translationUnavailable: false }, status: 'PUBLISHED', scope: 'ALL', isPinned: true, pinnedOrder: 0, publishedAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z' } as const;

afterEach(() => { cleanup(); list.mockReset(); });

describe('NoticeBoard', () => {
  it('renders home-board article metadata and detail links', async () => {
    list.mockResolvedValueOnce({ locale: 'ko', items: [{ ...board, latestArticles: [article] }] });
    render(<MemoryRouter><NoticeBoard /></MemoryRouter>);

    expect(screen.getByRole('status')).toHaveTextContent('불러오는 중');
    expect(await screen.findByRole('link', { name: /고정.*중요 공지/ })).toHaveAttribute('href', '/board/notice/article-1');
    expect(screen.getByText('2026. 8. 1.')).toBeVisible();
    expect(list).toHaveBeenCalledWith({ home: true, latestLimit: 1, locale: 'ko' }, expect.any(AbortSignal));
  });

  it('shows explicit empty and error states', async () => {
    list.mockResolvedValueOnce({ locale: 'ko', items: [] });
    const { unmount } = render(<MemoryRouter><NoticeBoard /></MemoryRouter>);
    expect(await screen.findByText('표시할 게시판이 없습니다.')).toBeVisible();
    unmount();

    list.mockRejectedValueOnce(new Error('offline'));
    render(<MemoryRouter><NoticeBoard /></MemoryRouter>);
    expect(await screen.findByRole('alert')).toHaveTextContent('게시글을 불러오지 못했습니다.');
  });
});
