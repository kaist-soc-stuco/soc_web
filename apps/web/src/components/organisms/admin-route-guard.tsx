import type { ReactNode } from 'react';

import type { AdminGrantRequirement } from '@/lib/admin-access';
import { hasAdminGrant } from '@/lib/admin-access';
import { useAdminGrants } from '@/lib/admin-grants';

export function AdminRouteGuard({ requirement, children }: { requirement: AdminGrantRequirement; children: ReactNode }) {
  const grants = useAdminGrants();

  if (grants.status === 'idle' || grants.status === 'loading') {
    return <p role="status">권한을 확인하는 중입니다.</p>;
  }
  if (grants.status !== 'ready' || !hasAdminGrant(grants.grants, requirement)) {
    return <section aria-labelledby="forbidden-title"><h1 id="forbidden-title">403</h1><p>이 관리 페이지에 접근할 권한이 없습니다.</p></section>;
  }
  return children;
}

export function NotFoundPage() {
  return <section aria-labelledby="not-found-title"><h1 id="not-found-title">404</h1><p>요청한 페이지를 찾을 수 없습니다.</p></section>;
}
