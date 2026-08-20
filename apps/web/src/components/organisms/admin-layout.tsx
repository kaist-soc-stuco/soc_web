import { createApiClient } from "@soc/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { Bell, ChevronDown, LogOut, User } from "lucide-react";
import { useState } from "react";
import { Outlet } from "react-router-dom";

import { Logo } from "@/components/atoms/logo";
import { AuthGuard } from "@/components/guards/auth-guard";
import { AdminSidebar } from "@/components/organisms/admin-sidebar";
import { useCurrentSession } from "@/hooks/use-current-session";
import { useLanguage } from "@/hooks/use-language";
import { resolveApiBaseUrl } from "@/lib/api-base-url";
import { clearStoredAuthState } from "@/lib/auth-storage";
import { getTemporaryAuthRequest } from "@/lib/auth-session";
import { Permissions } from "@/lib/permissions";

const ADMIN_ACCESS_PERMISSIONS = [
  Permissions.MANAGE_SURVEY,
  Permissions.MANAGE_CONTENT,
  Permissions.MANAGE_FINANCE,
  Permissions.ADMIN,
];

export function AdminLayout() {
  const { data: session, isLoading } = useCurrentSession();
  const queryClient = useQueryClient();
  const { lang } = useLanguage();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const handleLogout = async () => {
    const client = createApiClient({ baseUrl: resolveApiBaseUrl() });
    await client.logout(getTemporaryAuthRequest());
    clearStoredAuthState();
    await queryClient.invalidateQueries({ queryKey: ["auth", "session"] });
    window.location.href = "/";
  };

  const user =
    session?.authenticated && session.userId
      ? {
          id: session.userId,
          name:
            (lang === "ko"
              ? session.nameKo
              : session.nameEn || session.nameKo) ?? "사용자",
        }
      : null;

  const loadingOverlay = (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-background">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-primary/20 border-t-brand-primary" />
    </div>
  );

  const adminHeader = (
    <header className="z-50 flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-5 md:px-6">
      <div className="flex items-center gap-8">
        <Logo />
        <span className="hidden text-sm font-extrabold text-kaist-black md:inline">
          {lang === "ko" ? "관리자 대시보드" : "Admin Dashboard"}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          className="rounded-md border border-transparent p-2 text-app-text-body transition-colors hover:border-slate-200 hover:bg-slate-50 hover:text-brand-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
          title={lang === "ko" ? "알림" : "Notifications"}
        >
          <Bell className="h-4 w-4" />
        </button>

        {user && (
          <div className="relative">
            <button
              type="button"
              aria-expanded={dropdownOpen}
              onClick={() => setDropdownOpen((value) => !value)}
              onBlur={() => setTimeout(() => setDropdownOpen(false), 150)}
              className="flex min-h-10 items-center gap-2 rounded-md border border-transparent px-3 py-1.5 text-sm font-semibold text-app-text-strong transition-colors hover:border-slate-200 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
            >
              <User className="h-4 w-4 text-kaist-greygreen" />
              <span className="max-w-44 truncate">{user.name}</span>
              <ChevronDown className="h-3.5 w-3.5 text-kaist-greygreen" />
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 z-50 mt-1.5 w-40 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-elevated">
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-4 py-2 text-left text-xs font-bold text-red-600 transition-colors hover:bg-red-50"
                  onClick={() => void handleLogout()}
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span>{lang === "ko" ? "로그아웃" : "Logout"}</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );

  return (
    <AuthGuard
      requireAnyPermission={ADMIN_ACCESS_PERMISSIONS}
      fallback={
        <div className="flex min-h-screen flex-col bg-background">
          {adminHeader}
          <div className="flex flex-1 flex-col md:flex-row">
            <AdminSidebar />
            <div className="relative flex-1 bg-background">{loadingOverlay}</div>
          </div>
        </div>
      }
    >
      <div className="flex min-h-screen flex-col bg-background">
        {adminHeader}
        <div className="flex flex-1 flex-col md:flex-row">
          <AdminSidebar />
          <div className="relative flex-1 bg-background">
            {isLoading ? loadingOverlay : <Outlet context={{ session }} />}
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}
