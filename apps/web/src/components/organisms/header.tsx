import type { ArticleListItem, BoardSummary } from "@soc/contracts";
import { createApiClient } from "@soc/api-client";
import { isoToDate } from "@soc/shared";
import { useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  ChevronDown,
  Clock,
  FileText,
  Globe,
  LayoutDashboard,
  Loader2,
  LogOut,
  Search,
  User,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";

import { Logo } from "@/components/atoms/logo";
import { useCurrentSession } from "@/hooks/use-current-session";
import { useLanguage } from "@/hooks/use-language";
import { resolveApiBaseUrl } from "@/lib/api-base-url";
import { clearStoredAuthState } from "@/lib/auth-storage";
import { getTemporaryAuthRequest } from "@/lib/auth-session";
import {
  getBoardLabelFromMetadata,
  getFallbackBoards,
} from "@/lib/board-metadata";
import { Permissions } from "@/lib/permissions";

interface HeaderProps {
  showLogo?: boolean;
}

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
  }).format(isoToDate(value));

export function Header({ showLogo = false }: HeaderProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const navRef = useRef<HTMLElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const notificationRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const [navLeft, setNavLeft] = useState(0);
  const { data: session } = useCurrentSession();
  const queryClient = useQueryClient();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ArticleListItem[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [loginStarting, setLoginStarting] = useState(false);
  const [mockLoginStarting, setMockLoginStarting] = useState(false);
  const [notificationItems, setNotificationItems] = useState<ArticleListItem[]>(
    [],
  );
  const [notificationLoading, setNotificationLoading] = useState(false);
  const [boards, setBoards] = useState<BoardSummary[]>([]);
  const { lang, setLanguage } = useLanguage();

  const apiClient = useMemo(
    () => createApiClient({ baseUrl: resolveApiBaseUrl() }),
    [],
  );

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

  const boardById = useMemo(
    () => new Map(boards.map((board) => [board.boardId, board])),
    [boards],
  );
  const fallbackBoardNavItems = useMemo(() => getFallbackBoards(), []);
  const boardNavItems = boards.length > 0 ? boards : fallbackBoardNavItems;

  const getBoardCode = (article: ArticleListItem) =>
    boardById.get(article.boardId)?.code ?? "공지";

  const closePopovers = () => {
    setSearchOpen(false);
    setNotificationOpen(false);
    setDropdownOpen(false);
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
      const isInsideNotification = notificationRef.current?.contains(target);
      const isInsideProfile = profileRef.current?.contains(target);

      if (!isInsideSearch) setSearchOpen(false);
      if (!isInsideNotification) setNotificationOpen(false);
      if (!isInsideProfile) setDropdownOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  useEffect(() => {
    if (boards.length > 0) return;

    let cancelled = false;
    apiClient
      .getBoards()
      .then((response) => {
        if (!cancelled) setBoards(response.items);
      })
      .catch(() => {
        if (!cancelled) setBoards([]);
      });

    return () => {
      cancelled = true;
    };
  }, [apiClient, boards.length]);

  useEffect(() => {
    const trimmedQuery = searchQuery.trim();

    if (!searchOpen || trimmedQuery.length < 2) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      setSearchLoading(true);
      apiClient
        .searchArticles(trimmedQuery, 8)
        .then((items) => {
          if (!cancelled) setSearchResults(items);
        })
        .catch(() => {
          if (!cancelled) setSearchResults([]);
        })
        .finally(() => {
          if (!cancelled) setSearchLoading(false);
        });
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [apiClient, searchOpen, searchQuery]);

  useEffect(() => {
    if (!notificationOpen || notificationItems.length > 0) return;

    let cancelled = false;
    setNotificationLoading(true);
    apiClient
      .getArticles("공지", { limit: 5 })
      .then((response) => {
        if (!cancelled) setNotificationItems(response.items);
      })
      .catch(() => {
        if (!cancelled) setNotificationItems([]);
      })
      .finally(() => {
        if (!cancelled) setNotificationLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [apiClient, notificationItems.length, notificationOpen]);

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
                  className="relative flex items-center justify-center w-48 h-full text-sm lg:text-base font-bold tracking-tight text-kaist-black hover:text-kaist-darkgreen-main transition-colors"
                >
                  <span className="py-2">{item.label}</span>
                  {item.hasDropdown && (
                    <span className="ml-1 text-[10px] text-kaist-grey/85 select-none transition-transform group-hover:translate-y-0.5 font-bold">
                      ▼
                    </span>
                  )}
                  <span
                    className={`absolute bottom-0 left-0 right-0 h-1 bg-kaist-darkgreen-main transition-transform duration-200 origin-center ${
                      hoveredIndex === index ? "scale-x-100" : "scale-x-0"
                    }`}
                  />
                </Link>
              </div>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-2 md:gap-4 pr-6 relative">
          <div ref={searchRef} className="relative">
            <button
              type="button"
              aria-label={lang === "ko" ? "게시글 검색" : "Search articles"}
              aria-expanded={searchOpen}
              className="text-kaist-black hover:text-kaist-darkgreen transition-colors p-2 rounded-lg hover:bg-gray-50"
              onClick={() => {
                setSearchOpen((value) => !value);
                setNotificationOpen(false);
                setDropdownOpen(false);
              }}
            >
              <Search className="h-4 w-4 md:h-5 md:w-5" />
            </button>

            {searchOpen && (
              <div className="absolute right-0 top-full mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-lg border border-kaist-grey/25 bg-white shadow-xl z-50 overflow-hidden">
                <div className="p-3 border-b border-kaist-grey/20">
                  <div className="flex items-center gap-2 rounded-md border border-kaist-grey/25 px-3 py-2 focus-within:border-kaist-darkgreen-main">
                    <Search className="w-4 h-4 text-kaist-greygreen shrink-0" />
                    <input
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      className="w-full min-w-0 bg-transparent text-sm font-semibold text-kaist-black outline-none placeholder:text-kaist-grey"
                      placeholder={
                        lang === "ko" ? "게시글 검색" : "Search articles"
                      }
                    />
                    {searchLoading && (
                      <Loader2 className="w-4 h-4 animate-spin text-kaist-greygreen" />
                    )}
                  </div>
                </div>

                <div className="max-h-80 overflow-y-auto py-1">
                  {searchQuery.trim().length < 2 ? (
                    <p className="px-4 py-6 text-center text-xs font-semibold text-kaist-grey">
                      {lang === "ko"
                        ? "두 글자 이상 입력하세요."
                        : "Enter at least two characters."}
                    </p>
                  ) : searchResults.length === 0 && !searchLoading ? (
                    <p className="px-4 py-6 text-center text-xs font-semibold text-kaist-grey">
                      {lang === "ko"
                        ? "검색 결과가 없습니다."
                        : "No results found."}
                    </p>
                  ) : (
                    searchResults.map((article) => {
                      const board = boardById.get(article.boardId);
                      const boardCode = getBoardCode(article);

                      return (
                        <Link
                          key={article.articleId}
                          to={`/board/${boardCode}/${article.articleId}`}
                          onClick={closePopovers}
                          className="block px-4 py-3 hover:bg-kaist-darkgreen/5 transition-colors"
                        >
                          <div className="flex items-start gap-3">
                            <FileText className="w-4 h-4 mt-0.5 shrink-0 text-kaist-greygreen" />
                            <div className="min-w-0">
                              <p className="truncate text-sm font-bold text-kaist-black">
                                {lang === "ko"
                                  ? article.titleKo
                                  : (article.titleEn ?? article.titleKo)}
                              </p>
                              <p className="mt-1 flex items-center gap-2 text-[11px] font-semibold text-kaist-grey">
                                <span>
                                  {lang === "ko"
                                    ? (board?.nameKo ?? boardCode)
                                    : (board?.nameEn ??
                                      board?.nameKo ??
                                      boardCode)}
                                </span>
                                <span>·</span>
                                <span>{formatDate(article.postedAt)}</span>
                              </p>
                            </div>
                          </div>
                        </Link>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          <div ref={notificationRef} className="relative">
            <button
              type="button"
              aria-label={lang === "ko" ? "최근 공지" : "Recent notices"}
              aria-expanded={notificationOpen}
              className="text-kaist-black hover:text-kaist-darkgreen transition-colors p-2 rounded-lg hover:bg-gray-50"
              onClick={() => {
                setNotificationOpen((value) => !value);
                setSearchOpen(false);
                setDropdownOpen(false);
              }}
            >
              <Bell className="h-4 w-4 md:h-5 md:w-5" />
            </button>

            {notificationOpen && (
              <div className="absolute right-0 top-full mt-2 w-[min(21rem,calc(100vw-2rem))] rounded-lg border border-kaist-grey/25 bg-white shadow-xl z-50 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-kaist-grey/20">
                  <span className="text-sm font-bold text-kaist-black">
                    {lang === "ko" ? "최근 공지" : "Recent Notices"}
                  </span>
                  {notificationLoading && (
                    <Loader2 className="w-4 h-4 animate-spin text-kaist-greygreen" />
                  )}
                </div>

                <div className="max-h-80 overflow-y-auto py-1">
                  {notificationItems.length === 0 && !notificationLoading ? (
                    <p className="px-4 py-6 text-center text-xs font-semibold text-kaist-grey">
                      {lang === "ko"
                        ? "표시할 공지가 없습니다."
                        : "No notices to show."}
                    </p>
                  ) : (
                    notificationItems.map((article) => (
                      <Link
                        key={article.articleId}
                        to={`/board/공지/${article.articleId}`}
                        onClick={closePopovers}
                        className="block px-4 py-3 hover:bg-kaist-darkgreen/5 transition-colors"
                      >
                        <p className="truncate text-sm font-bold text-kaist-black">
                          {lang === "ko"
                            ? article.titleKo
                            : (article.titleEn ?? article.titleKo)}
                        </p>
                        <p className="mt-1 flex items-center gap-1.5 text-[11px] font-semibold text-kaist-grey">
                          <Clock className="w-3 h-3" />
                          <span>{formatDate(article.postedAt)}</span>
                        </p>
                      </Link>
                    ))
                  )}
                </div>

                <Link
                  to="/board/공지"
                  onClick={closePopovers}
                  className="block border-t border-kaist-grey/20 px-4 py-2.5 text-center text-xs font-bold text-kaist-darkgreen-main hover:bg-kaist-darkgreen/5"
                >
                  {lang === "ko" ? "공지사항 전체 보기" : "View all notices"}
                </Link>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setLanguage(lang === "ko" ? "en" : "ko")}
            className="flex items-center gap-1 text-xs font-bold text-kaist-black hover:text-kaist-darkgreen transition-all bg-gray-100 hover:bg-gray-200/80 px-2.5 py-1.5 rounded-lg border border-kaist-grey/15 cursor-pointer shrink-0"
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
                  setNotificationOpen(false);
                }}
              >
                <User className="w-4 h-4 shrink-0 text-kaist-greygreen" />
                <span className="hidden sm:block truncate text-sm">
                  {user.name}
                </span>
                <ChevronDown className="w-3.5 h-3.5 shrink-0 text-kaist-greygreen" />
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 top-full mt-2 w-60 rounded-lg border border-kaist-grey/25 bg-white shadow-xl z-50 overflow-hidden">
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
              className="group relative flex cursor-pointer items-center border-0 bg-transparent text-sm font-bold tracking-tight text-kaist-black transition-colors hover:text-kaist-darkgreen-main disabled:cursor-wait disabled:opacity-70 lg:text-base"
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
                className="rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-extrabold text-emerald-700 transition-colors hover:border-emerald-300 hover:bg-emerald-100 disabled:cursor-wait disabled:opacity-70"
              >
                {mockLoginStarting ? "Mock..." : "Mock 로그인"}
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
                  className="w-48 px-4 opacity-0 pointer-events-none"
                />
              );
            }

            return (
              <div
                key={item.label}
                className={`w-48 px-4 ${
                  index === 0 ? "border-l border-kaist-grey/30" : ""
                } border-r border-kaist-grey/30`}
              >
                <ul className="space-y-1">
                  {item.dropdown.map((subItem, subIndex) => (
                    <li
                      key={subItem}
                      className={`transition-all duration-200 pb-1 mx-2 ${
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
                        className={`block text-sm font-semibold tracking-tight text-center py-2 transition-all ${
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
