import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { createApiClient } from "@soc/api-client";
import { ChevronRight, User } from "lucide-react";
import { Link } from "react-router-dom";
import { useCurrentSession } from "@/hooks/use-current-session";
import { resolveApiBaseUrl } from "@/lib/api-base-url";

export function MobileNavigationProfile({
  lang,
  onNavigate,
  onLogin,
}: {
  lang: string;
  onNavigate: () => void;
  onLogin: () => void;
}) {
  const { data: session } = useCurrentSession();
  const client = useMemo(
    () => createApiClient({ baseUrl: resolveApiBaseUrl() }),
    [],
  );
  const { data } = useQuery({
    queryKey: ["mobile-menu-profile", session?.userId],
    queryFn: () => client.getCurrentUser(),
    enabled: Boolean(session?.canUsePersistentFeatures),
    staleTime: 30_000,
  });
  const name =
    lang === "ko"
      ? (session?.nameKo ?? session?.userName)
      : (session?.nameEn ?? session?.userName ?? session?.nameKo);
  if (!session?.canUsePersistentFeatures)
    return (
      <button className="mobile-nav-profile" type="button" onClick={onLogin}>
        <span className="mobile-profile-avatar">
          <User />
        </span>
        <span>
          <strong>{lang === "ko" ? "로그인" : "Sign in"}</strong>
          <small>
            {lang === "ko"
              ? "KAIST 계정으로 로그인하세요"
              : "Sign in with your KAIST account"}
          </small>
        </span>
        <ChevronRight />
      </button>
    );
  return (
    <Link className="mobile-nav-profile" to="/mypage" onClick={onNavigate}>
      <span className="mobile-profile-avatar">
        <User aria-hidden="true" />
      </span>
      <span>
        <strong>{name}</strong>
        <small>
          {[data?.user?.studentNumber, session.primaryMajor]
            .filter(Boolean)
            .join(" · ")}
        </small>
      </span>
      <ChevronRight aria-hidden="true" />
    </Link>
  );
}
