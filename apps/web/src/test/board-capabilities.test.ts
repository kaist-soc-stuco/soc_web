import { describe, expect, it } from 'vitest';
import type { Board, EffectivePermissionGrant } from '@soc/contracts';
import { canCreateBoardArticle } from '../lib/board-capabilities';
import type { AuthSessionSnapshot } from '../lib/auth-session';

const board = (writePermission: Board['config']['writePermission']): Board => ({
  id: 'board-1', code: 'notice', title: { value: '공지', translationUnavailable: false }, description: { value: '', translationUnavailable: false },
  config: { readPermission: 'PUBLIC', writePermission, commentPermission: 'AUTHENTICATED', commentsAllowed: true, secretArticlesAllowed: false, reactionsAllowed: true, displayOrder: 0, isHidden: false, showOnHome: true },
  updatedAt: '2026-08-01T00:00:00.000Z',
});
const auth = (authenticated: boolean): AuthSessionSnapshot => ({ epoch: 1, status: 'ready', session: { authenticated, canUsePersistentFeatures: authenticated, requiresConsent: false, storageMode: authenticated ? 'temporary' : null, ...(authenticated ? { userId: 'user-1' } : {}) } });
const grant = (permission: string): EffectivePermissionGrant => ({ id: permission, permission, scope: 'GLOBAL', scopeId: null, activatedFrom: '2026-01-01T00:00:00.000Z', expiresAt: null });

describe('canCreateBoardArticle', () => {
  it('requires authentication even when the board write policy is public', () => {
    expect(canCreateBoardArticle(board('PUBLIC'), auth(false), [])).toBe(false);
    expect(canCreateBoardArticle(board('PUBLIC'), auth(true), [])).toBe(true);
  });

  it('uses the board policy and authoritative effective grants for privileged boards', () => {
    expect(canCreateBoardArticle(board('COMMITTEE'), auth(true), [])).toBe(false);
    expect(canCreateBoardArticle(board('COMMITTEE'), auth(true), [grant('COMMITTEE_MEMBER')])).toBe(true);
    expect(canCreateBoardArticle(board('ADMIN'), auth(true), [grant('COMMITTEE_MEMBER')])).toBe(false);
    expect(canCreateBoardArticle(board('ADMIN'), auth(true), [grant('BOARD_MANAGE')])).toBe(true);
  });
});
