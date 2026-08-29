import { useEffect, useMemo, useRef, type PropsWithChildren } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";
import { createApiClient } from "@soc/api-client";

import { useCurrentSession } from "@/hooks/use-current-session";
import { resolveApiBaseUrl } from "@/lib/api-base-url";
import {
  bootChannelTalk,
  loadChannelTalkScript,
  shutdownChannelTalk,
} from "./channel-talk";

export function ChannelTalkProvider({ children }: PropsWithChildren) {
  const location = useLocation();
  const isAdminRoute = location.pathname === "/admin" || location.pathname.startsWith("/admin/");
  const hasBootedRef = useRef(false);
  const previousIdentityRef = useRef<string | null>(null);
  const { data: session, isPending: isSessionPending } = useCurrentSession();
  const channelTalkIdentity =
    session?.authenticated && session.userId ? session.userId : "anonymous";
  const apiClient = useMemo(
    () => createApiClient({ baseUrl: resolveApiBaseUrl() }),
    [],
  );
  const { data } = useQuery({
    queryKey: ["channel-talk", "config", channelTalkIdentity],
    queryFn: () => apiClient.getChannelTalkConfig(),
    enabled: !isSessionPending,
    retry: false,
    // Authentication changes must always revalidate the server-generated
    // memberId/memberHash instead of reusing an earlier identity's config.
    staleTime: 0,
  });

  useEffect(() => {
    if (isSessionPending) return;

    const previousIdentity = previousIdentityRef.current;
    previousIdentityRef.current = channelTalkIdentity;

    if (
      previousIdentity !== null &&
      previousIdentity !== channelTalkIdentity &&
      hasBootedRef.current
    ) {
      shutdownChannelTalk();
      hasBootedRef.current = false;
    }
  }, [channelTalkIdentity, isSessionPending]);

  useEffect(() => {
    if (isAdminRoute) {
      if (hasBootedRef.current) {
        shutdownChannelTalk();
        hasBootedRef.current = false;
      }
      return;
    }

    if (!data || !data.enabled || !data.pluginKey) {
      return;
    }

    const config = data;
    const pluginKey: string = data.pluginKey;
    let cancelled = false;

    const boot = async () => {
      try {
        await loadChannelTalkScript();
        if (cancelled) return;

        if (hasBootedRef.current) {
          shutdownChannelTalk();
        }
        bootChannelTalk({
          language: config.language,
          memberHash: config.memberHash,
          memberId: config.memberId,
          pluginKey,
          profile: config.profile,
          // Keep the SDK-owned launcher and messenger above page chrome
          // (headers, sticky toolbars, and footers), while leaving app modals
          // on their higher z-index layer.
          zIndex: 90,
        });
        hasBootedRef.current = true;
      } catch (error) {
        console.warn("Channel Talk could not be initialized.", error);
      }
    };

    void boot();

    return () => {
      cancelled = true;
    };
  }, [data, isAdminRoute]);

  // The SDK owns the launcher and messenger UI. Keeping this provider renderless
  // avoids a second, competing affordance in the page layout.
  return <>{children}</>;
}
