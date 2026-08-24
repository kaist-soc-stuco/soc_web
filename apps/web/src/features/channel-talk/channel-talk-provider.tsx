import { useEffect, useMemo, useRef, type PropsWithChildren } from "react";
import { useQuery } from "@tanstack/react-query";
import { createApiClient } from "@soc/api-client";

import { resolveApiBaseUrl } from "@/lib/api-base-url";
import {
  bootChannelTalk,
  loadChannelTalkScript,
  shutdownChannelTalk,
} from "./channel-talk";

export function ChannelTalkProvider({ children }: PropsWithChildren) {
  const hasBootedRef = useRef(false);
  const apiClient = useMemo(
    () => createApiClient({ baseUrl: resolveApiBaseUrl() }),
    [],
  );
  const { data } = useQuery({
    queryKey: ["channel-talk", "config"],
    queryFn: () => apiClient.getChannelTalkConfig(),
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
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
  }, [data]);

  // The SDK owns the launcher and messenger UI. Keeping this provider renderless
  // avoids a second, competing affordance in the page layout.
  return <>{children}</>;
}
