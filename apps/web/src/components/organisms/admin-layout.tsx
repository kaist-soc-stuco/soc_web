import { Outlet, Link, useNavigate } from "react-router-dom";
import { useState } from "react";

import { AuthGuard } from "@/components/guards/auth-guard";
import { AdminSidebar } from "@/components/organisms/admin-sidebar";
import { useCurrentSession } from "@/hooks/use-current-session";
import { useQueryClient } from "@tanstack/react-query";
import { createApiClient } from "@soc/api-client";
import { resolveApiBaseUrl } from "@/lib/api-base-url";
import { useLanguage } from "@/hooks/use-language";
import { Home, Bell, LogOut, User } from "lucide-react";

export function AdminLayout() {
  const { data: session, isLoading } = useCurrentSession();
  const queryClient = useQueryClient();
  const { lang } = useLanguage();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const handleLogout = async () => {
    const client = createApiClient({ baseUrl: resolveApiBaseUrl() });
    await client.logout();
    queryClient.invalidateQueries({ queryKey: ["/api/auth/session"] });
    window.location.href = "/";
  };

  const user = session?.authenticated && session.userId ? {
    id: session.userId,
    name: (lang === "ko" ? session.nameKo : (session.nameEn || session.nameKo)) ?? "사용자",
  } : null;

  const loadingOverlay = (
    <div className="absolute inset-0 flex items-center justify-center bg-kaist-white z-10">
      <div className="w-10 h-10 border-4 border-kaist-darkgreen/30 border-t-kaist-darkgreen rounded-full animate-spin"></div>
    </div>
  );

  const minimalHeader = (
    <header className="shrink-0 z-50 bg-kaist-white border-b border-kaist-grey/30 h-12 flex items-center justify-between px-6">
      {/* Left: Homepage Link / Icon */}
      <div className="flex items-center gap-2">
        <Link 
          to="/" 
          className="flex items-center gap-1.5 text-xs font-bold text-kaist-black hover:text-kaist-darkgreen-main transition-colors px-2.5 py-1.5 rounded-lg border border-kaist-grey/15 hover:bg-gray-50"
          title={lang === "ko" ? "홈페이지로 이동" : "Go to Homepage"}
        >
          <Home className="w-4 h-4 text-kaist-greygreen" />
          <span className="hidden sm:inline">{lang === "ko" ? "홈페이지" : "Home"}</span>
        </Link>
        <span className="text-xs text-kaist-grey/60 font-semibold px-1">|</span>
        <span className="text-xs font-extrabold text-kaist-darkgreen-main uppercase tracking-wider">
          {lang === "ko" ? "학생회 관리자 포탈" : "Student Council Admin Portal"}
        </span>
      </div>

      {/* Right: Notification and User Profile */}
      <div className="flex items-center gap-3">
        {/* Notification Bell */}
        <button 
          className="relative text-kaist-black hover:text-kaist-darkgreen-main p-2 hover:bg-gray-50 rounded-lg transition-colors border border-transparent hover:border-kaist-grey/15"
          title={lang === "ko" ? "알림" : "Notifications"}
        >
          <Bell className="w-4 h-4" />
        </button>

        {/* Profile / Logout Dropdown */}
        {user && (
          <div className="relative">
            <button
              onClick={() => setDropdownOpen((v) => !v)}
              onBlur={() => setTimeout(() => setDropdownOpen(false), 150)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-kaist-grey/15 hover:bg-gray-50 font-semibold text-xs text-kaist-black transition-colors"
            >
              <User className="w-3.5 h-3.5 text-kaist-greygreen" />
              <span>{user.name}</span>
              <svg className="w-3 h-3 text-kaist-greygreen" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {dropdownOpen && (
              <div className="absolute right-0 mt-1.5 w-40 bg-white border border-kaist-grey/30 shadow-lg rounded-lg z-50 py-1 overflow-hidden">
                <button
                  className="w-full text-left px-4 py-2 hover:bg-red-50 text-red-600 flex items-center gap-2 text-xs font-bold transition-colors"
                  onClick={handleLogout}
                >
                  <LogOut className="w-3.5 h-3.5" />
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
    <AuthGuard fallback={
      <div className="min-h-screen bg-kaist-white flex flex-col">
        {minimalHeader}
        <div className="flex flex-1">
          <AdminSidebar />
          <div className="flex-1 bg-kaist-white relative">{loadingOverlay}</div>
        </div>
      </div>
    }>
      <div className="min-h-screen bg-kaist-white flex flex-col">
        {minimalHeader}
        <div className="flex flex-1">
          <AdminSidebar />
          <div className="flex-1 bg-kaist-white relative">
            {isLoading ? loadingOverlay : <Outlet context={{ session }} />}
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}
