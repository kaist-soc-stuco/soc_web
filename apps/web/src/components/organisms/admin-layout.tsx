import { useEffect, useMemo, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { createApiClient } from "@soc/api-client";

import { Header } from "@/components/organisms/header";
import { AdminSidebar } from "@/components/organisms/admin-sidebar";
import { resolveApiBaseUrl } from "@/lib/api-base-url";
import { getAuthSessionSummary } from "@/lib/auth-session";
import { hasPersistedProfile } from "@/lib/require-persisted-profile";

export function AdminLayout() {
  const navigate = useNavigate();
  const client = useMemo(() => createApiClient({ baseUrl: resolveApiBaseUrl() }), []);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    (async () => {
      try {
        const result = await getAuthSessionSummary(client);
        setSession(result);
        
        // Basic authentication check
        if (!hasPersistedProfile(result)) {
          navigate("/login", { replace: true });
        }
      } catch (err) {
        console.error("Failed to load session", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [client, navigate]);

  return (
    <div className="min-h-screen bg-kaist-white flex flex-col">
      <Header showLogo />
      <div className="flex flex-1">
        <AdminSidebar />
        <div className="flex-1 bg-kaist-white relative">
          {loading ? (
            <div className="absolute inset-0 flex items-center justify-center bg-kaist-white z-10">
              <div className="w-10 h-10 border-4 border-kaist-darkgreen/30 border-t-kaist-darkgreen rounded-full animate-spin"></div>
            </div>
          ) : (
            <Outlet context={{ session }} />
          )}
        </div>
      </div>
    </div>
  );
}
