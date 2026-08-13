import { uiText } from "@/lib/i18n/surface-catalog";
import { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { createApiClient } from '@soc/api-client';
import { Globe2 } from 'lucide-react';
import { invalidateBoardCatalog, loadBoardCatalog, useBoardCatalog } from '@/lib/board-catalog';
import { getAuthSessionSnapshot, getAuthSessionSummary } from '@/lib/auth-session';
import { invalidateAdminGrants, useAdminGrants } from '@/lib/admin-grants';
import { visibleAdminMenu } from '@/lib/static-site-content';
import { useLocale } from '@/lib/locale-store';
interface HeaderProps {
    showLogo?: boolean;
}
export function Header({ showLogo = false }: HeaderProps) {
    const [locale, setLocale] = useLocale();
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
    const [mobileOpen, setMobileOpen] = useState(false);
    const [logoutLoading, setLogoutLoading] = useState(false);
    const [logoutError, setLogoutError] = useState(false);
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
            .then((session) => { if (active)
            setAuthenticated(session.authenticated); })
            .catch(() => undefined);
        return () => { active = false; };
    }, [location.key]);
    useEffect(() => setMobileOpen(false), [location.pathname, location.search]);
    const logout = async () => {
        if (logoutLoading)
            return;
        setLogoutLoading(true);
        setLogoutError(false);
        try {
            await createApiClient({ baseUrl: '/api' }).logout();
            setAuthenticated(false);
            invalidateAdminGrants();
            navigate('/login?status=success&reason=logged_out', { replace: true });
            setMobileOpen(false);
        }
        catch {
            setLogoutError(true);
        }
        finally {
            setLogoutLoading(false);
        }
    };
    useEffect(() => {
        const update = () => {
            if (navRef.current)
                setNavLeft(navRef.current.offsetLeft);
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
            label: locale === 'ko' ? uiText("components.organisms.header.bd1011dee4") : 'Boards',
            href: '/board',
            dropdown: boardItems,
        },
        {
            label: locale === 'ko' ? uiText("components.organisms.header.a6f30d2586") : 'Events & Surveys',
            href: '/events?type=survey',
            dropdown: [
                { label: locale === 'ko' ? uiText("components.organisms.header.e91f6f515d") : 'Surveys', to: '/events?type=survey' },
                { label: locale === 'ko' ? uiText("components.organisms.header.a6e55f8c8f") : 'Events', to: '/events?type=event' },
            ],
        },
        {
            label: locale === 'ko' ? '투표·공약' : 'Votes & Pledges',
            href: '/votes',
            dropdown: [
                { label: locale === 'ko' ? '투표' : 'Votes', to: '/votes' },
                { label: locale === 'ko' ? '공약 이행 현황판' : 'Pledge status', to: '/pledges' },
            ],
        },
        {
            label: locale === 'ko' ? uiText("components.organisms.header.fa255f0ccc") : 'About',
            href: '/about',
            dropdown: [
                { label: locale === 'ko' ? uiText("components.organisms.header.fa255f0ccc") : 'About', to: '/about' },
                { label: 'FAQ', to: '/faq' },
                { label: locale === 'ko' ? uiText("components.organisms.header.14823c1e8f") : 'Roadmap', to: '/about/roadmap' },
                { label: locale === 'ko' ? uiText("components.organisms.header.b2cb2d404f") : 'Calendar', to: '/calendar' },
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
        if (boardRetrying)
            return;
        setBoardRetrying(true);
        try {
            if (!terminalCatalogError) {
                invalidateBoardCatalog();
                await loadBoardCatalog();
                return;
            }
            const before = getAuthSessionSnapshot().epoch;
            await getAuthSessionSummary(createApiClient({ baseUrl: '/api' }));
            if (getAuthSessionSnapshot().epoch !== before)
                await loadBoardCatalog();
        }
        catch {
            // The catalog/session stores expose the fail-closed error state.
        }
        finally {
            setBoardRetrying(false);
        }
    };
    return (<header className="flex-shrink-0 z-50 bg-kaist-white border-b border-kaist-black relative" onMouseLeave={() => setHoveredIndex(null)}>
      <div className="flex min-h-14 w-full flex-wrap items-center justify-between gap-y-1 py-1 md:h-14 md:flex-nowrap md:items-stretch md:py-0 lg:h-[68px]">
        {/* Left Section: Logo + Navigation */}
        <div className="flex min-w-0 self-stretch">
          {/* Logo Section (conditional) */}
          {showLogo && (<Link to="/" aria-label="KAIST SoC Home" className="relative z-10 flex h-14 items-center justify-start px-5 transition-opacity hover:opacity-90 lg:h-[68px] lg:px-6">
              <div className="flex items-center gap-2 md:gap-3">
                <img src="/kaist_logo.png" alt="KAIST Logo" className="h-5 w-auto lg:h-[31px]"/>
                <div className="h-5 w-px bg-gray-300 lg:h-4"/>
                <img src="/logo.png" alt="SOC Logo" className="mb-2 h-6 w-auto lg:h-[34px]"/>
              </div>
            </Link>)}
          
          {/* Navigation */}
          <nav ref={navRef} className={`hidden h-full md:flex ${showLogo ? 'pl-4' : 'pl-4'}`}>
            {navItems.map((item, index) => (<div key={index} className="group relative h-full" onMouseEnter={() => setHoveredIndex(index)}>
                {item.href ? (<Link to={item.href} className="relative flex h-full min-w-[9.5rem] items-center justify-center px-3 text-base font-bold tracking-normal text-kaist-black transition-colors hover:text-kaist-darkgreen-main lg:min-w-[11rem] xl:min-w-52">
                    <span className="py-2 text-center">{item.label}</span>
                    <span className={`absolute bottom-0 left-0 right-0 h-1 bg-kaist-darkgreen-main transition-transform duration-200 origin-center ${hoveredIndex === index ? 'scale-x-100' : 'scale-x-0'}`}/>
                  </Link>) : index === 0 && boardCatalog.status === 'error' ? (<button type="button" onClick={() => void retryBoardCatalog()} disabled={boardRetrying} className="flex h-full min-w-[9.5rem] items-center justify-center px-3 text-base font-bold text-red-700 disabled:opacity-50 lg:min-w-[11rem] xl:min-w-52">
                    {boardRetrying ? uiText("components.organisms.header.bc7013832c") : uiText("components.organisms.header.9b7d32c816")}
                  </button>) : (<span className="flex h-full min-w-[9.5rem] items-center justify-center px-3 text-base font-bold text-kaist-grey lg:min-w-[11rem] xl:min-w-52">
                    {boardCatalog.status === 'loading' || boardCatalog.status === 'idle' ? uiText("components.organisms.header.0aa42317a8") : uiText("components.organisms.header.8e5f9adb0d")}
                  </span>)}
              </div>))}
          </nav>
          {boardCatalog.status === 'error' ? (<button type="button" onClick={() => void retryBoardCatalog()} disabled={boardRetrying} className="hidden px-3 text-xs font-bold text-red-700 md:block disabled:opacity-50">
              {boardRetrying ? uiText("components.organisms.header.bc7013832c") : uiText("components.organisms.header.9b7d32c816")}
            </button>) : null}
          <div className="sr-only" aria-live="polite">
            {boardCatalog.status === 'loading' && uiText("components.organisms.header.28c62a20de")}
            {boardCatalog.status === 'error' && uiText("components.organisms.header.88812f5baa")}
            {boardCatalog.status === 'ready' && boardItems.length === 0 && uiText("components.organisms.header.ae15cd0533")}
          </div>
        </div>

        <div className="flex min-h-12 w-full items-center justify-end gap-2 px-2 sm:gap-3 sm:px-4 md:w-auto md:pr-6">
          <label className="flex min-h-12 items-center gap-1.5">
            <Globe2 aria-hidden="true" className="size-5"/>
            <span className="sr-only">{locale === 'ko' ? uiText("components.organisms.header.1a723e1dbb") : 'Language'}</span>
            <select aria-label={locale === 'ko' ? uiText("components.organisms.header.1a723e1dbb") : 'Language'} value={locale} onChange={(event) => setLocale(event.target.value === 'en' ? 'en' : 'ko')} className="min-h-12 bg-transparent px-1.5 text-base font-bold">
              <option value="ko">{uiText("components.organisms.header.6e081b5948")}</option>
              <option value="en">English</option>
            </select>
          </label>
          {authenticated ? (<>
              <Link to="/mypage" className="hidden min-h-12 items-center px-2 text-base font-extrabold text-kaist-black hover:text-kaist-darkgreen-main sm:flex">{locale === 'ko' ? uiText("components.organisms.header.f5c324e660") : 'My Page'}</Link>
              {hasAdminAccess ? <Link to="/admin" className="hidden min-h-12 items-center px-2 text-base font-extrabold text-kaist-black hover:text-kaist-darkgreen-main sm:flex">{locale === 'ko' ? uiText("components.organisms.header.04c1f9416a") : 'Admin Center'}</Link> : null}
              <button type="button" onClick={() => void logout()} disabled={logoutLoading} className="hidden min-h-12 px-2 text-base font-bold text-kaist-grey hover:text-kaist-darkgreen-main disabled:opacity-50 sm:block">
                {logoutLoading ? (locale === 'ko' ? uiText("components.organisms.header.d6f05cf050") : 'Logging out') : (locale === 'ko' ? uiText("components.organisms.header.3879f078a4") : 'Log out')}
              </button>
            </>) : <Link to="/login" className="inline-flex min-h-12 items-center px-2 text-base font-extrabold text-kaist-black hover:text-kaist-darkgreen-main">{locale === 'ko' ? uiText("components.organisms.header.e225a6fd75") : 'Log in'}</Link>}
          <button type="button" aria-label={locale === 'ko' ? uiText("components.organisms.header.195da6209a") : 'Open menu'} aria-expanded={mobileOpen} onClick={() => setMobileOpen((open) => !open)} className="min-h-12 min-w-12 rounded border border-kaist-grey/40 px-3 py-2 text-base font-bold md:hidden">
            {locale === 'ko' ? uiText("components.organisms.header.076925c571") : 'Menu'}
          </button>
        </div>
      </div>
      {mobileOpen ? (<nav aria-label={locale === 'ko' ? uiText("components.organisms.header.aa3cdfdc30") : 'Mobile menu'} className="border-t border-kaist-grey/20 bg-white p-4 md:hidden">
          <ul className="space-y-3">
            {navItems.flatMap((item) => item.dropdown).map((item) => <li key={item.to}><Link className="flex min-h-11 items-center font-semibold" to={item.to}>{item.label}</Link></li>)}
            {authenticated ? <li><Link className="flex min-h-11 items-center font-semibold" to="/mypage">{locale === 'ko' ? uiText("components.organisms.header.f5c324e660") : 'My Page'}</Link></li> : null}
            {authenticated && hasAdminAccess ? <li><Link className="flex min-h-11 items-center font-semibold" to="/admin">{locale === 'ko' ? uiText("components.organisms.header.04c1f9416a") : 'Admin Center'}</Link></li> : null}
            {authenticated ? <li><button type="button" disabled={logoutLoading} onClick={() => void logout()} className="min-h-11 font-semibold text-kaist-darkgreen">{logoutLoading ? (locale === 'ko' ? uiText("components.organisms.header.d6f05cf050") : 'Logging out') : (locale === 'ko' ? uiText("components.organisms.header.3879f078a4") : 'Log out')}</button></li> : null}
          </ul>
        </nav>) : null}
      {logoutError ? <p role="alert" className="border-t border-red-200 bg-red-50 px-4 py-2 text-center text-sm font-semibold text-red-700">{locale === 'ko' ? uiText("components.organisms.header.65aae0b7cb") : 'Could not log out. Please try again shortly.'}</p> : null}

      {/* Full Dropdown Menu - DDP Style */}
      <div className={`absolute left-0 pl-4 w-full bg-kaist-white shadow-lg overflow-hidden transition-all duration-300 ease-out ${hoveredIndex !== null
            ? 'max-h-[48rem] opacity-100 translate-y-0'
            : 'max-h-0 opacity-0 -translate-y-4'}`} style={{ top: 'calc(100% + 1px)', zIndex: 40 }}>
        <div className="flex items-stretch gap-0" style={{ paddingLeft: navLeft }}>
          {navItems.map((item, index) => (<div key={index} className={`min-w-[9.5rem] self-stretch px-3 pb-28 lg:min-w-[11rem] lg:pb-36 xl:min-w-52 ${index === 0 ? '' : ''} ${index < navItems.length - 1 ? 'border-r border-kaist-grey/30' : 'border-r border-kaist-grey/30'}`}>
              <ul className="space-y-1.5">
                {item.dropdown.map((subItem, subIndex) => (<li key={subItem.label} className={`transition-all duration-200 pb-1.5 mx-2 ${hoveredIndex !== null
                    ? 'opacity-100 translate-x-0'
                    : 'opacity-0 -translate-x-2'} ${subIndex < item.dropdown.length - 1 ? 'border-b border-kaist-grey/30' : 'pb-7'} ${subIndex === 0 ? 'pt-2' : ''}`} style={{
                    transitionDelay: hoveredIndex !== null ? `${(index * 80) + (subIndex * 40) + 80}ms` : '0ms',
                }}>
                      <Link to={subItem.to} className={`block py-3.5 text-center text-base font-semibold tracking-normal transition-all ${hoveredIndex === index
                    ? 'text-kaist-black hover:text-kaist-darkgreen-main hover:translate-x-1'
                    : 'text-kaist-grey'}`}>
                      {subItem.label}
                    </Link>
                  </li>))}
              </ul>
            </div>))}
        </div>
      </div>
    </header>);
}
