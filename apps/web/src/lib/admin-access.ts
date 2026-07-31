import type { EffectivePermissionGrant, PermissionGrantScope } from '@soc/contracts';

export type AdminGrantRequirement =
  | { kind: 'GLOBAL'; permission: string }
  | { kind: 'WORKFLOW' };

export const workflowPermissions = new Set([
  'PERMISSION_GRANT',
  'PERMISSION_REVOKE',
  'PERMISSION_APPROVE',
  'PERMISSION_ACTIVATE',
]);

export function hasGlobalGrant(grants: readonly EffectivePermissionGrant[], permission: string): boolean {
  return grants.some((grant) => grant.permission === permission && grant.scope === 'GLOBAL' && grant.scopeId === null);
}

export function hasAnyWorkflowGrant(grants: readonly EffectivePermissionGrant[]): boolean {
  return grants.some((grant) => workflowPermissions.has(grant.permission));
}

export function hasAdminGrant(grants: readonly EffectivePermissionGrant[], requirement: AdminGrantRequirement): boolean {
  return requirement.kind === 'GLOBAL'
    ? hasGlobalGrant(grants, requirement.permission)
    : hasAnyWorkflowGrant(grants);
}

export function hasScopedGrant(
  grants: readonly EffectivePermissionGrant[],
  permission: string,
  scope: PermissionGrantScope,
  scopeId: string | null,
): boolean {
  return grants.some((grant) => grant.permission === permission && (
    grant.scope === 'GLOBAL' || (grant.scope === scope && grant.scopeId === scopeId)
  ));
}
