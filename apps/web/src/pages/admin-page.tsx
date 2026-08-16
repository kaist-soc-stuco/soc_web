import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  CalendarDays,
  ClipboardList,
  CreditCard,
  FileQuestion,
  LayoutDashboard,
  ListChecks,
  Mail,
  MessageSquareText,
  ShieldCheck,
  UserCog,
  Users,
  Vote,
} from 'lucide-react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAdminGrants } from '@/lib/admin-grants';
import { visibleAdminMenu } from '@/lib/static-site-content';

type AdminMenuMeta = {
  label: string;
  sidebarLabel?: string;
  description: string;
  group: 'content' | 'operation' | 'people' | 'system';
  icon: LucideIcon;
};

const dashboardItem = {
  to: '/admin',
  label: '대시보드',
  sidebarLabel: '마이페이지',
  description: '관리자 운영 현황',
  icon: LayoutDashboard,
};

const adminMenuMeta: Record<string, AdminMenuMeta> = {
  '/admin/payments': {
    label: '과비 납부 관리',
    description: '과비 납부 상태와 예외 처리',
    group: 'operation',
    icon: CreditCard,
  },
  '/admin/surveys': {
    label: '설문조사 관리',
    description: '설문 생성, 응답 조회',
    group: 'content',
    icon: ClipboardList,
  },
  '/admin/emails': {
    label: '이메일 일괄발송',
    description: '공지 메일과 발송 이력',
    group: 'operation',
    icon: Mail,
  },
  '/admin/contacts': {
    label: '집행위 연락망',
    description: '연락처와 역할 관리',
    group: 'people',
    icon: Users,
  },
  '/admin/users': {
    label: '사용자 관리',
    description: '계정 조회와 사용자 정보',
    group: 'people',
    icon: UserCog,
  },
  '/admin/permissions': {
    label: '권한 관리',
    description: '관리 권한 요청과 승인',
    group: 'system',
    icon: ShieldCheck,
  },
  '/admin/audit-logs': {
    label: '감사 로그',
    description: '권한 변경 기록',
    group: 'system',
    icon: Activity,
  },
  '/admin/boards': {
    label: '게시판 관리',
    description: '게시판 노출과 정책',
    group: 'content',
    icon: MessageSquareText,
  },
  '/admin/faqs': {
    label: 'FAQ 관리',
    description: '질문과 답변 관리',
    group: 'content',
    icon: FileQuestion,
  },
  '/admin/events': {
    label: '행사 관리',
    description: '캘린더 행사 등록',
    group: 'content',
    icon: CalendarDays,
  },
  '/admin/votes': {
    label: '투표 관리',
    description: '투표 생성과 결과 공개',
    group: 'operation',
    icon: Vote,
  },
  '/admin/pledges': {
    label: '공약 이행 관리',
    description: '공약 진행률과 상태',
    group: 'operation',
    icon: ListChecks,
  },
};

const priorityOrder = [
  '/admin/surveys',
  '/admin/boards',
  '/admin/faqs',
  '/admin/events',
  '/admin/payments',
  '/admin/emails',
  '/admin/votes',
  '/admin/pledges',
  '/admin/contacts',
  '/admin/users',
  '/admin/permissions',
  '/admin/audit-logs',
];

const groupOrder = ['content', 'operation', 'people', 'system'] as const;

const groupLabels: Record<(typeof groupOrder)[number], string> = {
  content: '콘텐츠',
  operation: '운영',
  people: '구성원',
  system: '시스템',
};

function isActivePath(pathname: string, to: string) {
  return pathname === to || pathname.startsWith(`${to}/`);
}

export function AdminPage() {
  const grants = useAdminGrants();
  const location = useLocation();
  const loading = grants.status === 'idle' || grants.status === 'loading';
  const menu = visibleAdminMenu(grants.grants)
    .map((item) => {
      const meta = adminMenuMeta[item.to];
      return {
        ...item,
        label: meta?.label ?? item.label,
        sidebarLabel: meta?.sidebarLabel ?? meta?.label ?? item.label,
        description: meta?.description ?? '',
        group: meta?.group ?? 'system',
        icon: meta?.icon ?? LayoutDashboard,
      };
    })
    .sort((a, b) => {
      const aIndex = priorityOrder.indexOf(a.to);
      const bIndex = priorityOrder.indexOf(b.to);
      return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
    });

  const mobileMenu = [dashboardItem, ...menu];
  const groupedMenu = groupOrder.map((group) => ({
    group,
    items: menu.filter((item) => item.group === group),
  }));

  return (
    <div className="min-h-screen bg-[#F7FCFC] text-[#39404B]">
      <div className="grid min-h-screen lg:grid-cols-[384px_minmax(0,1fr)]">
        <aside className="hidden bg-[#006B4A] text-[#F7FCFC] shadow-[8px_0_30px_rgba(0,107,74,0.12)] lg:flex lg:flex-col">
          <Link to="/admin" className="flex h-[85px] items-center gap-5 border-b border-[#F7FCFC]/10 px-7 transition hover:opacity-90">
            <img src="/kaist_logo.webp" alt="KAIST Logo" className="h-[31px] w-auto" />
            <div className="h-5 w-px bg-[#F7FCFC]/55" />
            <img src="/logo.webp" alt="SOC Logo" className="mb-2 h-[34px] w-auto" />
          </Link>

          <nav className="mt-7 flex-1 overflow-y-auto pb-8" aria-label="관리자 메뉴">
            <NavLink
              to={dashboardItem.to}
              end
              className={({ isActive }) =>
                `mx-7 flex min-h-[54px] items-center gap-4 rounded-[8px] px-5 text-[20px] leading-none transition ${
                  isActive
                    ? 'bg-[#1AA172] font-extrabold text-[#F7FCFC] shadow-[0_10px_24px_rgba(26,161,114,0.28)]'
                    : 'font-semibold text-[#D7E6DE]/82 hover:bg-[#F7FCFC]/8 hover:text-[#F7FCFC]'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <dashboardItem.icon className={`h-[22px] w-[22px] shrink-0 ${isActive ? 'text-[#F7FCFC]' : 'text-[#D7E6DE]/74'}`} aria-hidden="true" />
                  <span>{dashboardItem.sidebarLabel}</span>
                </>
              )}
            </NavLink>

            {loading ? <p className="px-[55px] py-5 text-[16px] font-semibold text-[#F7FCFC]/75">권한을 확인하는 중입니다.</p> : null}
            {grants.status === 'error' ? <p className="px-[55px] py-5 text-[16px] font-semibold text-red-100">관리자 권한을 불러오지 못했습니다.</p> : null}
            {!loading && grants.status !== 'error' && menu.length === 0 ? (
              <p className="px-[55px] py-5 text-[16px] font-semibold text-[#F7FCFC]/75">표시할 수 있는 관리자 메뉴가 없습니다.</p>
            ) : null}

            {groupedMenu.map(({ group, items }) =>
              items.length > 0 ? (
                <section key={group} className="mt-8 first:mt-7">
                  <p className="mb-3 px-11 text-[13px] font-extrabold uppercase tracking-[0.18em] text-[#86D8A7]/84">{groupLabels[group]}</p>

                  {items.map((item) => (
                    <div key={item.to} className="px-7 py-1">
                      <NavLink
                        to={item.to}
                        className={({ isActive }) =>
                          `flex min-h-[50px] items-center gap-4 rounded-[8px] px-5 text-[18px] leading-none transition ${
                            isActive
                              ? 'bg-[#1AA172] font-extrabold text-[#F7FCFC] shadow-[0_10px_24px_rgba(26,161,114,0.28)]'
                              : 'font-semibold text-[#D7E6DE]/78 hover:bg-[#F7FCFC]/8 hover:text-[#F7FCFC]'
                          }`
                        }
                      >
                        {({ isActive }) => {
                          const Icon = item.icon;
                          return (
                            <>
                              <Icon className={`h-[21px] w-[21px] shrink-0 ${isActive ? 'text-[#F7FCFC]' : 'text-[#D7E6DE]/68'}`} aria-hidden="true" />
                              <span className="truncate">{item.sidebarLabel}</span>
                            </>
                          );
                        }}
                      </NavLink>
                    </div>
                  ))}
                </section>
              ) : null,
            )}
          </nav>
        </aside>

        <div className="min-w-0">
          <header className="sticky top-0 z-20 border-b border-[#98A0AC]/40 bg-[#F7FCFC]/95 backdrop-blur">
            <div className="flex h-[85px] items-center justify-between gap-5 px-5 lg:px-[52px]">
              <div className="hidden items-center gap-8 text-[18px] font-semibold text-[#39404B] md:flex">
                <Link to="/boards" className="transition hover:text-[#006B4A]">
                  게시판
                </Link>
                <span className="h-4 w-px bg-[#98A0AC]/70" />
                <Link to="/events" className="transition hover:text-[#006B4A]">
                  행사/설문조사
                </Link>
                <span className="h-4 w-px bg-[#98A0AC]/70" />
                <Link to="/about" className="transition hover:text-[#006B4A]">
                  About
                </Link>
              </div>

              <Link to="/admin" className="flex items-center gap-3 md:hidden">
                <img src="/kaist_logo.webp" alt="KAIST Logo" className="h-6 w-auto" />
                <div className="h-4 w-px bg-[#98A0AC]/70" />
                <img src="/logo.webp" alt="SOC Logo" className="mb-1 h-7 w-auto" />
              </Link>

              <Link
                to="/"
                className="inline-flex min-h-10 items-center rounded-[5px] bg-[#1AA172] px-4 text-[14px] font-extrabold text-[#F7FCFC] transition hover:bg-[#006B4A]"
              >
                사이트로 돌아가기
              </Link>
            </div>
          </header>

          <div className="border-b border-[#98A0AC]/35 bg-[#F7FCFC] px-4 lg:hidden">
            <div className="flex gap-7 overflow-x-auto">
              {mobileMenu.map((item) => {
                const active = item.to === '/admin' ? location.pathname === '/admin' : isActivePath(location.pathname, item.to);
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/admin'}
                    className={`inline-flex min-h-12 shrink-0 items-center border-b-[3px] px-1 text-sm font-extrabold transition ${
                      active ? 'border-[#1AA172] text-[#1AA172]' : 'border-transparent text-[#9AA69F] hover:text-[#006B4A]'
                    }`}
                  >
                    {item.sidebarLabel}
                  </NavLink>
                );
              })}
            </div>
          </div>

          <main className="admin-console w-full min-w-0 px-4 pb-12 pt-[52px] sm:px-6 lg:px-[52px]">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
