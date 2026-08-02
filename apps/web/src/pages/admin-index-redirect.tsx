import { uiText } from "@/lib/i18n/surface-catalog";
import { Navigate } from 'react-router-dom';
import { useAdminGrants } from '@/lib/admin-grants';
import { visibleAdminMenu } from '@/lib/static-site-content';
export function AdminIndexRedirect() {
    const grants = useAdminGrants();
    const menu = visibleAdminMenu(grants.grants);
    if (grants.status === 'idle' || grants.status === 'loading') {
        return <p className="text-sm font-semibold text-[#39404B]">{uiText("pages.admin-index-redirect.fd041853ed")}</p>;
    }
    if (grants.status === 'error') {
        return <p role="alert" className="text-sm font-semibold text-red-700">{uiText("pages.admin-index-redirect.21adb1bb82")}</p>;
    }
    const firstVisible = menu[0];
    if (!firstVisible) {
        return <p role="alert" className="text-sm font-semibold text-red-700">{uiText("pages.admin-index-redirect.66ccd5b913")}</p>;
    }
    return <Navigate to={firstVisible.to} replace/>;
}
