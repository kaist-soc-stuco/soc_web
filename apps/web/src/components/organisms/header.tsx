import { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import { Logo } from "@/components/atoms/logo";
import { createApiClient } from "@soc/api-client";
import { resolveApiBaseUrl } from "@/lib/api-base-url";
import { useCurrentSession } from "@/hooks/use-current-session";
import { useQueryClient } from "@tanstack/react-query";
import { useLanguage } from "@/hooks/use-language";
import { Globe } from "lucide-react";

interface HeaderProps {
  showLogo?: boolean;
}

export function Header({ showLogo = false }: HeaderProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const navRef = useRef<HTMLElement>(null);
  const [navLeft, setNavLeft] = useState(0);
  const { data: session } = useCurrentSession();
  const queryClient = useQueryClient();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const { lang, setLanguage } = useLanguage();

  // 세션 정보를 기반으로 유저 정보 계산
  const user = session?.authenticated && session.userId ? {
    id: session.userId,
    name: (lang === "ko" ? session.nameKo : (session.nameEn || session.nameKo)) ?? "사용자",
    permission: session.permission ?? 0,
  } : null;

  const updateNavLeft = () => {
    if (navRef.current) setNavLeft(navRef.current.offsetLeft);
  };

  useEffect(() => {
    updateNavLeft();
    window.addEventListener("resize", updateNavLeft);
    return () => window.removeEventListener("resize", updateNavLeft);
  }, [showLogo]);

  const navItems = lang === "ko" ? [
    {
      label: "게시판",
      href: "/board/공지",
      dropdown: ["공지", "행사", "HoC", "홍보글", "건의사항", "연구실", "QnA"],
      dropdownLabels: ["공지", "행사", "HoC", "홍보글", "건의사항", "연구실", "QnA"],
      isBoard: true,
    },
    {
      label: "행사 / 설문·투표",
      href: "/events-surveys",
      dropdown: ["행사", "설문·투표"],
      dropdownLabels: ["행사", "설문·투표"],
    },
    {
      label: "About",
      href: "/about",
      dropdown: ["소개", "연혁", "조직도", "구성원"],
      dropdownLabels: ["소개", "연혁", "조직도", "구성원"],
    },
  ] : [
    {
      label: "Board",
      href: "/board/공지",
      dropdown: ["공지", "행사", "HoC", "홍보글", "건의사항", "연구실", "QnA"],
      dropdownLabels: ["Notice", "Event", "HoC", "Promo", "Suggestions", "Labs", "QnA"],
      isBoard: true,
    },
    {
      label: "Events / Surveys & Votes",
      href: "/events-surveys",
      dropdown: ["행사", "설문·투표"],
      dropdownLabels: ["Events", "Surveys & Votes"],
    },
    {
      label: "About",
      href: "/about",
      dropdown: ["소개", "연혁", "조직도", "구성원"],
      dropdownLabels: ["Intro", "History", "Org Chart", "Members"],
    },
  ];

  return (
    <header
      className="shrink-0 z-50 bg-kaist-white border-b border-kaist-black relative"
      onMouseLeave={() => setHoveredIndex(null)}
    >
      <div className="flex h-14 w-full items-stretch justify-between">
        {/* Left Section: Logo + Navigation */}
        <div className="flex items-stretch">
          {/* Logo Section (conditional) */}
          {showLogo && (
            <div className="flex items-center pl-4">
              <Logo />
            </div>
          )}

          {/* Navigation */}
          <nav
            ref={navRef}
            className={`hidden md:flex items-stretch ${showLogo ? "" : "pl-12"}`}
          >
            {navItems.map((item, index) => (
              <div
                key={index}
                className="relative group"
                onMouseEnter={() => setHoveredIndex(index)}
              >
                <Link
                  to={item.href}
                  className="relative flex items-center justify-center w-48 h-full text-sm lg:text-base font-extrabold tracking-tight text-kaist-black hover:text-kaist-darkgreen-main transition-colors"
                >
                  <span className="py-2">{item.label}</span>
                  <span
                    className={`absolute bottom-0 left-0 right-0 h-1 bg-kaist-darkgreen-main transition-transform duration-200 origin-center ${hoveredIndex === index ? "scale-x-100" : "scale-x-0"
                      }`}
                  />
                </Link>
              </div>
            ))}
          </nav>
        </div>

        {/* Right Section: Search, Notification, Language, Login/User */}
        <div className="flex items-center gap-2 md:gap-4 pr-6 relative">
          <button className="text-kaist-black hover:text-kaist-darkgreen transition-colors p-2">
            {/* 검색 아이콘 */}
            <svg className="h-4 w-4 md:h-5 md:w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>
          <button className="text-kaist-black hover:text-kaist-darkgreen transition-colors p-2">
            {/* 알림 아이콘 */}
            <svg className="h-4 w-4 md:h-5 md:w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          </button>
          
          {/* Language Switch Toggle */}
          <button 
            onClick={() => setLanguage(lang === "ko" ? "en" : "ko")}
            className="flex items-center gap-1 text-xs font-bold text-kaist-black hover:text-kaist-darkgreen transition-all bg-gray-100 hover:bg-gray-200/80 px-2.5 py-1.5 rounded-lg border border-kaist-grey/15"
            title={lang === "ko" ? "Switch to English" : "한국어로 변경"}
          >
            <Globe className="w-3.5 h-3.5 text-kaist-greygreen" />
            <span>{lang === "ko" ? "KO" : "EN"}</span>
          </button>

          {user ? (
            <div className="relative">
              <button
                className="flex items-center gap-2 px-3 py-1 rounded hover:bg-kaist-darkgreen/5 font-bold text-kaist-black"
                onClick={() => setDropdownOpen((v) => !v)}
                onBlur={() => setTimeout(() => setDropdownOpen(false), 150)}
              >
                <span>{user.name}</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white border border-kaist-grey shadow-lg rounded z-50">
                  <ul className="py-1">
                    <li>
                      <Link to="/mypage" className="block px-4 py-2 hover:bg-kaist-darkgreen/5 text-sm font-semibold">
                        {lang === "ko" ? "마이페이지" : "My Page"}
                      </Link>
                    </li>

                    {user.permission & 312 ? (
                      <li>
                        <Link to="/admin/surveys" className="block px-4 py-2 hover:bg-kaist-darkgreen/5 text-sm font-semibold">
                          {lang === "ko" ? "관리자 대시보드" : "Admin Dashboard"}
                        </Link>
                      </li>
                    ) : null}
                    <li>
                      <button
                        className="w-full text-left px-4 py-2 hover:bg-kaist-darkgreen/5 text-sm font-semibold"
                        onClick={async () => {
                          const apiClient = createApiClient({ baseUrl: resolveApiBaseUrl() });
                          await apiClient.logout();
                          await queryClient.invalidateQueries({ queryKey: ["auth", "session"] });
                          window.location.reload();
                        }}
                      >
                        {lang === "ko" ? "로그아웃" : "Logout"}
                      </button>
                    </li>
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <Link
              to="/login"
              className="relative flex items-center text-sm lg:text-base font-extrabold tracking-tight text-kaist-black hover:text-kaist-darkgreen-main transition-colors group"
            >
              <span className="py-2">{lang === "ko" ? "로그인" : "Login"}</span>
              <span className="absolute bottom-0 left-0 right-0 h-1 scale-x-0 bg-kaist-darkgreen-main transition-transform duration-200 origin-center group-hover:scale-x-100" />
            </Link>
          )}
        </div>
      </div>

      {/* Full Dropdown Menu - DDP Style */}
      <div
        className={`absolute left-0 w-full bg-kaist-white shadow-lg overflow-hidden transition-all duration-300 ease-out ${hoveredIndex !== null
            ? "max-h-96 opacity-100 translate-y-0"
            : "max-h-0 opacity-0 -translate-y-4"
          }`}
        style={{ top: "calc(100% + 1px)", zIndex: 40 }}
      >
        <div className="flex gap-0" style={{ paddingLeft: navLeft }}>
          {navItems.map((item, index) => (
            <div
              key={index}
              className={`w-48 px-4 ${index === 0 ? "border-l border-kaist-grey/30" : ""
                } ${index < navItems.length - 1
                  ? "border-r border-kaist-grey/30"
                  : "border-r border-kaist-grey/30"
                }`}
            >
              <ul className="space-y-1">
                {item.dropdown.map((subItem, subIndex) => (
                  <li
                    key={subIndex}
                    className={`transition-all duration-200 pb-1 mx-2 ${hoveredIndex !== null
                        ? "opacity-100 translate-x-0"
                        : "opacity-0 -translate-x-2"
                      } ${subIndex < item.dropdown.length - 1
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
                          : item.href === "/about"
                          ? `/about?tab=${["intro", "history", "org", "members"][subIndex]}`
                          : item.href === "/events-surveys"
                          ? `/events-surveys?tab=${["event", "survey"][subIndex]}`
                          : `${item.href}/${subItem}`
                      }
                      className={`block text-sm font-semibold tracking-tight text-center py-2 transition-all ${hoveredIndex === index
                          ? "text-kaist-black hover:text-kaist-darkgreen-main hover:translate-x-1"
                          : "text-kaist-grey"
                        }`}
                    >
                      {item.dropdownLabels ? item.dropdownLabels[subIndex] : subItem}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </header>
  );
}
