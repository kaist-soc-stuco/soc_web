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
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";

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
    <header className="z-50 flex h-16 shrink-0 items-center justify-between border-b border-[#e5eaf0] bg-white/95 px-3 backdrop-blur sm:px-5 md:px-7">
      <div className="flex min-w-0 shrink-0 items-center gap-6">
        <Logo />
        <span className="hidden border-l border-slate-200 pl-6 text-sm font-semibold text-slate-800 md:inline">
          {lang === "ko" ? "관리자 대시보드" : "Admin Dashboard"}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <IconButton
          type="button"
          size="md"
          aria-label={lang === "ko" ? "알림" : "Notifications"}
          className="rounded-md border border-transparent p-2 text-app-text-body transition-colors hover:border-slate-200 hover:bg-slate-50 hover:text-brand-primary"
          title={lang === "ko" ? "알림" : "Notifications"}
        >
          <Bell className="h-4 w-4" />
        </IconButton>

        {user && (
          <div className="relative">
            <Button variant="ghost"
              type="button"
              aria-label={lang === "ko" ? `${user.name} 관리자 메뉴` : `${user.name} admin menu`}
              aria-expanded={dropdownOpen}
              onClick={() => setDropdownOpen((value) => !value)}
              onBlur={() => setTimeout(() => setDropdownOpen(false), 150)}
              className="flex min-h-10 items-center gap-2 rounded-lg border border-transparent px-2.5 py-1.5 text-sm font-medium text-app-text-strong transition-colors hover:border-slate-200 hover:bg-slate-50"
            >
              <User className="h-4 w-4 text-kaist-greygreen" />
              <span className="hidden max-w-44 truncate sm:inline">{user.name}</span>
              <ChevronDown className="h-3.5 w-3.5 text-kaist-greygreen" />
            </Button>

            {dropdownOpen && (
              <div className="absolute right-0 z-50 mt-2 w-40 overflow-hidden rounded-xl border border-slate-200 bg-white p-1 shadow-elevated">
                <Button variant="ghost"
                  type="button"
                  className="flex h-10 w-full items-center gap-2 rounded-lg px-3 text-left text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
                  onClick={() => void handleLogout()}
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span>{lang === "ko" ? "로그아웃" : "Logout"}</span>
                </Button>
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
        <div className="flex min-h-screen flex-col bg-[#f7f9fc]">
          {adminHeader}
          <div className="flex min-h-0 flex-1 flex-col md:flex-row">
            <AdminSidebar />
            <div className="relative min-w-0 flex-1 bg-[#f7f9fc]">{loadingOverlay}</div>
          </div>
        </div>
      }
    >
      <div className="flex min-h-screen flex-col bg-[#f7f9fc]">
        {adminHeader}
        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          <AdminSidebar />
          <div className="relative min-w-0 flex-1 bg-[#f7f9fc]">
            {isLoading ? loadingOverlay : <Outlet context={{ session }} />}
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}
