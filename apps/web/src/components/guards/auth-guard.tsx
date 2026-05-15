import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

import { useCurrentSession } from "@/hooks/use-current-session";
import { Permissions } from "@/lib/permissions";
import { hasPersistedProfile } from "@/lib/require-persisted-profile";

interface AuthGuardProps {
  children: React.ReactNode;
  requirePermission?: number;
  redirectTo?: string;
  permissionRedirectTo?: string;
  fallback?: React.ReactNode;
}

export function AuthGuard({
  children,
  requirePermission,
  redirectTo = "/login",
  permissionRedirectTo = "/admin/permissions",
  fallback = null,
}: AuthGuardProps) {
  const navigate = useNavigate();
  const { data: session, isLoading } = useCurrentSession();

  const isAuthenticated = hasPersistedProfile(session ?? null);
  const hasPermission =
    requirePermission === undefined
      ? true
      : Permissions.has(session?.permission ?? 0, requirePermission);

  useEffect(() => {
    if (isLoading) {
      return;
    }

    if (!isAuthenticated) {
      navigate(redirectTo, { replace: true });
      return;
    }

    if (!hasPermission) {
      navigate(permissionRedirectTo, { replace: true });
    }
  }, [
    hasPermission,
    isAuthenticated,
    isLoading,
    navigate,
    permissionRedirectTo,
    redirectTo,
  ]);

  if (isLoading) {
    return <>{fallback}</>;
  }

  if (!isAuthenticated || !hasPermission) {
    return null;
  }

  return <>{children}</>;
}
