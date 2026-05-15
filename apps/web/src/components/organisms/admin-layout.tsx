import { Outlet } from "react-router-dom";

import { AuthGuard } from "@/components/guards/auth-guard";
import { Header } from "@/components/organisms/header";
import { AdminSidebar } from "@/components/organisms/admin-sidebar";
import { useCurrentSession } from "@/hooks/use-current-session";

export function AdminLayout() {
  const { data: session, isLoading } = useCurrentSession();

  const loadingOverlay = (
    <div className="absolute inset-0 flex items-center justify-center bg-kaist-white z-10">
      <div className="w-10 h-10 border-4 border-kaist-darkgreen/30 border-t-kaist-darkgreen rounded-full animate-spin"></div>
    </div>
  );

  return (
    <AuthGuard fallback={
      <div className="min-h-screen bg-kaist-white flex flex-col">
        <Header showLogo />
        <div className="flex flex-1">
          <AdminSidebar />
          <div className="flex-1 bg-kaist-white relative">{loadingOverlay}</div>
        </div>
      </div>
    }>
      <div className="min-h-screen bg-kaist-white flex flex-col">
        <Header showLogo />
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
