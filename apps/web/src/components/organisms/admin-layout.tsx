import { createApiClient } from "@soc/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronDown, LogOut, User } from "lucide-react";
import { Suspense, useEffect, useRef, useState } from "react";
import { Outlet } from "react-router-dom";

import { Logo } from "@/components/atoms/logo";
import { AuthGuard } from "@/components/guards/auth-guard";
import { AdminSidebar } from "@/components/organisms/admin-sidebar";
import { useCurrentSession } from "@/hooks/use-current-session";
import { useLanguage } from "@/hooks/use-language";
import { resolveApiBaseUrl } from "@/lib/api-base-url";
import { clearStoredAuthState } from "@/lib/auth-storage";
import { Permissions } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { PopoverPanel } from "@/components/ui/popover-panel";

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
  const { data: session, isLoading } = useCurrentSession();
  const queryClient = useQueryClient();
  const { lang } = useLanguage();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const hasLoadedSessionRef = useRef(false);

  useEffect(() => {
    if (!isLoading) hasLoadedSessionRef.current = true;
  }, [isLoading]);

  useEffect(() => {
    if (!dropdownOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!profileRef.current?.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setDropdownOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [dropdownOpen]);

  const handleLogout = async () => {
    const client = createApiClient({ baseUrl: resolveApiBaseUrl() });
    await client.logout();
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
    <header className="sticky top-0 z-50 flex h-16 shrink-0 items-center justify-between border-b border-[#e5eaf0] bg-white/95 px-6 backdrop-blur">
      <div className="flex min-w-0 shrink-0 items-center gap-6">
        <Logo />
        <span className="hidden border-l border-slate-200 pl-6 text-sm font-semibold text-slate-800 md:inline">
          {lang === "ko" ? "관리자 대시보드" : "Admin Dashboard"}
        </span>
      </div>

      <div className="flex items-center gap-3">
        {user && (
          <div ref={profileRef} className="relative">
            <Button variant="ghost"
              type="button"
              aria-label={lang === "ko" ? `${user.name} 관리자 메뉴` : `${user.name} admin menu`}
              aria-expanded={dropdownOpen}
              onClick={() => setDropdownOpen((value) => !value)}
              className="flex min-h-10 items-center gap-2 rounded-lg border border-transparent px-2.5 py-1.5 text-sm font-medium text-app-text-strong transition-colors hover:border-slate-200 hover:bg-slate-50"
            >
              <User className="h-4 w-4 text-kaist-greygreen" />
              <span className="hidden max-w-44 truncate sm:inline">{user.name}</span>
              <ChevronDown className="h-3.5 w-3.5 text-kaist-greygreen" />
            </Button>

            {dropdownOpen && (
              <PopoverPanel className="right-0 top-full w-52 select-none rounded-lg p-1">
                <Button variant="ghost"
                  type="button"
                  className="flex h-10 w-full items-center gap-2 rounded-md px-3 text-left text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
                  onClick={() => void handleLogout()}
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span>{lang === "ko" ? "로그아웃" : "Logout"}</span>
                </Button>
              </PopoverPanel>
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
        <div className="flex min-h-screen max-w-full flex-col overflow-x-clip bg-[#f7f9fc]">
          {adminHeader}
          <div className="flex min-h-0 flex-1 flex-col md:flex-row">
            <AdminSidebar />
            <div className="relative min-w-0 flex-1 bg-[#f7f9fc]">{loadingOverlay}</div>
          </div>
        </div>
      }
    >
      <div className="flex min-h-screen max-w-full flex-col overflow-x-clip bg-[#f7f9fc]">
        {adminHeader}
        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          <AdminSidebar />
          <div className="relative min-w-0 flex-1 bg-[#f7f9fc]">
            {isLoading && !hasLoadedSessionRef.current ? loadingOverlay : (
              <Suspense fallback={null}>
                <Outlet context={{ session }} />
              </Suspense>
            )}
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}
