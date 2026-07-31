import { describe, expect, it } from 'vitest';

import { hasAdminGrant, hasAnyWorkflowGrant, hasGlobalGrant, hasScopedGrant } from '@/lib/admin-access';
import { visibleAdminMenu } from '@/lib/static-site-content';

const grant = (permission: string, scope: 'GLOBAL' | 'BOARD' | 'EVENT' | 'SURVEY' = 'GLOBAL', scopeId: string | null = null) => ({ id: `${permission}-${scope}-${scopeId}`, permission, scope, scopeId, activatedFrom: '2026-01-01T00:00:00Z', expiresAt: null });

describe('admin grant access', () => {
  it('requires an exact global grant for global admin features', () => {
    expect(hasGlobalGrant([grant('USERS_MANAGE', 'BOARD', 'board-1')], 'USERS_MANAGE')).toBe(false);
    expect(hasGlobalGrant([grant('USERS_MANAGE')], 'USERS_MANAGE')).toBe(true);
    expect(hasAdminGrant([grant('USERS_MANAGE')], { kind: 'GLOBAL', permission: 'USERS_MANAGE' })).toBe(true);
  });

  it('recognizes every workflow permission regardless of its scope, but rejects unrelated grants', () => {
    for (const permission of ['PERMISSION_GRANT', 'PERMISSION_REVOKE', 'PERMISSION_APPROVE', 'PERMISSION_ACTIVATE']) {
      expect(hasAnyWorkflowGrant([grant(permission, 'EVENT', 'event-1')])).toBe(true);
      expect(hasAdminGrant([grant(permission, 'EVENT', 'event-1')], { kind: 'WORKFLOW' })).toBe(true);
    }
    expect(hasAnyWorkflowGrant([grant('PERMISSION_AUDIT')])).toBe(false);
  });

  it('allows a global authority to satisfy a scoped operation and otherwise requires the exact scope identity', () => {
    expect(hasScopedGrant([grant('PERMISSION_GRANT')], 'PERMISSION_GRANT', 'SURVEY', 'survey-1')).toBe(true);
    expect(hasScopedGrant([grant('PERMISSION_GRANT', 'SURVEY', 'survey-2')], 'PERMISSION_GRANT', 'SURVEY', 'survey-1')).toBe(false);
    expect(hasScopedGrant([grant('PERMISSION_GRANT', 'SURVEY', 'survey-1')], 'PERMISSION_GRANT', 'SURVEY', 'survey-1')).toBe(true);
  });
  it('applies every menu predicate, including the any-workflow menu item', () => {
    const expected = [
      ['FEES_MANAGE', '/admin/payments'],
      ['SURVEY_MANAGE', '/admin/surveys'],
      ['MAIL_SEND', '/admin/emails'],
      ['CONTACTS_MANAGE', '/admin/contacts'],
      ['USERS_MANAGE', '/admin/users'],
      ['PERMISSION_AUDIT', '/admin/audit-logs'],
    ];
    for (const [permission, path] of expected) {
      expect(visibleAdminMenu([grant(permission)])).toEqual([expect.objectContaining({ to: path })]);
    }
    expect(visibleAdminMenu([grant('PERMISSION_REVOKE', 'BOARD', 'board-1')])).toEqual([
      expect.objectContaining({ to: '/admin/permissions' }),
    ]);
  });
});
