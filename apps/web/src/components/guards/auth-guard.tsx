import { useEffect, useRef } from "react";
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
  const { data: session, isFetching, isLoading, refetch } = useCurrentSession();
  const permissionRecheckAttempted = useRef(false);

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
    if (isLoading || isFetching) {
      return;
    }

    if (!isAuthenticated) {
      rememberAuthReturnPath(
        window.location.pathname + window.location.search + window.location.hash,
      );
      navigate(redirectTo, { replace: true });
      return;
    }

    if (hasPermission) {
      permissionRecheckAttempted.current = false;
      return;
    }

    // A role can be granted from another browser while this SPA still has a
    // cached session snapshot. Give the server one chance to return the new
    // permission before treating the user as unauthorized.
    if (!permissionRecheckAttempted.current) {
      permissionRecheckAttempted.current = true;
      void refetch();
      return;
    }

    if (!hasPermission) {
      navigate(permissionRedirectTo, { replace: true });
    }
  }, [
    hasPermission,
    isFetching,
    isAuthenticated,
    isLoading,
    navigate,
    permissionRedirectTo,
    refetch,
    redirectTo,
  ]);

  if (isLoading || isFetching) {
    return <>{fallback}</>;
  }

  if (!isAuthenticated || !hasPermission) {
    return null;
  }

  return <>{children}</>;
}
