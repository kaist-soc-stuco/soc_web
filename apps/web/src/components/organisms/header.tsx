import { createApiClient } from "@soc/api-client";
import {
  OPERATIONAL_SURVEY_IDS,
  operationalSurveyPath,
  type NotificationRecord,
} from "@soc/contracts";
import { useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  ChevronDown,
  Globe,
  LayoutDashboard,
  LogOut,
  Menu,
  Search,
  User,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { Logo } from "@/components/atoms/logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { PopoverPanel } from "@/components/ui/popover-panel";
import { TextInput } from "@/components/ui/text-input";
import { useBoardCatalog } from "@/hooks/use-board-catalog";
import { useCurrentSession } from "@/hooks/use-current-session";
import { useLanguage } from "@/hooks/use-language";
import { resolveApiBaseUrl } from "@/lib/api-base-url";
import { clearStoredAuthState, rememberAuthReturnPath } from "@/lib/auth-storage";
import { getTemporaryAuthRequest } from "@/lib/auth-session";
import { getBoardLabelFromMetadata, isLegacyPublicBoardCode } from "@/lib/board-metadata";
import { Permissions } from "@/lib/permissions";

interface HeaderProps {
  variant?: "default" | "home";
}

type HeaderNavItem = {
  activePaths?: string[];
  megaItems: Array<{ href: string; label: string }>;
  href: string;
  label: string;
};

export function Header({ variant = "default" }: HeaderProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const notificationRef = useRef<HTMLDivElement>(null);
  const { data: session } = useCurrentSession();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [loginStarting, setLoginStarting] = useState(false);
  const [mockLoginStarting, setMockLoginStarting] = useState(false);
  const { lang, setLanguage } = useLanguage();

  const apiClient = useMemo(
    () => createApiClient({ baseUrl: resolveApiBaseUrl() }),
    [],
  );
  const { boards: boardNavItems } = useBoardCatalog(apiClient);

  const user =
    session?.authenticated && session.userId
      ? {
          id: session.userId,
          name:
            lang === "ko"
              ? session.nameKo ?? session.userName ?? session.nameEn ?? "사용자"
              : session.nameEn ?? session.userName ?? session.nameKo ?? "User",
          permission: session.permission ?? 0,
        }
      : null;
  const canUseAdminDashboard = user
    ? Permissions.hasAny(
        user.permission,
        Permissions.MANAGE_SURVEY,
        Permissions.MANAGE_SITE_CONTENT,
        Permissions.MANAGE_CALENDAR,
        Permissions.MANAGE_CONTACTS,
        Permissions.MANAGE_USERS,
        Permissions.MANAGE_FINANCE,
        Permissions.MODERATE_CONTENT,
        Permissions.MANAGE_BOARDS,
        Permissions.SEND_BULK_EMAIL,
        Permissions.VIEW_AUDIT_LOG,
        Permissions.MANAGE_ROLES,
        Permissions.MANAGE_VOTE,
      )
    : false;

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setUnreadNotificationCount(0);
      setNotificationOpen(false);
      return;
    }

    let cancelled = false;
    void apiClient
      .getNotifications({ page: 1, pageSize: 5 })
      .then((response) => {
        if (cancelled) return;
        setNotifications(response.items.filter((item) => !item.isRead));
        setUnreadNotificationCount(response.unreadCount);
      })
      .catch(() => {
        if (!cancelled) setNotifications([]);
      });

    return () => {
      cancelled = true;
    };
  }, [apiClient, user?.id]);

  const closePopovers = () => {
    setSearchOpen(false);
    setDropdownOpen(false);
    setNotificationOpen(false);
    setMobileMenuOpen(false);
    setHoveredIndex(null);
  };

  const handleSearchSubmit = (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    const query = searchQuery.trim();
    setSearchOpen(false);
    setDropdownOpen(false);
    navigate(query ? `/search?q=${encodeURIComponent(query)}` : "/search");
  };

  const handleStartLogin = async () => {
    if (typeof window === "undefined" || loginStarting) return;

    setLoginStarting(true);
    try {
      rememberAuthReturnPath(
        `${location.pathname}${location.search}${location.hash}`,
      );
      const payload = await apiClient.getLoginStartPayload();
      if (
        !payload.loginUrl ||
        !payload.clientId ||
        !payload.nonce ||
        !payload.redirectUri ||
        !payload.state
      ) {
        throw new Error("Incomplete SSO start payload");
      }

      const form = document.createElement("form");
      form.method = "POST";
      form.action = payload.loginUrl;
      form.style.display = "none";

      Object.entries({
        client_id: payload.clientId,
        nonce: payload.nonce,
        redirect_uri: payload.redirectUri,
        state: payload.state,
      }).forEach(([name, value]) => {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = name;
        input.value = value;
        form.appendChild(input);
      });

      document.body.appendChild(form);
      form.submit();
    } catch (error) {
      console.error(error);
      setLoginStarting(false);
    }
  };

  const handleMockLogin = async () => {
    if (!import.meta.env.DEV || mockLoginStarting) return;

    setMockLoginStarting(true);
    try {
      await apiClient.loginWithMockSession();
      clearStoredAuthState();
      await queryClient.invalidateQueries({ queryKey: ["auth", "session"] });
      window.location.assign("/");
    } catch (error) {
      console.error(error);
      setMockLoginStarting(false);
    }
  };

  const handleLogout = async () => {
    await apiClient.logout(getTemporaryAuthRequest());
    clearStoredAuthState();
    await queryClient.invalidateQueries({ queryKey: ["auth", "session"] });
    window.location.assign("/");
  };

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      const isInsideSearch = searchRef.current?.contains(target);
      const isInsideProfile = profileRef.current?.contains(target);
      const isInsideNotifications = notificationRef.current?.contains(target);

      if (!isInsideSearch) setSearchOpen(false);
      if (!isInsideProfile) setDropdownOpen(false);
      if (!isInsideNotifications) setNotificationOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setSearchOpen(false);
      setDropdownOpen(false);
      setNotificationOpen(false);
      setMobileMenuOpen(false);
      setHoveredIndex(null);
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const publicBoardItems = boardNavItems.filter(
    (board) => !isLegacyPublicBoardCode(board.code),
  );
  const navItems: HeaderNavItem[] =
    lang === "ko"
      ? [
          {
            label: "게시판",
            href: "/board",
            megaItems: publicBoardItems.map((board) => ({
              href: `/board/${encodeURIComponent(board.code)}`,
              label: getBoardLabelFromMetadata(board, board.code, lang),
            })),
          },
          {
            label: "학부 생활",
            href: "/life/roadmap",
            activePaths: ["/life"],
            megaItems: [
              { label: "전산학부 로드맵", href: "/life/roadmap" },
              {
                label: "학번톡 참여 신청",
                href: operationalSurveyPath(OPERATIONAL_SURVEY_IDS.cohortChatInvitation),
              },
            ],
          },
          {
            label: "행사·일정",
            href: "/events",
            activePaths: ["/events", "/calendar"],
            megaItems: [
              { label: "행사", href: "/events" },
              { label: "일정", href: "/calendar" },
            ],
          },
          {
            label: "설문·투표",
            href: "/surveys",
            activePaths: ["/surveys", "/survey", "/votes", "/vote"],
            megaItems: [
              { label: "설문", href: "/surveys" },
              { label: "투표", href: "/votes" },
            ],
          },
          {
            label: "학생회 소개",
            href: "/about",
            activePaths: ["/about"],
            megaItems: [
              { label: "소개", href: "/about#intro" },
              { label: "주요 사업", href: "/about#work" },
              { label: "조직도", href: "/about#people" },
              { label: "후원 및 제휴", href: "/about#partnership" },
            ],
          },
        ]
      : [
          {
            label: "Board",
            href: "/board",
            megaItems: publicBoardItems.map((board) => ({
              href: `/board/${encodeURIComponent(board.code)}`,
              label: getBoardLabelFromMetadata(board, board.code, lang),
            })),
          },
          {
            label: "Campus Life",
            href: "/life/roadmap",
            activePaths: ["/life"],
            megaItems: [
              { label: "SoC Roadmap", href: "/life/roadmap" },
              {
                label: "Join Cohort Chat",
                href: operationalSurveyPath(OPERATIONAL_SURVEY_IDS.cohortChatInvitation),
              },
            ],
          },
          {
            label: "Events",
            href: "/events",
            activePaths: ["/events", "/calendar"],
            megaItems: [
              { label: "Events", href: "/events" },
              { label: "Calendar", href: "/calendar" },
            ],
          },
          {
            label: "Surveys",
            href: "/surveys",
            activePaths: ["/surveys", "/survey", "/votes", "/vote"],
            megaItems: [
              { label: "Surveys", href: "/surveys" },
              { label: "Voting", href: "/votes" },
            ],
          },
          {
            label: "About",
            href: "/about",
            activePaths: ["/about"],
            megaItems: [
              { label: "About", href: "/about#intro" },
              { label: "Programs", href: "/about#work" },
              { label: "Organization chart", href: "/about#people" },
              { label: "Partnerships", href: "/about#partnership" },
            ],
          },
        ];

  const isPathActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(`${path}/`);

  const isNavItemActive = (item: HeaderNavItem) => {
    if (item.href === "/board") {
      return location.pathname === "/board" || location.pathname.startsWith("/board/");
    }

    return (item.activePaths ?? [item.href]).some(isPathActive);
  };

  const isChildNavItemActive = (href: string) => {
    const [pathname, hash] = href.split("#");
    const pathnameMatches =
      location.pathname === pathname || location.pathname.startsWith(`${pathname}/`);

    if (!pathnameMatches) return false;
    if (!hash) return true;

    return location.hash === `#${hash}` || (hash === "intro" && !location.hash);
  };

  const activeNavIndex = navItems.findIndex(isNavItemActive);
  const indicatorIndex = hoveredIndex ?? activeNavIndex;
  const indicatorOffset = Array.from(
    { length: Math.max(0, indicatorIndex) },
    () => "var(--ui-nav-column-width)",
  ).join(" + ");
  const indicatorLeft = indicatorOffset
    ? `calc(2rem + ${indicatorOffset})`
    : "2rem";

  return (
    <header
      className={
        variant === "home"
          ? "site-header-home sticky top-0 z-50 w-full"
          : "sticky top-0 z-50 shrink-0 border-b border-[var(--ui-menu-divider)] bg-white"
      }
      onMouseLeave={() => setHoveredIndex(null)}
    >
      <div className="flex h-[var(--ui-header-height)] w-full items-stretch justify-between">
        <div className="flex items-stretch">
          <div className="site-header-brand flex w-[var(--ui-brand-rail-width)] shrink-0 items-center px-6">
            <Logo inverse={variant === "home"} />
          </div>

          <nav
            className="site-primary-nav hidden items-stretch xl:flex"
            aria-label={lang === "ko" ? "주요 메뉴" : "Primary navigation"}
            onMouseMove={(event) => {
              const item = (event.target as HTMLElement).closest<HTMLElement>("[data-nav-index]");
              if (!item) return;
              const index = Number(item.dataset.navIndex);
              if (Number.isInteger(index)) setHoveredIndex(index);
            }}
            onMouseLeave={() => setHoveredIndex(null)}
          >
            {navItems.map((item, index) => {
              const active = isNavItemActive(item);
              return (
                <div
                  key={item.label}
                  data-nav-index={index}
                  className="group relative flex h-full items-stretch"
                  onMouseEnter={() => setHoveredIndex(index)}
                  onFocus={() => setHoveredIndex(index)}
                  onBlur={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                      setHoveredIndex(null);
                    }
                  }}
                >
                  <Link
                    to={item.href}
                    aria-current={active ? "page" : undefined}
                    aria-expanded={hoveredIndex === index}
                    aria-haspopup="menu"
                    aria-controls={`site-nav-flyout-${index}`}
                    className={`interaction-link relative flex h-full w-[var(--ui-nav-column-width)] items-center justify-center whitespace-nowrap px-4 text-[length:var(--ui-text-section-size)] font-semibold transition-colors ${
                      variant === "home"
                        ? "home-header-nav-link"
                        : active || hoveredIndex === index
                          ? "text-kaist-darkgreen-main"
                          : "text-slate-900 hover:text-kaist-darkgreen-main"
                    }`}
                  >
                    <span className="py-2">{item.label}</span>
                    <ChevronDown
                      aria-hidden="true"
                      className={`ml-1 h-3.5 w-3.5 transition-transform duration-200 ease-out ${
                        variant === "home" ? "text-white/60" : "text-slate-400"
                      } ${
                        hoveredIndex === index
                          ? variant === "home"
                            ? "rotate-180 text-white"
                            : "rotate-180 text-kaist-darkgreen-main"
                          : ""
                      }`}
                    />
                  </Link>

                  <div
                    id={`site-nav-flyout-${index}`}
                    role="menu"
                    aria-label={`${item.label} ${lang === "ko" ? "하위 메뉴" : "submenu"}`}
                    className={`absolute left-0 top-full z-50 w-full origin-top overflow-hidden rounded-b border-x border-b border-t transition-[opacity,transform,visibility] duration-200 ease-out ${
                      variant === "home"
                        ? "border-white/15 bg-[rgba(8,29,23,0.84)] shadow-[0_18px_36px_-22px_rgba(0,0,0,0.72)] backdrop-blur-xl backdrop-saturate-150"
                        : "border-[var(--ui-menu-divider)] bg-white shadow-[0_10px_18px_-20px_rgba(15,23,42,0.38)]"
                    } ${
                      hoveredIndex === index
                        ? "visible pointer-events-auto translate-y-0 opacity-100"
                        : "invisible pointer-events-none -translate-y-1 opacity-0"
                    }`}
                    onMouseEnter={() => setHoveredIndex(index)}
                  >
                    <ul>
                      {item.megaItems.map((child) => {
                        const childActive = isChildNavItemActive(child.href);

                        return (
                          <li
                            key={child.href}
                            className={`mx-4 border-b last:border-b-0 ${
                              variant === "home" ? "border-white/10" : "border-slate-100"
                            }`}
                          >
                            <Link
                              to={child.href}
                              role="menuitem"
                              aria-current={childActive ? "page" : undefined}
                              tabIndex={hoveredIndex === index ? 0 : -1}
                              onClick={closePopovers}
                              className={`flex h-11 items-center justify-center whitespace-nowrap px-1 text-center text-sm font-medium leading-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset ${
                                variant === "home"
                                  ? childActive
                                    ? "text-white focus-visible:ring-white/30"
                                    : "text-white/78 hover:text-white focus-visible:text-white focus-visible:ring-white/30"
                                  : childActive
                                    ? "text-brand-primary focus-visible:ring-brand-primary/20"
                                    : "text-[var(--ui-menu-item-text)] hover:text-brand-primary focus-visible:text-brand-primary focus-visible:ring-brand-primary/20"
                              }`}
                            >
                              {child.label}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </div>
              );
            })}
            <span
              aria-hidden="true"
              className={`site-nav-indicator ${indicatorIndex >= 0 ? "opacity-100" : "opacity-0"}`}
              style={{
                left: indicatorLeft,
              }}
            />
          </nav>
        </div>

        <div className="home-header-utilities relative flex items-center gap-1.5 pr-3 md:gap-2 md:pr-6">
          <div ref={searchRef} className="relative">
            <IconButton
              aria-label={lang === "ko" ? "통합검색" : "Search"}
              aria-expanded={searchOpen}
              onClick={() => {
                setSearchOpen((value) => !value);
                setDropdownOpen(false);
                setNotificationOpen(false);
                setMobileMenuOpen(false);
              }}
              className={variant === "home" ? "home-header-icon" : undefined}
            >
              <Search aria-hidden="true" />
            </IconButton>

            {searchOpen && (
              <PopoverPanel className="right-0 top-full w-[min(22rem,calc(100vw-2rem))]">
                <form className="p-3.5" onSubmit={handleSearchSubmit}>
                  <TextInput
                      leading={<Search aria-hidden="true" className="h-4 w-4" />}
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          handleSearchSubmit();
                        }
                      }}
                      placeholder={
                        lang === "ko"
                          ? "제목, 내용 검색"
                          : "Search titles and content"
                      }
                      autoFocus
                      trailing={
                        searchQuery ? (
                          <IconButton
                            size="sm"
                            aria-label={lang === "ko" ? "검색어 지우기" : "Clear search"}
                            onClick={() => setSearchQuery("")}
                          >
                            <X aria-hidden="true" />
                          </IconButton>
                        ) : null
                      }
                    />
                </form>
              </PopoverPanel>
            )}
          </div>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setLanguage(lang === "ko" ? "en" : "ko")}
            className={`hidden h-9 gap-1.5 border-0 bg-transparent px-2.5 text-xs font-medium shadow-none md:flex ${
              variant === "home"
                ? "text-white hover:bg-white/10 [&_svg]:text-white/70"
                : "text-slate-700 hover:bg-slate-100 [&_svg]:text-slate-500"
            }`}
            title={lang === "ko" ? "Switch to English" : "한국어로 변경"}
          >
            <Globe aria-hidden="true" />
            <span>{lang === "ko" ? "KO" : "EN"}</span>
          </Button>

          {user && (
            <div ref={notificationRef} className="relative">
              <IconButton
                aria-label={lang === "ko" ? "알림" : "Notifications"}
                aria-expanded={notificationOpen}
                onClick={() => {
                  setNotificationOpen((value) => !value);
                  setSearchOpen(false);
                  setDropdownOpen(false);
                }}
                className={`relative ${variant === "home" ? "home-header-icon" : ""}`}
              >
                <Bell aria-hidden="true" />
                {unreadNotificationCount > 0 && (
                  <Badge className="absolute -right-1 -top-1 h-4 min-w-4 justify-center rounded-full border-white bg-rose-600 px-1 text-[length:var(--home-calendar-detail-size)] text-white">
                    {unreadNotificationCount > 9 ? "9+" : unreadNotificationCount}
                  </Badge>
                )}
              </IconButton>

              {notificationOpen && (
                <PopoverPanel className="right-0 top-full w-[min(25rem,calc(100vw-2rem))]">
                  <div className="flex h-14 items-center justify-between border-b border-slate-100 px-4">
                    <p className="text-base font-bold text-slate-900">
                      {lang === "ko" ? "알림" : "Notifications"}
                    </p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={unreadNotificationCount === 0}
                      className="h-8 rounded-md border-0 bg-transparent px-2 text-xs font-medium text-slate-400 shadow-none hover:bg-slate-100 hover:text-slate-600 disabled:pointer-events-none disabled:opacity-60"
                      onClick={() => {
                        void apiClient.markAllNotificationsRead().then(() => {
                          setUnreadNotificationCount(0);
                          setNotifications([]);
                        });
                      }}
                    >
                      {lang === "ko" ? "모두 읽음으로 표시" : "Mark all as read"}
                    </Button>
                  </div>
                  {notifications.length === 0 ? (
                    <div className="flex min-h-36 flex-col items-center justify-center gap-3 px-4 py-8 text-center">
                      <Bell aria-hidden="true" className="size-5 text-slate-400" />
                      <p className="text-sm font-normal text-slate-400">
                        {lang === "ko" ? "새로운 알림이 없습니다." : "There are no new notifications."}
                      </p>
                    </div>
                  ) : (
                    <div className="scrollbar-hidden max-h-80 overflow-y-auto">
                      {notifications.map((notification) => (
                        <Button variant="ghost"
                          key={notification.notificationId}
                          type="button"
                          className={`flex min-h-14 w-full flex-col items-start gap-0.5 whitespace-normal rounded-none border-0 border-b border-slate-100 px-3.5 py-2.5 text-left transition-colors last:border-b-0 hover:bg-slate-50 ${notification.isRead ? "bg-white" : "bg-emerald-50/45"}`}
                          onClick={() => {
                            void apiClient
                              .markNotificationRead(notification.notificationId)
                              .then(() => {
                                setNotifications((items) =>
                                  items.filter(
                                    (item) => item.notificationId !== notification.notificationId,
                                  ),
                                );
                                setUnreadNotificationCount((count) => Math.max(0, count - (notification.isRead ? 0 : 1)));
                                setNotificationOpen(false);
                                if (notification.link) navigate(notification.link);
                              });
                          }}
                        >
                          <span className="text-[length:var(--home-event-description-size)] font-medium text-slate-800">
                            {notification.titleKo}
                          </span>
                          {notification.bodyKo && (
                            <span className="line-clamp-2 text-[length:var(--home-calendar-event-size)] font-normal leading-4 text-slate-500">
                              {notification.bodyKo}
                            </span>
                          )}
                        </Button>
                      ))}
                    </div>
                  )}
                </PopoverPanel>
              )}
            </div>
          )}

          {user ? (
            <div ref={profileRef} className="relative">
              <IconButton
                aria-label={lang === "ko" ? `${user.name} 프로필` : `${user.name} profile`}
                title={user.name}
                aria-expanded={dropdownOpen}
                onClick={() => {
                  setDropdownOpen((value) => !value);
                  setSearchOpen(false);
                }}
                className={variant === "home" ? "home-header-icon" : undefined}
              >
                <User aria-hidden="true" />
              </IconButton>

              {dropdownOpen && (
                <PopoverPanel className="right-0 top-full w-52">
                  <div className="border-b border-slate-100 px-3.5 py-3">
                    <p className="min-w-0 truncate text-[length:var(--ui-text-body-sm-size)] font-medium text-slate-900">
                      {user.name}
                    </p>
                  </div>

                  <div className="py-1">
                    <Button asChild variant="ghost" className="h-10 w-full justify-start rounded-none px-3.5 text-[length:var(--ui-text-body-sm-size)] font-medium text-slate-700">
                      <Link to="/mypage" onClick={closePopovers}>
                        <User className="text-slate-500" />
                        <span>{lang === "ko" ? "마이페이지" : "My Page"}</span>
                      </Link>
                    </Button>

                    {canUseAdminDashboard ? (
                      <Button asChild variant="ghost" className="h-10 w-full justify-start rounded-none px-3.5 text-[length:var(--ui-text-body-sm-size)] font-medium text-slate-700">
                        <Link to="/admin" onClick={closePopovers}>
                          <LayoutDashboard className="text-slate-500" />
                          <span>
                            {lang === "ko"
                              ? "관리자 대시보드"
                              : "Admin Dashboard"}
                          </span>
                        </Link>
                      </Button>
                    ) : null}

                    <Button
                      type="button"
                      variant="ghost"
                      className="h-10 w-full justify-start rounded-none px-3.5 text-[length:var(--ui-text-body-sm-size)] font-medium text-red-600 hover:bg-red-50 hover:text-red-700"
                      onClick={async () => {
                        await handleLogout();
                      }}
                    >
                      <LogOut />
                      <span>{lang === "ko" ? "로그아웃" : "Logout"}</span>
                    </Button>
                  </div>
                </PopoverPanel>
              )}
            </div>
          ) : (
            <>
              <Button variant="ghost"
                type="button"
                onClick={() => void handleStartLogin()}
                disabled={loginStarting}
                className={`hidden cursor-pointer items-center whitespace-nowrap rounded-md border-0 bg-transparent px-2.5 py-1.5 text-sm font-semibold tracking-tight transition-none disabled:cursor-wait disabled:opacity-70 md:flex lg:text-base ${
                  variant === "home"
                    ? "text-white hover:bg-white/10 hover:text-white"
                    : "text-kaist-black hover:bg-slate-100 hover:text-kaist-darkgreen-main"
                }`}
              >
                {loginStarting
                  ? lang === "ko"
                    ? "로그인 중"
                    : "Signing in"
                  : lang === "ko"
                    ? "로그인"
                    : "Login"}
              </Button>
              {import.meta.env.DEV ? (
                <Button variant="ghost"
                  type="button"
                  onClick={() => void handleMockLogin()}
                  disabled={mockLoginStarting}
                  className="hidden rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-700 transition-colors hover:border-emerald-300 hover:bg-emerald-100 disabled:cursor-wait disabled:opacity-70 lg:inline-flex"
                >
                  {mockLoginStarting
                    ? "Mock..."
                    : lang === "ko"
                      ? "Mock 로그인"
                      : "Mock Login"}
                </Button>
              ) : null}
            </>
          )}

          <IconButton
            aria-controls="mobile-primary-navigation"
            aria-expanded={mobileMenuOpen}
            aria-label={
              mobileMenuOpen
                ? lang === "ko"
                  ? "메뉴 닫기"
                  : "Close menu"
                : lang === "ko"
                  ? "메뉴 열기"
                  : "Open menu"
            }
            onClick={() => {
              setMobileMenuOpen((value) => !value);
              setSearchOpen(false);
              setDropdownOpen(false);
            }}
            className={variant === "home" ? "home-header-icon xl:hidden" : "text-slate-700 xl:hidden"}
          >
            {mobileMenuOpen ? (
              <X aria-hidden="true" className="h-5 w-5" />
            ) : (
              <Menu aria-hidden="true" className="h-5 w-5" />
            )}
          </IconButton>
        </div>
      </div>

      {mobileMenuOpen && (
        <div
          id="mobile-primary-navigation"
          className="absolute left-0 right-0 top-full z-50 border-t border-slate-100 bg-white px-4 pb-5 pt-4 shadow-xl xl:hidden"
        >
          <nav aria-label={lang === "ko" ? "모바일 주요 메뉴" : "Mobile primary navigation"}>
            <div className="grid grid-cols-3 gap-2">
              {navItems.map((item) => {
                const active = isNavItemActive(item);
                return (
                  <div
                    key={item.href}
                    className="col-span-3"
                  >
                    <Link
                      to={item.href}
                      onClick={closePopovers}
                      aria-current={active ? "page" : undefined}
                      className={`flex min-h-11 items-center justify-center rounded-xl border px-2 text-center text-xs font-medium transition-colors ${
                        active
                          ? "border-kaist-darkgreen/30 bg-kaist-lightgreen/15 text-kaist-darkgreen"
                          : "border-slate-200 bg-slate-50 text-slate-800 hover:border-kaist-darkgreen/20 hover:bg-kaist-lightgreen/10 hover:text-kaist-darkgreen"
                      }`}
                    >
                      {item.label}
                    </Link>
                    {item.megaItems.length > 0 ? (
                      <div className="mt-2 grid grid-cols-3 gap-2">
                        {item.megaItems.map((child) => (
                          <Link
                            key={child.href}
                            to={child.href}
                            onClick={closePopovers}
                            className="flex min-h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-2 text-center text-[length:var(--ui-text-caption-size)] font-medium text-slate-600 hover:bg-slate-50 hover:text-brand-primary"
                          >
                            {child.label}
                          </Link>
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </nav>

          <div className="mt-4 grid gap-3 border-t border-slate-100 pt-4">
            <Button variant="ghost"
              type="button"
              onClick={() => setLanguage(lang === "ko" ? "en" : "ko")}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 text-xs font-medium text-slate-700"
            >
              <Globe aria-hidden="true" className="h-4 w-4 text-kaist-greygreen" />
              {lang === "ko" ? "English" : "한국어"}
            </Button>

            {user ? (
              <div
                className={`grid items-center gap-2 ${
                  canUseAdminDashboard
                    ? "grid-cols-[minmax(0,1fr)_minmax(0,1fr)_2.75rem]"
                    : "grid-cols-[minmax(0,1fr)_2.75rem]"
                }`}
              >
                <Link
                  to="/mypage"
                  onClick={closePopovers}
                  className="inline-flex min-h-11 min-w-0 items-center justify-center rounded-xl border border-slate-200 px-2 text-center text-xs font-medium text-slate-700"
                >
                  {lang === "ko" ? "마이페이지" : "My Page"}
                </Link>
                {canUseAdminDashboard && (
                  <Link
                    to="/admin"
                    onClick={closePopovers}
                    className="inline-flex min-h-11 min-w-0 items-center justify-center rounded-xl bg-kaist-darkgreen px-2 text-center text-xs font-medium text-white"
                  >
                    {lang === "ko" ? "관리자" : "Admin"}
                  </Link>
                )}
                <Button variant="ghost"
                  type="button"
                  onClick={() => void handleLogout()}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-red-200 text-red-600"
                  aria-label={lang === "ko" ? "로그아웃" : "Logout"}
                >
                  <LogOut aria-hidden="true" className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-2 items-center gap-2">
                <Button variant="ghost"
                  type="button"
                  onClick={() => void handleStartLogin()}
                  disabled={loginStarting}
                  className="inline-flex min-h-11 items-center justify-center rounded-xl bg-kaist-darkgreen px-4 text-xs font-medium text-white disabled:opacity-60"
                >
                  {loginStarting
                    ? lang === "ko"
                      ? "로그인 중"
                      : "Signing in"
                    : lang === "ko"
                      ? "로그인"
                      : "Login"}
                </Button>
                {import.meta.env.DEV && (
                  <Button variant="ghost"
                    type="button"
                    onClick={() => void handleMockLogin()}
                    disabled={mockLoginStarting}
                    className="inline-flex min-h-11 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 px-3 text-[length:var(--ui-text-caption-size)] font-medium text-emerald-700 disabled:opacity-60"
                  >
                    {mockLoginStarting ? "Mock..." : "Mock"}
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

    </header>
  );
}
