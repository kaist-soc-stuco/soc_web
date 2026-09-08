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

function updateChannelTalkLauncherLayer(offsetBottom: boolean) {
  if (typeof document === "undefined") return;

  const shadowHost = document.querySelector<HTMLElement>("#ch-plugin-entry > div");
  const shadowRoot = shadowHost?.shadowRoot;
  if (!shadowRoot) return;

  const hidden =
    document.body.classList.contains("site-mobile-menu-open") ||
    document.body.classList.contains("ui-modal-open");
  let layerStyle = shadowRoot.querySelector<HTMLStyleElement>(
    "style[data-soc-channel-talk-mobile-layer]",
  );
  if (!layerStyle) {
    layerStyle = document.createElement("style");
    layerStyle.dataset.socChannelTalkMobileLayer = "true";
    shadowRoot.append(layerStyle);
  }
  layerStyle.textContent = hidden
    ? "* { visibility: hidden !important; pointer-events: none !important; }"
    : "";

  const launcherButton = [...shadowRoot.querySelectorAll("button")].find((button) => {
    const rect = button.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  });
  if (!launcherButton) return;

  let launcherWrapper: HTMLElement | null = launcherButton.parentElement;
  while (launcherWrapper && launcherWrapper !== shadowHost) {
    if (getComputedStyle(launcherWrapper).position === "fixed") break;
    launcherWrapper = launcherWrapper.parentElement;
  }
  if (!launcherWrapper || launcherWrapper === shadowHost) return;

  const shouldOffset = offsetBottom && window.innerWidth < 768;
  launcherWrapper.style.setProperty(
    "bottom",
    shouldOffset ? "calc(5.5rem + env(safe-area-inset-bottom))" : "24px",
    "important",
  );
  launcherWrapper.style.setProperty("visibility", hidden ? "hidden" : "visible", "important");
  launcherWrapper.style.setProperty("pointer-events", hidden ? "none" : "auto", "important");
}

export function ChannelTalkProvider({ children }: PropsWithChildren) {
  const location = useLocation();
  const isAdminRoute = location.pathname === "/admin" || location.pathname.startsWith("/admin/");
  const shouldOffsetChannelTalk =
    location.pathname.endsWith("/write") ||
    location.pathname.endsWith("/edit") ||
    location.pathname.startsWith("/survey/") ||
    location.pathname.startsWith("/votes/");
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
    if (typeof document === "undefined") return;

    document.body.classList.toggle(
      "channel-talk-offset-bottom",
      shouldOffsetChannelTalk,
    );
    return () => document.body.classList.remove("channel-talk-offset-bottom");
  }, [shouldOffsetChannelTalk]);

  useEffect(() => {
    if (typeof document === "undefined") return;

    const update = () => updateChannelTalkLauncherLayer(shouldOffsetChannelTalk);
    const observer = new MutationObserver(update);
    observer.observe(document.body, { attributes: true, attributeFilter: ["class"] });
    const intervalId = window.setInterval(update, 250);
    window.addEventListener("resize", update);
    update();

    return () => {
      observer.disconnect();
      window.clearInterval(intervalId);
      window.removeEventListener("resize", update);
    };
  }, [shouldOffsetChannelTalk]);

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
          // Keep the SDK-owned launcher below app modals and page action bars.
          // Route-specific bottom spacing and modal/menu body states prevent
          // the launcher from competing with fixed controls.
          zIndex: 55,
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
