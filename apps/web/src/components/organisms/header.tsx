import { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { createApiClient } from '@soc/api-client';
import { Logo } from '@/components/atoms/logo';
import { invalidateBoardCatalog, loadBoardCatalog, useBoardCatalog } from '@/lib/board-catalog';
import { getAuthSessionSnapshot, getAuthSessionSummary } from '@/lib/auth-session';
interface HeaderProps {
  showLogo?: boolean;
}

export function Header({ showLogo = false }: HeaderProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const navRef = useRef<HTMLElement>(null);
  const [navLeft, setNavLeft] = useState(0);
  const [authenticated, setAuthenticated] = useState(false);
  const boardCatalog = useBoardCatalog();
  const [boardRetrying, setBoardRetrying] = useState(false);
  const location = useLocation();
  useEffect(() => {
    let active = true;
    void getAuthSessionSummary(createApiClient({ baseUrl: '/api' }))
      .then((session) => { if (active) setAuthenticated(session.authenticated); })
      .catch(() => undefined);
    return () => { active = false; };
  }, [location.key]);

  useEffect(() => {
    const update = () => {
      if (navRef.current) setNavLeft(navRef.current.offsetLeft);
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [showLogo]);
  
  const boardItems = (boardCatalog.status === 'ready' ? boardCatalog.items : []).map((board) => ({
    label: board.title || board.code,
    to: `/board/${encodeURIComponent(board.code)}`,
  }));
  const navItems = [
    {
      label: '게시판',
      href: boardItems[0]?.to,
      dropdown: boardItems,
    },
    {
      label: '행사 & 설문조사',
      href: '/events?type=survey',
      dropdown: [
        { label: '설문조사', to: '/events?type=survey' },
        { label: '행사', to: '/events?type=event' },
      ],
    },
    {
      label: '소개',
      href: '/about',
      dropdown: [
        { label: '소개', to: '/about' },
        { label: 'FAQ', to: '/faq' },
        { label: '로드맵', to: '/about/roadmap' },
        { label: '일정', to: '/calendar' },
      ],
    },
  ];
  const terminalCatalogError = boardCatalog.status === 'error'
    && typeof boardCatalog.error === 'object'
    && boardCatalog.error !== null
    && 'status' in boardCatalog.error
    && boardCatalog.error.status === 401;
  const retryBoardCatalog = async () => {
    if (boardRetrying) return;
    setBoardRetrying(true);
    try {
      if (!terminalCatalogError) {
        invalidateBoardCatalog();
        await loadBoardCatalog();
        return;
      }
      const before = getAuthSessionSnapshot().epoch;
      await getAuthSessionSummary(createApiClient({ baseUrl: '/api' }));
      if (getAuthSessionSnapshot().epoch !== before) await loadBoardCatalog();
    } catch {
      // The catalog/session stores expose the fail-closed error state.
    } finally {
      setBoardRetrying(false);
    }
  };

  return (
    <header 
      className="flex-shrink-0 z-50 bg-kaist-white border-b border-kaist-black relative"
      onMouseLeave={() => setHoveredIndex(null)}
    >
      <div className="flex h-13 w-full items-stretch justify-between">
        {/* Left Section: Logo + Navigation */}
        <div className="flex items-stretch">
          {/* Logo Section (conditional) */}
          {showLogo && (
            <div className="flex items-center pl-4">
              <Logo />
            </div>
          )}
          
          {/* Navigation */}
          <nav ref={navRef} className={`hidden md:flex items-stretch ${showLogo ? 'pl-4' : 'pl-4'}`}>
            {navItems.map((item, index) => (
              <div
                key={index}
                className="relative group"
                onMouseEnter={() => setHoveredIndex(index)}
              >
                {item.href ? (
                  <Link
                    to={item.href}
                    className="relative flex h-full w-52 items-center justify-center text-sm font-bold tracking-tight text-kaist-black transition-colors hover:text-kaist-darkgreen-main"
                  >
                    <span className="py-2">{item.label}</span>
                    <span
                      className={`absolute bottom-0 left-0 right-0 h-1 bg-kaist-darkgreen-main transition-transform duration-200 origin-center ${
                        hoveredIndex === index ? 'scale-x-100' : 'scale-x-0'
                      }`}
                    />
                  </Link>
                ) : index === 0 && boardCatalog.status === 'error' ? (
                  <button
                    type="button"
                    onClick={() => void retryBoardCatalog()}
                    disabled={boardRetrying}
                    className="flex h-full w-52 items-center justify-center text-sm font-bold text-red-700 disabled:opacity-50"
                  >
                    {boardRetrying ? '세션 확인 중' : '게시판 다시 불러오기'}
                  </button>
                ) : (
                  <span className="flex h-full w-52 items-center justify-center text-sm font-bold text-kaist-grey">
                    {boardCatalog.status === 'loading' || boardCatalog.status === 'idle' ? '게시판 불러오는 중' : '표시할 게시판 없음'}
                  </span>
                )}
              </div>
            ))}
          </nav>
          <div className="sr-only" aria-live="polite">
            {boardCatalog.status === 'loading' && '게시판 정보를 불러오는 중입니다.'}
            {boardCatalog.status === 'error' && '게시판 정보를 불러오지 못했습니다.'}
            {boardCatalog.status === 'ready' && boardItems.length === 0 && '표시할 게시판이 없습니다.'}
          </div>
        </div>

        {/* Right Section: Search, Notification, Login */}
        <div className="flex items-center gap-2 md:gap-6 pr-6">
          <button className="text-kaist-black hover:text-kaist-darkgreen transition-colors p-2">
            <svg className="h-4 w-4 md:h-5 md:w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>
          <button className="text-kaist-black hover:text-kaist-darkgreen transition-colors p-2">
            <svg className="h-4 w-4 md:h-5 md:w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          </button>
          <Link
            to={authenticated ? "/admin" : "/login"}
            className="relative flex items-center text-sm lg:text-base font-extrabold tracking-tight text-kaist-black hover:text-kaist-darkgreen-main transition-colors group"
          >
            <span className="py-2">{authenticated ? '마이페이지' : '로그인'}</span>
            <span className="absolute bottom-0 left-0 right-0 h-1 scale-x-0 bg-kaist-darkgreen-main transition-transform duration-200 origin-center group-hover:scale-x-100" />
          </Link>
        </div>
      </div>

      {/* Full Dropdown Menu - DDP Style */}
      <div 
        className={`absolute left-0 pl-4 w-full bg-kaist-white shadow-lg overflow-hidden transition-all duration-300 ease-out ${
          hoveredIndex !== null 
            ? 'max-h-[36rem] opacity-100 translate-y-0' 
            : 'max-h-0 opacity-0 -translate-y-4'
        }`}
        style={{ top: 'calc(100% + 1px)', zIndex: 40 }}
      >
        <div className="flex gap-0" style={{ paddingLeft: navLeft }}>
          {navItems.map((item, index) => (
            <div
              key={index}
              className={`w-52 px-3 ${
                index === 0 ? '' : ''
              } ${
                index < navItems.length - 1 ? 'border-r border-kaist-grey/30' : 'border-r border-kaist-grey/30'
              }`}
            >
              <ul className="space-y-1">
                {item.dropdown.map((subItem, subIndex) => (
                  <li 
                    key={subItem.label}
                    className={`transition-all duration-200 pb-1 mx-2 ${
                      hoveredIndex !== null 
                        ? 'opacity-100 translate-x-0' 
                        : 'opacity-0 -translate-x-2'
                    } ${
                      subIndex < item.dropdown.length - 1 ? 'border-b border-kaist-grey/30' : 'pb-6'
                    } ${
                      subIndex === 0 ? 'pt-1' : ''
                    }` }
                    style={{
                      transitionDelay: hoveredIndex !== null ? `${(index * 80) + (subIndex * 40) + 80}ms` : '0ms',
                    }}
                    >
                      <Link
                      to={subItem.to}
                      className={`block py-3 text-center text-sm font-semibold tracking-tight transition-all lg:text-sm ${
                        hoveredIndex === index
                          ? 'text-kaist-black hover:text-kaist-darkgreen-main hover:translate-x-1'
                          : 'text-kaist-grey'
                      }`}
                    >
                      {subItem.label}
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
