import { createContext, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useMediaQuery } from "@/hooks/use-media-query";
import { IconButton } from "@/components/ui/icon-button";
import { useToast } from "@/components/ui/toast";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";
import { createApiClient } from "@soc/api-client";

import { useCurrentSession } from "@/hooks/use-current-session";
import { resolveApiBaseUrl } from "@/lib/api-base-url";
import {
  bootChannelTalk,
  loadChannelTalkScript,
  shutdownChannelTalk,
  hideChannelTalk as hideMessenger,
  onChannelTalkVisibilityChange,
  showChannelTalk,
} from "./channel-talk";

const ChannelTalkSupportContext = createContext<() => void>(() => {});
export function useOpenChannelTalk() { return useContext(ChannelTalkSupportContext); }

function styleChannelTalkMobileSurface() {
  const frame = document.querySelector<HTMLIFrameElement>("#ch-plugin-script-iframe");
  let frameDocument: Document | null | undefined;
  try { frameDocument = frame?.contentDocument; } catch { return; }
  if (!frameDocument?.head) return;
  const media = window.innerWidth < 768 ? "all" : "not all";
  const css = `
    html, body, #ch-plugin-root, #ch-plugin-root > div,
    [class*="Layoutstyled__FullPageWrapper"],
    #ch-plugin-root header, #ch-plugin-root [class*="BaseHeaderstyled__Wrapper"] {
      background-color: #f7f7f8 !important;
    }
    #ch-plugin-root header > div { background-color: transparent !important; }
    /* The SDK renders this fixed close control outside its header. */
    [data-ch-testid="fixed-close-button"] {
      display: grid !important; place-items: center !important;
      width: 44px !important; height: 44px !important; min-width: 44px !important;
      border: 0 !important; background: transparent !important; color: #fff !important;
    }
    [data-ch-testid="fixed-close-button"]::before {
      content: ""; position: absolute; inset: 6px; border-radius: 50%; background: #737780;
    }
    [data-ch-testid="fixed-close-button"] svg {
      position: relative; z-index: 1; width: 20px; height: 20px;
    }
    [data-ch-testid="fixed-close-button"] svg,
    [data-ch-testid="fixed-close-button"] svg * { color: #fff !important; fill: #fff !important; }
  `;
  let style = frameDocument.getElementById("soc-channel-mobile-surface") as HTMLStyleElement | null;
  if (!style) { style = frameDocument.createElement("style"); style.id = "soc-channel-mobile-surface"; frameDocument.head.append(style); }
  if (style.media !== media) style.media = media;
  if (style.textContent !== css) style.textContent = css;
}

function updateChannelTalkLauncherLayer(offsetBottom: boolean, hideLauncher: boolean) {
  if (typeof document === "undefined") return;
  styleChannelTalkMobileSurface();

  const shadowHost = document.querySelector<HTMLElement>("#ch-plugin-entry > div");
  const shadowRoot = shadowHost?.shadowRoot;
  if (!shadowRoot) return;

  const hidden =
    hideLauncher ||
    document.body.classList.contains("site-mobile-menu-open") ||
    document.body.classList.contains("site-mobile-search-open") ||
    document.body.classList.contains("site-mobile-comment-open") ||
    document.body.classList.contains("ui-modal-open");
  const mobileMessengerOpen = window.innerWidth < 768 && document.body.classList.contains("channel-talk-messenger-open");
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
    : mobileMessengerOpen
      ? '[data-ch-testid="launcher"], [data-ch-testid="launcher"] * { visibility: hidden !important; pointer-events: none !important; }'
      : "";
  layerStyle.textContent += `
    @media (max-width: 767px) {
      [data-ch-testid="launcher"], [data-ch-testid="launcher"] * {
        box-shadow: none !important;
        filter: none !important;
      }
      [data-ch-testid="launcher"] > button {
        width: 44px !important;
        height: 44px !important;
        min-width: 44px !important;
        min-height: 44px !important;
        overflow: hidden !important;
        border-radius: 16px !important;
      }
      [data-ch-testid="launcher"] > button > div {
        width: 44px !important;
        height: 44px !important;
      }
      [data-ch-testid="launcher"] > button div {
        max-width: 100% !important;
        max-height: 100% !important;
      }
      [data-ch-testid="launcher"] > button :is(svg,img) {
        width: 28px !important;
        height: 28px !important;
      }
    }
  `;

  const launcherButton = shadowRoot.querySelector<HTMLButtonElement>('[data-ch-testid="launcher"] > button');
  if (!launcherButton) return;

  let launcherWrapper: HTMLElement | null = launcherButton.parentElement;
  while (launcherWrapper && launcherWrapper !== shadowHost) {
    if (getComputedStyle(launcherWrapper).position === "fixed") break;
    launcherWrapper = launcherWrapper.parentElement;
  }
  if (!launcherWrapper || launcherWrapper === shadowHost) return;
  // Never reposition the messenger: its buttons share the launcher's shadow root.
  const wrapperRect = launcherWrapper.getBoundingClientRect();
  if (wrapperRect.width > 120 || wrapperRect.height > 120) return;

  const shouldOffset = (offsetBottom || document.body.classList.contains("board-write-fab-visible")) && window.innerWidth < 768;
  launcherWrapper.style.setProperty(
    "bottom",
    shouldOffset ? "calc(5.5rem + env(safe-area-inset-bottom))" : "24px",
    "important",
  );
  const mobileScrollHidden = window.innerWidth < 768 && document.body.classList.contains("channel-talk-scroll-hidden");
  if (window.innerWidth < 768) {
    launcherWrapper.style.setProperty("box-shadow", "none", "important");
    launcherWrapper.style.setProperty("width", "44px", "important");
    launcherWrapper.style.setProperty("height", "44px", "important");
    launcherWrapper.style.setProperty("transition", "transform 180ms ease, opacity 180ms ease");
    launcherWrapper.style.setProperty("transform", mobileScrollHidden ? "translateY(100px)" : "none");
    launcherWrapper.style.setProperty("opacity", mobileScrollHidden ? "0" : "1");
  } else for (const property of ["width", "height", "box-shadow", "transition", "transform", "opacity"]) launcherWrapper.style.removeProperty(property);
  launcherWrapper.style.setProperty("visibility", hidden || mobileMessengerOpen ? "hidden" : "visible", "important");
  launcherWrapper.style.setProperty("pointer-events", hidden || mobileScrollHidden || mobileMessengerOpen ? "none" : "auto", "important");
}

export function ChannelTalkProvider({ children }: PropsWithChildren) {
  const { toast } = useToast();
  const [supportPath, setSupportPath] = useState<string | null>(null);
  const pendingSupportRef = useRef(false);
  const isMobile = useMediaQuery("(max-width: 767px)");
  const [messengerOpen, setMessengerOpen] = useState(false);
  const needsMobileCloseBar = isMobile && messengerOpen && document.querySelector("#ch-plugin-script")?.classList.contains("ch-desk-messenger");
  const location = useLocation();
  const supportRequested = supportPath === location.pathname;
  useEffect(() => { setSupportPath(null); pendingSupportRef.current = false; }, [location.pathname]);
  const isAdminRoute = location.pathname === "/admin" || location.pathname.startsWith("/admin/");
  const hideChannelTalk =
    location.pathname.startsWith("/survey/") ||
    location.pathname.startsWith("/votes/");
  const shouldOffsetChannelTalk =
    !hideChannelTalk &&
    (location.pathname.endsWith("/write") ||
      location.pathname.endsWith("/edit"));
  const hasBootedRef = useRef(false);
  useEffect(() => {
    document.body.classList.toggle("channel-talk-messenger-open", messengerOpen && isMobile);
    return () => document.body.classList.remove("channel-talk-messenger-open");
  }, [messengerOpen, isMobile]);
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

  const openSupport = () => {
    if (!data?.enabled || !data.pluginKey) {
      toast({ type: "error", message: data?.language === "en" ? "Chat is currently unavailable. Please try again later." : "지금은 상담을 연결할 수 없습니다. 잠시 후 다시 시도해 주세요." });
      return;
    }
    if (hasBootedRef.current) { showChannelTalk(); return; }
    pendingSupportRef.current = true;
    setSupportPath(location.pathname);
  };

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

    const update = () => updateChannelTalkLauncherLayer(shouldOffsetChannelTalk, hideChannelTalk);
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
  }, [hideChannelTalk, shouldOffsetChannelTalk]);

  useEffect(() => {
    let previousY = window.scrollY;
    const updateScroll = () => {
      const nextY = window.scrollY;
      if (Math.abs(nextY - previousY) < 8 && nextY > 40) return;
      document.body.classList.toggle("channel-talk-scroll-hidden", window.innerWidth < 768 && nextY > 80 && nextY > previousY);
      previousY = nextY;
      updateChannelTalkLauncherLayer(shouldOffsetChannelTalk, hideChannelTalk);
    };
    window.addEventListener("scroll", updateScroll, { passive: true });
    return () => { window.removeEventListener("scroll", updateScroll); document.body.classList.remove("channel-talk-scroll-hidden"); };
  }, [hideChannelTalk, shouldOffsetChannelTalk]);

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
      setMessengerOpen(false);
    }
  }, [channelTalkIdentity, isSessionPending]);

  useEffect(() => {
    if (isAdminRoute || (hideChannelTalk && !supportRequested)) {
      if (hasBootedRef.current) {
        shutdownChannelTalk();
        hasBootedRef.current = false;
        setMessengerOpen(false);
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
          setMessengerOpen(false);
        }
        bootChannelTalk({
          hideChannelButtonOnBoot: hideChannelTalk,
          hidePopup: window.matchMedia("(max-width: 767px)").matches,
          language: config.language,
          memberHash: config.memberHash,
          memberId: config.memberId,
          pluginKey,
          profile: config.profile,
          // Keep the SDK-owned launcher below app modals and page action bars.
          // Route-specific bottom spacing and modal/menu body states prevent
          // the launcher from competing with fixed controls.
          zIndex: 55,
        }, () => {
          if (cancelled) return;
          onChannelTalkVisibilityChange(setMessengerOpen);
          if (pendingSupportRef.current) { pendingSupportRef.current = false; showChannelTalk(); }
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
  }, [data, hideChannelTalk, isAdminRoute, supportRequested]);

  return <ChannelTalkSupportContext.Provider value={openSupport}>{children}{needsMobileCloseBar && createPortal(
    <div className="channel-mobile-close-bar"><IconButton className="channel-mobile-close" aria-label={data?.language === "en" ? "Close chat" : "상담 창 닫기"} onClick={hideMessenger}><X aria-hidden="true" strokeWidth={3} /></IconButton></div>, document.body,
  )}</ChannelTalkSupportContext.Provider>;
}
