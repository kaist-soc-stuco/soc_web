import { createApiClient } from "@soc/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut, User } from "lucide-react";
import { Suspense } from "react";
import { Link, Outlet } from "react-router-dom";

import { AuthGuard } from "@/components/guards/auth-guard";
import { AdminSidebar } from "@/components/organisms/admin-sidebar";
import { useCurrentSession } from "@/hooks/use-current-session";
import { resolveApiBaseUrl } from "@/lib/api-base-url";
import { clearStoredAuthState } from "@/lib/auth-storage";
import { Permissions } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
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
  const logout = async () => { await createApiClient({ baseUrl: resolveApiBaseUrl() }).logout(); clearStoredAuthState(); await queryClient.invalidateQueries({ queryKey: ["auth", "session"] }); window.location.href = "/"; };
  return <AuthGuard requireAnyPermission={ADMIN_ACCESS_PERMISSIONS}>
    <div className="flex min-h-screen max-w-full flex-col md:flex-row bg-[#f7f9fc]">
      <aside className="flex w-full shrink-0 flex-col border-r border-slate-200 bg-white md:sticky md:top-0 md:h-svh md:w-64">
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-6 py-4"><Link to="/" aria-label="홈으로 이동" className="rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"><p className="mb-1 text-lg font-bold tracking-tight text-slate-900">KAIST SoC</p><p className="text-xs font-medium text-slate-500">관리자 대시보드</p></Link></div>
        <div className="min-h-0 max-h-56 flex-1 overflow-y-auto md:max-h-none"><AdminSidebar /></div>
        <div className="flex items-center justify-between gap-2 border-t border-slate-200 px-6 py-4"><div className="flex items-center gap-2 text-sm"><User className="size-4" /><span className="truncate">{session?.nameKo ?? "관리자"}</span></div><Button variant="ghost" size="icon" className="ml-auto shrink-0 text-slate-700" aria-label="로그아웃" title="로그아웃" onClick={() => void logout()}><LogOut className="size-4" /></Button></div>
      </aside>
      <div className="relative min-w-0 flex-1">

        <Suspense fallback={<p role="status" className="p-6">화면을 불러오는 중입니다.</p>}><Outlet context={{ session }} /></Suspense>
      </div>
    </div>
  </AuthGuard>;
}
