import { uiText } from "@/lib/i18n/surface-catalog";
import { Link } from 'react-router-dom';
import { useAdminGrants } from '@/lib/admin-grants';
import { visibleAdminMenu } from '@/lib/static-site-content';
export function AdminDashboardPage() {
    const grants = useAdminGrants();
    const menu = visibleAdminMenu(grants.grants);
    if (grants.status === 'idle' || grants.status === 'loading')
        return <p role="status">{uiText("pages.admin-dashboard-page.fd041853ed")}</p>;
    if (grants.status === 'error')
        return <p role="alert">{uiText("pages.admin-dashboard-page.21adb1bb82")}</p>;
    if (menu.length === 0)
        return <p role="alert">{uiText("pages.admin-dashboard-page.66ccd5b913")}</p>;
    return (<section>
      <h1 className="mb-6 text-[32px] font-extrabold tracking-tight text-kaist-black">{uiText("pages.admin-dashboard-page.04c1f9416a")}</h1>
      <div className="grid gap-6 xl:grid-cols-2">
        {menu.map((item) => (<Link key={item.to} to={item.to} className="border border-kaist-grey/20 bg-white px-6 py-7 transition hover:border-kaist-darkgreen">
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-kaist-darkgreen">Admin</p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-kaist-black">{item.label}</h2>
            <p className="mt-3 text-sm font-medium leading-6 text-kaist-grey">{uiText("pages.admin-dashboard-page.90174762a6")}</p>
          </Link>))}
      </div>
    </section>);
}
