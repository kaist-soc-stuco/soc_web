import { Link, useLocation } from "react-router-dom";
import {
  CalendarDays,
  ClipboardList,
  ContactRound,
  LayoutList,
  MessageCircleQuestion,
  EyeOff,
  Mail,
  PanelsTopLeft,
  ScrollText,
  ShieldCheck,
  Users,
  WalletCards,
  Vote,
} from "lucide-react";

import { Permissions } from "@/lib/permissions";
import { useCurrentSession } from "@/hooks/use-current-session";

type AdminMenuItem = {
  label: string;
  to: string;
  bits: number[];
  icon: typeof PanelsTopLeft;
};

const ADMIN_MENU: AdminMenuItem[] = [
  { label: "사이트 설정", to: "/admin/content", bits: [Permissions.MANAGE_SITE_CONTENT], icon: PanelsTopLeft },
  { label: "일정 관리", to: "/admin/calendar", bits: [Permissions.MANAGE_CALENDAR], icon: CalendarDays },
  { label: "유저 관리", to: "/admin/users", bits: [Permissions.MANAGE_USERS], icon: Users },
  { label: "권한 관리", to: "/admin/permissions", bits: [Permissions.MANAGE_ROLES], icon: ShieldCheck },
  { label: "과비 관리", to: "/admin/finance", bits: [Permissions.MANAGE_FINANCE], icon: WalletCards },
  { label: "설문조사 관리", to: "/admin/surveys", bits: [Permissions.MANAGE_SURVEY], icon: ClipboardList },
  { label: "투표 관리", to: "/admin/votes", bits: [Permissions.MANAGE_VOTE], icon: Vote },
  { label: "이메일 일괄 발송", to: "/admin/emails", bits: [Permissions.SEND_BULK_EMAIL], icon: Mail },
  { label: "연락망", to: "/admin/contacts", bits: [Permissions.MANAGE_CONTACTS], icon: ContactRound },
  { label: "운영 로그", to: "/admin/audit-logs", bits: [Permissions.VIEW_AUDIT_LOG], icon: ScrollText },
  { label: "게시판 관리", to: "/admin/boards", bits: [Permissions.MANAGE_BOARDS], icon: LayoutList },
  {
    label: "FAQ 관리",
    to: "/admin/faq",
    bits: [Permissions.MANAGE_SITE_CONTENT],
    icon: MessageCircleQuestion,
  },
  { label: "게시글/댓글 관리", to: "/admin/moderation", bits: [Permissions.MODERATE_CONTENT], icon: EyeOff },
];

const ADMIN_ACCESS_PERMISSIONS = ADMIN_MENU.flatMap((item) => item.bits);

export function AdminSidebar() {
  const location = useLocation();
  const { data: session } = useCurrentSession();
  const permission = session?.permission ?? 0;

  const canShow = Permissions.hasAny(
    permission,
    ...ADMIN_ACCESS_PERMISSIONS,
  );

  if (!canShow) {
    return null;
  }

  const visibleItems = ADMIN_MENU.filter((item) =>
    Permissions.hasAny(permission, ...item.bits),
  );

  return (
    <>
      <nav className="select-none flex min-w-0 gap-1.5 overflow-x-auto border-b border-[#e5eaf0] bg-white px-4 py-2.5 md:hidden">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname.startsWith(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
                className={`inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg border border-transparent px-3 py-2 text-xs font-medium transition-colors ${
                isActive
                  ? "bg-[#eaf5ef] text-brand-primary"
                  : "text-app-text-body hover:bg-slate-50"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <aside className="select-none sticky top-16 hidden h-[calc(100vh-4rem)] max-h-[calc(100vh-4rem)] w-60 shrink-0 self-start flex-col overflow-y-auto border-r border-[#e5eaf0] bg-white px-3 py-6 text-app-text-strong md:flex">
        <div className="px-3 text-base font-semibold tracking-tight text-slate-900">관리자 메뉴</div>

        <nav className="mt-5 flex flex-col gap-0.5">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
              className={`flex min-h-10 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-[#eaf5ef] font-semibold text-brand-primary"
                  : "text-app-text-body hover:bg-slate-50 hover:text-brand-primary"
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
