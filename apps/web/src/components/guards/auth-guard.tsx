import { useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ShieldAlert, WifiOff } from "lucide-react";

import { useCurrentSession } from "@/hooks/use-current-session";
import { rememberAuthReturnPath } from "@/lib/auth-storage";
import { Permissions } from "@/lib/permissions";
import { hasPersistedProfile } from "@/lib/require-persisted-profile";
import { useLanguage } from "@/hooks/use-language";
import { Button } from "@/components/ui/button";
import { ResponseStateCard, responseStateActionClassName } from "@/features/survey/response-state-card";

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
  const { lang } = useLanguage();
  const { data: session, isError, isFetching, isLoading, refetch } = useCurrentSession();
  const permissionRecheckAttempted = useRef(false);

  const isAuthenticated = hasPersistedProfile(session ?? null);
  const isTemporarySession = session?.authenticated && session.storageMode === "temporary";
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
    if (isLoading || isFetching || (isError && !session)) {
      return;
    }

    if (!isAuthenticated) {
      if (isTemporarySession) return;
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

  }, [
    hasPermission,
    isFetching,
    isError,
    isAuthenticated,
    isTemporarySession,
    isLoading,
    navigate,
    refetch,
    redirectTo,
    session,
  ]);

  if (isLoading) {
    return <>{fallback}</>;
  }

  if (isError && !session) {
    return <ResponseStateCard embedded icon={WifiOff} role="alert" className="px-6 py-16"
      title={lang === "ko" ? "로그인 상태를 확인하지 못했습니다" : "Could not check your sign-in status"}
      description={lang === "ko" ? "잠시 후 다시 시도해 주세요." : "Please try again shortly."}
      actions={<Button variant="outline" className={responseStateActionClassName} loading={isFetching} onClick={() => void refetch()}>{lang === "ko" ? "다시 시도" : "Try again"}</Button>}
    />;
  }

  if (!isAuthenticated) {
    if (isTemporarySession) {
      return <ResponseStateCard embedded icon={ShieldAlert} headingAs="h1" className="px-6 py-16"
        title={lang === "ko" ? "개인정보 제공 동의가 필요합니다" : "Consent is required"}
        description={lang === "ko" ? "임시 이용 중에는 이 기능을 이용할 수 없습니다. 이용하려면 다시 로그인해 동의를 완료해 주세요." : "This feature is unavailable during temporary access. To use it, sign in again and complete the consent process."}
        actions={<>
          <Button asChild variant="outline" className={responseStateActionClassName}><Link to="/">{lang === "ko" ? "홈으로" : "Go home"}</Link></Button>
          <Button asChild className={responseStateActionClassName}><Link to={redirectTo} onClick={() => rememberAuthReturnPath()}>{lang === "ko" ? "다시 로그인" : "Sign in again"}</Link></Button>
        </>}
      />;
    }
    return null;
  }

  if (!hasPermission) {
    return <ResponseStateCard embedded icon={ShieldAlert} role="alert" className="px-6 py-16"
      title={lang === "ko" ? "이 기능을 이용할 권한이 없습니다" : "You do not have access to this feature"}
      description={lang === "ko" ? "다른 메뉴는 계속 이용할 수 있습니다." : "You can continue using other parts of the site."}
      actions={<Button asChild variant="outline" className={responseStateActionClassName}><Link to={permissionRedirectTo}>{lang === "ko" ? "돌아가기" : "Go back"}</Link></Button>}
    />;
  }

  return <>{children}</>;
}
