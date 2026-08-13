import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  ArrowRight,
  CalendarDays,
  ClipboardList,
  CreditCard,
  FileQuestion,
  ListChecks,
  Mail,
  MessageSquareText,
  ShieldCheck,
  UserCog,
  Users,
  Vote,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAdminGrants } from '@/lib/admin-grants';
import { visibleAdminMenu } from '@/lib/static-site-content';

type AdminGroup = 'content' | 'operation' | 'people' | 'system';

type DashboardMeta = {
  label: string;
  description: string;
  icon: LucideIcon;
  group: AdminGroup;
};

const dashboardMeta: Record<string, DashboardMeta> = {
  '/admin/surveys': {
    label: '설문조사 관리',
    description: '설문 생성, 공개 상태, 응답 검토를 관리합니다.',
    icon: ClipboardList,
    group: 'content',
  },
  '/admin/boards': {
    label: '게시판 관리',
    description: '게시판 종류, 작성 권한, 홈 노출 정책을 조정합니다.',
    icon: MessageSquareText,
    group: 'content',
  },
  '/admin/faqs': {
    label: 'FAQ 관리',
    description: 'FAQ 주제와 공개 상태를 정리합니다.',
    icon: FileQuestion,
    group: 'content',
  },
  '/admin/events': {
    label: '행사 관리',
    description: '캘린더 행사와 연결 설문을 등록합니다.',
    icon: CalendarDays,
    group: 'content',
  },
  '/admin/payments': {
    label: '과비 납부 관리',
    description: '납부 상태, 예외 사유, 처리 이력을 확인합니다.',
    icon: CreditCard,
    group: 'operation',
  },
  '/admin/emails': {
    label: '이메일 일괄발송',
    description: '대상자별 공지 메일을 작성하고 발송합니다.',
    icon: Mail,
    group: 'operation',
  },
  '/admin/votes': {
    label: '투표 관리',
    description: '투표 생성, 개표, 결과 공개 상태를 제어합니다.',
    icon: Vote,
    group: 'operation',
  },
  '/admin/pledges': {
    label: '공약 이행 관리',
    description: '공약 진행률과 상태 설명을 업데이트합니다.',
    icon: ListChecks,
    group: 'operation',
  },
  '/admin/contacts': {
    label: '집행위 연락망',
    description: '역할별 연락 정보를 관리합니다.',
    icon: Users,
    group: 'people',
  },
  '/admin/users': {
    label: '사용자 관리',
    description: '계정 조회, 상세 정보, 사용자 상태를 확인합니다.',
    icon: UserCog,
    group: 'people',
  },
  '/admin/permissions': {
    label: '권한 관리',
    description: '관리 권한 요청을 검토하고 승인합니다.',
    icon: ShieldCheck,
    group: 'system',
  },
  '/admin/audit-logs': {
    label: '감사 로그',
    description: '권한 변경과 주요 운영 기록을 추적합니다.',
    icon: Activity,
    group: 'system',
  },
};

const fallbackMeta: DashboardMeta = {
  label: '관리 메뉴',
  description: '선택한 관리자 기능으로 이동합니다.',
  icon: Activity,
  group: 'system',
};

const groupOrder: readonly AdminGroup[] = ['content', 'operation', 'people', 'system'];

const groupLabels: Record<AdminGroup, string> = {
  content: '콘텐츠',
  operation: '운영',
  people: '구성원',
  system: '시스템',
};

const groupDescriptions: Record<AdminGroup, string> = {
  content: '사용자에게 공개되는 콘텐츠와 정보 구조',
  operation: '학생회 운영 흐름과 참여 기능',
  people: '계정, 연락망, 사용자 기반 정보',
  system: '권한, 승인, 감사 기록',
};

export function AdminDashboardPage() {
  const grants = useAdminGrants();
  const menu = visibleAdminMenu(grants.grants).map((item) => ({ ...item, ...(dashboardMeta[item.to] ?? fallbackMeta) }));
  const groups = groupOrder.map((group) => ({ group, items: menu.filter((item) => item.group === group) })).filter(({ items }) => items.length > 0);

  if (grants.status === 'idle' || grants.status === 'loading') {
    return <p role="status" className="text-sm font-semibold text-slate-600">관리자 권한을 확인하는 중입니다.</p>;
  }
  if (grants.status === 'error') {
    return <p role="alert" className="text-sm font-semibold text-red-700">관리자 권한을 불러오지 못했습니다.</p>;
  }
  if (menu.length === 0) {
    return <p role="alert" className="text-sm font-semibold text-slate-600">표시할 수 있는 관리자 메뉴가 없습니다.</p>;
  }

  return (
    <section className="admin-dashboard">
      <div className="admin-page-heading">
        <div>
          <p className="admin-eyebrow">Admin Console</p>
          <h1>관리자 대시보드</h1>
          <p>현재 계정에 허용된 관리 범위를 확인하고, 필요한 운영 화면으로 이동합니다.</p>
        </div>
        <div className="admin-heading-stat">
          <span>{menu.length}</span>
          <p>접근 가능 메뉴</p>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="admin-panel">
          <div className="admin-panel-header">
            <div>
              <p className="admin-eyebrow">Workspace</p>
              <h2>업무 분류</h2>
            </div>
          </div>

          <div className="divide-y divide-[#98A0AC]/25">
            {groups.map(({ group, items }) => (
              <section key={group} className="grid gap-4 py-5 first:pt-0 last:pb-0 xl:grid-cols-[190px_minmax(0,1fr)]">
                <div>
                  <h3 className="text-[22px] font-extrabold text-[#39404B]">{groupLabels[group]}</h3>
                  <p className="mt-2 text-sm font-semibold leading-6 text-[#68736D]">{groupDescriptions[group]}</p>
                </div>
                <div className="grid gap-2">
                  {items.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Link key={item.to} to={item.to} className="admin-menu-row group">
                        <span className="admin-menu-icon">
                          <Icon className="h-5 w-5" aria-hidden="true" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[17px] font-extrabold text-[#39404B]">{item.label}</span>
                          <span className="mt-1 block text-sm font-semibold text-[#68736D]">{item.description}</span>
                        </span>
                        <ArrowRight className="h-4 w-4 shrink-0 text-[#98A0AC] transition group-hover:translate-x-0.5 group-hover:text-[#006B4A]" aria-hidden="true" />
                      </Link>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </div>

        <aside className="grid gap-5 content-start">
          <div className="admin-panel">
            <div className="admin-panel-header">
              <div>
                <p className="admin-eyebrow">Checklist</p>
                <h2>운영 체크</h2>
              </div>
            </div>
            <div className="grid gap-3">
              {['공개 콘텐츠 상태 확인', '권한 요청 및 감사 로그 확인', '설문/투표 마감 일정 점검'].map((item) => (
                <div key={item} className="flex gap-3 rounded-[8px] bg-[#F7FCFC] px-3 py-3 text-sm font-bold text-[#39404B]">
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#1AA172]" aria-hidden="true" />
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="admin-panel">
            <div className="admin-panel-header">
              <div>
                <p className="admin-eyebrow">Recent Scope</p>
                <h2>빠른 이동</h2>
              </div>
            </div>
            <div className="grid gap-1">
              {menu.slice(0, 5).map((item) => (
                <Link key={item.to} to={item.to} className="flex min-h-11 items-center justify-between rounded-[8px] px-3 text-sm font-extrabold text-[#39404B] transition hover:bg-[#F7FCFC] hover:text-[#006B4A]">
                  {item.label}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
