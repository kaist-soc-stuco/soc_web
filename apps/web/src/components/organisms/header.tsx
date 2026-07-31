import { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { createApiClient } from '@soc/api-client';
import { Logo } from '@/components/atoms/logo';
import { invalidateBoardCatalog, loadBoardCatalog, useBoardCatalog } from '@/lib/board-catalog';
import { getAuthSessionSnapshot, getAuthSessionSummary } from '@/lib/auth-session';
import { invalidateAdminGrants, useAdminGrants } from '@/lib/admin-grants';
import { visibleAdminMenu } from '@/lib/static-site-content';
interface HeaderProps {
  showLogo?: boolean;
}

export function Header({ showLogo = false }: HeaderProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const navRef = useRef<HTMLElement>(null);
  const [navLeft, setNavLeft] = useState(0);
  const [authenticated, setAuthenticated] = useState(false);
  const boardCatalog = useBoardCatalog();
  const grants = useAdminGrants();
  const [boardRetrying, setBoardRetrying] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    let active = true;
    void getAuthSessionSummary(createApiClient({ baseUrl: '/api' }))
      .then((session) => { if (active) setAuthenticated(session.authenticated); })
      .catch(() => undefined);
    return () => { active = false; };
  }, [location.key]);
  useEffect(() => setMobileOpen(false), [location.pathname, location.search]);

  const logout = async () => {
    if (logoutLoading) return;
    setLogoutLoading(true);
    try {
      await createApiClient({ baseUrl: '/api' }).logout();
      setAuthenticated(false);
      invalidateAdminGrants();
      navigate('/login?status=success&reason=logged_out', { replace: true });
    } finally {
      setLogoutLoading(false);
      setMobileOpen(false);
    }
  };

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
  const hasAdminAccess = grants.status === 'ready' && visibleAdminMenu(grants.grants).length > 0;
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

        <div className="flex items-center gap-3 pr-4 md:pr-6">
          {authenticated ? (
            <>
              <Link to="/mypage" className="hidden text-sm font-extrabold text-kaist-black hover:text-kaist-darkgreen-main sm:block">마이페이지</Link>
              {hasAdminAccess ? <Link to="/admin" className="hidden text-sm font-extrabold text-kaist-black hover:text-kaist-darkgreen-main sm:block">관리자 센터</Link> : null}
              <button type="button" onClick={() => void logout()} disabled={logoutLoading} className="hidden text-sm font-bold text-kaist-grey hover:text-kaist-darkgreen-main disabled:opacity-50 sm:block">
                {logoutLoading ? '로그아웃 중' : '로그아웃'}
              </button>
            </>
          ) : <Link to="/login" className="text-sm font-extrabold text-kaist-black hover:text-kaist-darkgreen-main">로그인</Link>}
          <button type="button" aria-label="메뉴 열기" aria-expanded={mobileOpen} onClick={() => setMobileOpen((open) => !open)} className="rounded border border-kaist-grey/40 px-3 py-2 text-sm font-bold md:hidden">
            메뉴
          </button>
        </div>
      </div>
      {mobileOpen ? (
        <nav aria-label="모바일 메뉴" className="border-t border-kaist-grey/20 bg-white p-4 md:hidden">
          <ul className="space-y-3">
            {navItems.flatMap((item) => item.dropdown).map((item) => <li key={item.to}><Link className="block font-semibold" to={item.to}>{item.label}</Link></li>)}
            {authenticated ? <li><Link className="block font-semibold" to="/mypage">마이페이지</Link></li> : null}
            {authenticated && hasAdminAccess ? <li><Link className="block font-semibold" to="/admin">관리자 센터</Link></li> : null}
            {authenticated ? <li><button type="button" disabled={logoutLoading} onClick={() => void logout()} className="font-semibold text-kaist-darkgreen">{logoutLoading ? '로그아웃 중' : '로그아웃'}</button></li> : null}
          </ul>
        </nav>
      ) : null}

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
