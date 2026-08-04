import { uiText } from "@/lib/i18n/surface-catalog";
import type { ReactNode } from 'react';
import type { AdminGrantRequirement } from '@/lib/admin-access';
import { hasAdminGrant } from '@/lib/admin-access';
import { refetchAdminGrants, useAdminGrants } from '@/lib/admin-grants';
export function AdminRouteGuard({ requirement, children }: {
    requirement: AdminGrantRequirement;
    children: ReactNode;
}) {
    const grants = useAdminGrants();
    if (grants.status === 'idle' || grants.status === 'loading') {
        return <p role="status">{uiText("components.organisms.admin-route-guard.fd041853ed")}</p>;
    }
    if (grants.status === 'error') {
        return <section aria-labelledby="admin-grants-error-title"><h1 id="admin-grants-error-title">403</h1><p role="alert">{uiText("admin.grants.error")}</p><button type="button" className="mt-3 min-h-11 rounded border px-4 py-2" onClick={() => void refetchAdminGrants().catch(() => undefined)}>{uiText("admin.retry")}</button></section>;
    }
    if (!hasAdminGrant(grants.grants, requirement)) {
        return <section aria-labelledby="forbidden-title"><h1 id="forbidden-title">403</h1><p>{uiText("components.organisms.admin-route-guard.693fc10991")}</p></section>;
    }
    return children;
}
export function NotFoundPage() {
    return <section aria-labelledby="not-found-title"><h1 id="not-found-title">404</h1><p>{uiText("components.organisms.admin-route-guard.a740fadfbf")}</p></section>;
}
