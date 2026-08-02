import { uiText } from "@/lib/i18n/surface-catalog";
import type { ReactNode } from 'react';
import type { AdminGrantRequirement } from '@/lib/admin-access';
import { hasAdminGrant } from '@/lib/admin-access';
import { useAdminGrants } from '@/lib/admin-grants';
export function AdminRouteGuard({ requirement, children }: {
    requirement: AdminGrantRequirement;
    children: ReactNode;
}) {
    const grants = useAdminGrants();
    if (grants.status === 'idle' || grants.status === 'loading') {
        return <p role="status">{uiText("components.organisms.admin-route-guard.fd041853ed")}</p>;
    }
    if (grants.status !== 'ready' || !hasAdminGrant(grants.grants, requirement)) {
        return <section aria-labelledby="forbidden-title"><h1 id="forbidden-title">403</h1><p>{uiText("components.organisms.admin-route-guard.693fc10991")}</p></section>;
    }
    return children;
}
export function NotFoundPage() {
    return <section aria-labelledby="not-found-title"><h1 id="not-found-title">404</h1><p>{uiText("components.organisms.admin-route-guard.a740fadfbf")}</p></section>;
}
