import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

import { useCurrentSession } from "@/hooks/use-current-session";
import { rememberAuthReturnPath } from "@/lib/auth-storage";
import { Permissions } from "@/lib/permissions";
import { hasPersistedProfile } from "@/lib/require-persisted-profile";

interface AuthGuardProps {
  children: React.ReactNode;
  requirePermission?: number;
  requireAnyPermission?: number[];
  redirectTo?: string;
  permissionRedirectTo?: string;
  fallback?: React.ReactNode;
}

export function AuthGuard({
  children,
  requirePermission,
  requireAnyPermission,
  redirectTo = "/login",
  permissionRedirectTo = "/mypage",
  fallback = null,
}: AuthGuardProps) {
  const navigate = useNavigate();
  const { data: session, isLoading } = useCurrentSession();

  const isAuthenticated = hasPersistedProfile(session ?? null);
  const permission = session?.permission ?? 0;
  const hasRequiredPermission =
    requirePermission === undefined
      ? true
      : Permissions.has(permission, requirePermission);
  const hasAnyRequiredPermission =
    requireAnyPermission === undefined || requireAnyPermission.length === 0
      ? true
      : Permissions.hasAny(permission, ...requireAnyPermission);
  const hasPermission = hasRequiredPermission && hasAnyRequiredPermission;

  useEffect(() => {
    if (isLoading) {
      return;
    }

    if (!isAuthenticated) {
      rememberAuthReturnPath(
        window.location.pathname + window.location.search + window.location.hash,
      );
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
