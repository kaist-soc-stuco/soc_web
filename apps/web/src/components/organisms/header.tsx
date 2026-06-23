import { createApiClient } from "@soc/api-client";
import { useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  ChevronDown,
  Globe,
  LayoutDashboard,
  LogOut,
  Search,
  User,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";

import { Logo } from "@/components/atoms/logo";
import { useCurrentSession } from "@/hooks/use-current-session";
import { useBoardCatalog } from "@/hooks/use-board-catalog";
import { useLanguage } from "@/hooks/use-language";
import { resolveApiBaseUrl } from "@/lib/api-base-url";
import { clearStoredAuthState } from "@/lib/auth-storage";
import { getTemporaryAuthRequest } from "@/lib/auth-session";
import { getBoardLabelFromMetadata } from "@/lib/board-metadata";
import { Permissions } from "@/lib/permissions";

interface HeaderProps {
  showLogo?: boolean;
}

export function Header({ showLogo = false }: HeaderProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const navRef = useRef<HTMLElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const [navLeft, setNavLeft] = useState(0);
  const { data: session } = useCurrentSession();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
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
          name: session.nameEn ?? session.userName ?? session.nameKo ?? "User",
          permission: session.permission ?? 0,
        }
      : null;
  const canUseAdminDashboard = user
    ? Permissions.hasAny(
        user.permission,
        Permissions.MANAGE_SURVEY,
        Permissions.MANAGE_CONTENT,
        Permissions.MANAGE_FINANCE,
        Permissions.ADMIN,
      )
    : false;

  const closePopovers = () => {
    setSearchOpen(false);
    setDropdownOpen(false);
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

  const updateNavLeft = () => {
    if (navRef.current) setNavLeft(navRef.current.offsetLeft);
  };

  useEffect(() => {
    updateNavLeft();
    window.addEventListener("resize", updateNavLeft);
    return () => window.removeEventListener("resize", updateNavLeft);
  }, [showLogo]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      const isInsideSearch = searchRef.current?.contains(target);
      const isInsideProfile = profileRef.current?.contains(target);

      if (!isInsideSearch) setSearchOpen(false);
      if (!isInsideProfile) setDropdownOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  const navItems =
    lang === "ko"
      ? [
          {
            label: "게시판",
            href: "/board",
            dropdown: boardNavItems.map((board) => board.code),
            dropdownLabels: boardNavItems.map((board) =>
              getBoardLabelFromMetadata(board, board.code, lang),
            ),
            isBoard: true,
            hasDropdown: true,
          },
          {
            label: "행사 / 설문",
            href: "/events-surveys",
            dropdown: ["행사", "설문 · 투표", "일정"],
            dropdownLabels: ["행사", "설문 · 투표", "일정"],
            hasDropdown: true,
          },
          {
            label: "소개",
            href: "/about",
            dropdown: ["집행위원회 소개", "연혁", "조직도", "구성원"],
            dropdownLabels: ["소개", "연혁", "조직도", "구성원"],
            hasDropdown: true,
          },
        ]
      : [
          {
            label: "Board",
            href: "/board/공지",
            dropdown: boardNavItems.map((board) => board.code),
            dropdownLabels: boardNavItems.map((board) =>
              getBoardLabelFromMetadata(board, board.code, lang),
            ),
            isBoard: true,
            hasDropdown: true,
          },
          {
            label: "Events / Surveys",
            href: "/events-surveys",
            dropdown: ["행사", "설문 · 투표", "일정"],
            dropdownLabels: ["Events", "Surveys & Votes", "Calendar"],
            hasDropdown: true,
          },
          {
            label: "About",
            href: "/about",
            dropdown: ["소개", "연혁", "조직도", "구성원"],
            dropdownLabels: ["Overview", "History", "Org Chart", "Members"],
            hasDropdown: true,
          },
        ];

  return (
    <header
      className="shrink-0 z-50 bg-white border-b border-slate-100 shadow-[0_2px_15px_rgba(0,0,0,0.03)] relative"
      onMouseLeave={() => setHoveredIndex(null)}
    >
      <div className="flex h-14 w-full items-stretch justify-between">
        <div className="flex items-stretch">
          {showLogo && (
            <div className="flex items-center pl-4">
              <Logo />
            </div>
          )}

          {!showLogo && <div className="w-12 shrink-0" />}

          <nav ref={navRef} className="hidden md:flex items-stretch">
            {navItems.map((item, index) => (
              <div
                key={item.label}
                className="relative group"
                onMouseEnter={() => setHoveredIndex(index)}
              >
                <Link
                  to={item.href}
                  className="relative flex h-full w-36 items-center justify-center text-[14px] font-semibold text-slate-900 transition-colors hover:text-kaist-darkgreen-main lg:w-40"
                >
                  <span className="py-2">{item.label}</span>
                  {item.hasDropdown && (
                    <ChevronDown className="ml-1 h-3.5 w-3.5 text-slate-400 transition-transform group-hover:translate-y-0.5" />
                  )}
                  <span
                    className={`absolute bottom-0 left-5 right-5 h-0.5 rounded-t-full bg-kaist-darkgreen-main transition-transform duration-200 origin-center ${
                      hoveredIndex === index ? "scale-x-100" : "scale-x-0"
                    }`}
                  />
                </Link>
              </div>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-1.5 pr-3 md:gap-4 md:pr-6 relative">
          <div ref={searchRef} className="relative">
            <button
              type="button"
              aria-label={lang === "ko" ? "통합검색" : "Search"}
              aria-expanded={searchOpen}
              className="text-kaist-black hover:text-kaist-darkgreen transition-colors p-1.5 rounded-lg hover:bg-gray-50 md:p-2"
              onClick={() => {
                setSearchOpen((value) => !value);
                setDropdownOpen(false);
              }}
            >
              <Search className="h-4 w-4 md:h-5 md:w-5" />
            </button>

            {searchOpen && (
              <div className="absolute right-0 top-full mt-2 w-[min(22rem,calc(100vw-2rem))] animate-in fade-in slide-in-from-top-1 duration-200 rounded-lg border border-kaist-grey/25 bg-white shadow-xl z-50 overflow-hidden">
                <form className="p-3" onSubmit={handleSearchSubmit}>
                  <div className="flex items-center gap-2 rounded-md border border-kaist-grey/25 px-3 py-2 focus-within:border-kaist-darkgreen-main">
                    <Search className="w-4 h-4 text-kaist-greygreen shrink-0" />
                    <input
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      className="w-full min-w-0 bg-transparent text-sm font-semibold text-kaist-black outline-none placeholder:text-kaist-grey"
                      placeholder={
                        lang === "ko"
                          ? "검색어를 입력하세요.."
                          : "Enter search keyword..."
                      }
                      autoFocus
                    />
                    <button
                      type="submit"
                      className="shrink-0 rounded-md bg-kaist-darkgreen-main px-2.5 py-1 text-[11px] font-extrabold text-white transition-colors hover:bg-kaist-darkgreen"
                    >
                      {lang === "ko" ? "검색" : "Search"}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>

          <button
            type="button"
            aria-label={lang === "ko" ? "알림" : "Notifications"}
            className="text-kaist-black transition-colors p-1.5 rounded-lg md:p-2"
            title={lang === "ko" ? "알림" : "Notifications"}
          >
            <Bell className="h-4 w-4 md:h-5 md:w-5" />
          </button>

          <button
            type="button"
            onClick={() => setLanguage(lang === "ko" ? "en" : "ko")}
            className="hidden min-[420px]:flex items-center gap-1 text-xs font-bold text-kaist-black hover:text-kaist-darkgreen transition-all bg-gray-100 hover:bg-gray-200/80 px-2.5 py-1.5 rounded-lg border border-kaist-grey/15 cursor-pointer shrink-0"
            title={lang === "ko" ? "Switch to English" : "한국어로 변경"}
          >
            <Globe className="w-3.5 h-3.5 text-kaist-greygreen" />
            <span>{lang === "ko" ? "KO" : "EN"}</span>
          </button>

          {user ? (
            <div ref={profileRef} className="relative">
              <button
                type="button"
                className="flex max-w-[11rem] items-center gap-2 rounded-lg border border-transparent px-2.5 py-1.5 font-bold text-kaist-black hover:border-kaist-grey/15 hover:bg-gray-50 cursor-pointer transition-colors"
                aria-expanded={dropdownOpen}
                onClick={() => {
                  setDropdownOpen((value) => !value);
                  setSearchOpen(false);
                }}
              >
                <User className="w-4 h-4 shrink-0 text-kaist-greygreen" />
                <span className="hidden sm:block truncate text-sm">
                  {user.name}
                </span>
                <ChevronDown className="w-3.5 h-3.5 shrink-0 text-kaist-greygreen" />
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 top-full mt-2 w-60 animate-in fade-in slide-in-from-top-1 duration-200 rounded-lg border border-kaist-grey/25 bg-white shadow-xl z-50 overflow-hidden">
                  <div className="px-4 py-3 border-b border-kaist-grey/20">
                    <p className="truncate text-sm font-extrabold text-kaist-black">
                      {user.name}
                    </p>
                    <p className="mt-1 text-[11px] font-bold text-kaist-greygreen">
                      {canUseAdminDashboard
                        ? lang === "ko"
                          ? "관리자"
                          : "Administrator"
                        : lang === "ko"
                          ? "회원"
                          : "Member"}
                    </p>
                  </div>

                  <div className="py-1">
                    <Link
                      to="/mypage"
                      onClick={closePopovers}
                      className="flex items-center gap-2 px-4 py-2.5 hover:bg-kaist-darkgreen/5 text-sm font-semibold text-kaist-black"
                    >
                      <User className="w-4 h-4 text-kaist-greygreen" />
                      <span>{lang === "ko" ? "마이페이지" : "My Page"}</span>
                    </Link>

                    {canUseAdminDashboard ? (
                      <Link
                        to="/admin"
                        onClick={closePopovers}
                        className="flex items-center gap-2 px-4 py-2.5 hover:bg-kaist-darkgreen/5 text-sm font-semibold text-kaist-black"
                      >
                        <LayoutDashboard className="w-4 h-4 text-kaist-greygreen" />
                        <span>
                          {lang === "ko"
                            ? "관리자 대시보드"
                            : "Admin Dashboard"}
                        </span>
                      </Link>
                    ) : null}

                    <button
                      type="button"
                      className="flex w-full items-center gap-2 px-4 py-2.5 hover:bg-red-50 text-left text-sm font-semibold text-red-600"
                      onClick={async () => {
                        await apiClient.logout(getTemporaryAuthRequest());
                        clearStoredAuthState();
                        await queryClient.invalidateQueries({
                          queryKey: ["auth", "session"],
                        });
                        window.location.assign("/");
                      }}
                    >
                      <LogOut className="w-4 h-4" />
                      <span>{lang === "ko" ? "로그아웃" : "Logout"}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={() => void handleStartLogin()}
                disabled={loginStarting}
                className="group relative hidden cursor-pointer items-center whitespace-nowrap border-0 bg-transparent text-sm font-bold tracking-tight text-kaist-black transition-colors hover:text-kaist-darkgreen-main disabled:cursor-wait disabled:opacity-70 sm:flex lg:text-base"
              >
                <span className="py-2">
                  {loginStarting
                    ? lang === "ko"
                      ? "로그인 중"
                      : "Signing in"
                    : lang === "ko"
                      ? "로그인"
                      : "Login"}
                </span>
                <span className="absolute bottom-0 left-0 right-0 h-1 scale-x-0 bg-kaist-darkgreen-main transition-transform duration-200 origin-center group-hover:scale-x-100" />
              </button>
              {import.meta.env.DEV ? (
                <button
                  type="button"
                  onClick={() => void handleMockLogin()}
                  disabled={mockLoginStarting}
                  className="hidden rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-extrabold text-emerald-700 transition-colors hover:border-emerald-300 hover:bg-emerald-100 disabled:cursor-wait disabled:opacity-70 lg:inline-flex"
                >
                  {mockLoginStarting
                    ? "Mock..."
                    : lang === "ko"
                      ? "Mock 로그인"
                      : "Mock Login"}
                </button>
              ) : null}
            </>
          )}
        </div>
      </div>

      <div
        className={`absolute left-0 w-full bg-white shadow-[0_15px_30px_rgba(0,0,0,0.06)] border-t border-slate-50 overflow-hidden transition-all duration-300 ease-out ${
          hoveredIndex !== null
            ? "max-h-96 opacity-100 translate-y-0"
            : "max-h-0 opacity-0 -translate-y-4"
        }`}
        style={{ top: "calc(100% + 1px)", zIndex: 40 }}
      >
        <div className="flex gap-0" style={{ paddingLeft: navLeft }}>
          {navItems.map((item, index) => {
            if (!item.hasDropdown) {
              return (
                <div
                  key={item.label}
                  className="w-36 px-3 opacity-0 pointer-events-none lg:w-40"
                />
              );
            }

            return (
              <div
                key={item.label}
                className={`w-36 px-3 lg:w-40 ${
                  index === 0 ? "border-l border-kaist-grey/30" : ""
                } border-r border-kaist-grey/30`}
              >
                <ul className="space-y-1">
                  {item.dropdown.map((subItem, subIndex) => (
                    <li
                      key={subItem}
                      className={`mx-2 transition-all duration-200 pb-1 ${
                        hoveredIndex !== null
                          ? "opacity-100 translate-x-0"
                          : "opacity-0 -translate-x-2"
                      } ${
                        subIndex < item.dropdown.length - 1
                          ? "border-b border-kaist-grey/30"
                          : "pb-10"
                      } ${subIndex === 0 ? "pt-1" : ""}`}
                      style={{
                        transitionDelay:
                          hoveredIndex !== null
                            ? `${index * 80 + subIndex * 40 + 80}ms`
                            : "0ms",
                      }}
                    >
                      <Link
                        to={
                          item.isBoard
                            ? `/board/${subItem}`
                            : item.label === "행사 / 설문" ||
                                item.label === "Events / Surveys"
                              ? [
                                  "/events-surveys?tab=event",
                                  "/events-surveys?tab=survey",
                                  "/events-surveys?tab=calendar",
                                ][subIndex]
                              : item.label === "소개" || item.label === "About"
                                ? `/about?tab=${["intro", "history", "org", "members"][subIndex]}`
                                : `${item.href}/${subItem}`
                        }
                        className={`block py-2 text-center text-sm font-semibold tracking-tight transition-all ${
                          hoveredIndex === index
                            ? "text-kaist-black hover:text-kaist-darkgreen-main hover:translate-x-1"
                            : "text-kaist-grey"
                        }`}
                      >
                        {item.dropdownLabels
                          ? item.dropdownLabels[subIndex]
                          : subItem}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    </header>
  );
}
