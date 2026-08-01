import type { Board, EffectivePermissionGrant } from '@soc/contracts';
import type { AuthSessionSnapshot } from './auth-session';

const hasGlobalGrant = (grants: readonly EffectivePermissionGrant[], permission: string): boolean =>
  grants.some((grant) => grant.permission === permission && grant.scope === 'GLOBAL' && grant.scopeId === null);

export function canCreateBoardArticle(
  board: Board | null,
  auth: AuthSessionSnapshot,
  grants: readonly EffectivePermissionGrant[],
): boolean {
  if (!board || auth.status !== 'ready' || !auth.session.authenticated) return false;
  if (board.config.writePermission === 'PUBLIC' || board.config.writePermission === 'AUTHENTICATED') return true;
  if (board.config.writePermission === 'COMMITTEE') return hasGlobalGrant(grants, 'COMMITTEE_MEMBER');
  return hasGlobalGrant(grants, 'BOARD_MANAGE');
}
