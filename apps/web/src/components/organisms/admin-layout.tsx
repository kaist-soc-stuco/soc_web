import { createApiClient } from "@soc/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut, User, Menu } from "lucide-react";
import { Suspense, useState, useEffect } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";

import { AuthGuard } from "@/components/guards/auth-guard";
import { AdminSidebar } from "@/components/organisms/admin-sidebar";
import { useCurrentSession } from "@/hooks/use-current-session";
import { resolveApiBaseUrl } from "@/lib/api-base-url";
import { clearStoredAuthState } from "@/lib/auth-storage";
import { Permissions } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { AdminDrawer } from "@/components/ui/admin-drawer";
const ADMIN_ACCESS_PERMISSIONS = [
  Permissions.MANAGE_SURVEY,
  Permissions.MANAGE_SITE_CONTENT,
  Permissions.MANAGE_CALENDAR,
  Permissions.MANAGE_CONTACTS,
  Permissions.MANAGE_USERS,
  Permissions.MANAGE_FINANCE,
  Permissions.MODERATE_CONTENT,
  Permissions.MANAGE_BOARDS,
  Permissions.SEND_BULK_EMAIL,
  Permissions.VIEW_AUDIT_LOG,
  Permissions.MANAGE_ROLES,
  Permissions.MANAGE_VOTE,
];


export function AdminLayout() {
  const { data: session } = useCurrentSession();
  const queryClient = useQueryClient();
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  useEffect(() => { setMenuOpen(false); }, [location.pathname]);
  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 768px)");
    const close = () => { if (desktop.matches) setMenuOpen(false); };
    desktop.addEventListener("change", close);
    return () => desktop.removeEventListener("change", close);
  }, []);
  const logout = async () => { await createApiClient({ baseUrl: resolveApiBaseUrl() }).logout(); clearStoredAuthState(); await queryClient.invalidateQueries({ queryKey: ["auth", "session"] }); window.location.href = "/"; };
  return <AuthGuard requireAnyPermission={ADMIN_ACCESS_PERMISSIONS}>
    <div className="flex min-h-screen max-w-full flex-col md:flex-row bg-[#f6f7f9]">
      <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 md:hidden"><Link to="/" className="font-semibold">KAIST SoC</Link><Button variant="ghost" size="icon" aria-label="관리자 메뉴 열기" aria-expanded={menuOpen} onClick={() => setMenuOpen(true)}><Menu /></Button></header>
      <AdminDrawer open={menuOpen} onClose={() => setMenuOpen(false)} title="관리자 메뉴" width="max-w-xs" footer={<div className="flex items-center justify-between text-sm"><span>{session?.nameKo ?? "관리자"}</span><Button variant="ghost" size="icon" aria-label="로그아웃" onClick={() => void logout()}><LogOut strokeWidth={1.5} /></Button></div>}><div onClick={event => { if ((event.target as HTMLElement).closest("a")) setMenuOpen(false); }}><AdminSidebar /></div></AdminDrawer>
      <aside className="hidden md:flex w-full shrink-0 flex-col border-r border-slate-200 bg-white md:sticky md:top-0 md:h-svh md:w-58">
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-6 py-4"><Link to="/" aria-label="홈으로 이동" className="flex items-center gap-3 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"><img src="/admin-symbol.png" alt="" className="size-8 shrink-0 object-contain" /><span><span className="mb-1 block text-base font-semibold tracking-tight text-slate-900">KAIST SoC</span><span className="block text-xs font-medium text-slate-500">관리자 대시보드</span></span></Link></div>
        <div className="min-h-0 max-h-56 flex-1 overflow-y-auto md:max-h-none"><AdminSidebar /></div>
        <div className="flex items-center justify-between gap-2 border-t border-slate-200 px-6 py-4"><div className="flex items-center gap-2 text-sm"><User className="size-4" strokeWidth={1.5} /><span className="truncate">{session?.nameKo ?? "관리자"}</span></div><Button variant="ghost" size="icon" className="ml-auto shrink-0 text-slate-700" aria-label="로그아웃" onClick={() => void logout()}><LogOut className="size-4" strokeWidth={1.5} /></Button></div>
      </aside>
      <div className="relative min-w-0 flex-1">

        <Suspense fallback={null}><Outlet context={{ session }} /></Suspense>
      </div>
    </div>
  </AuthGuard>;
}
