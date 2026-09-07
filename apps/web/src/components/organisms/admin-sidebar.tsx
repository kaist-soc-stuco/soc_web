import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  CalendarDays,
  ClipboardList,
  ContactRound,
  LayoutList,
  Map,
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
import { useLanguage } from "@/hooks/use-language";

type AdminMenuItem = {
  label: string;
  labelEn: string;
  to: string;
  bits: number[];
  icon: typeof PanelsTopLeft;
};

const ADMIN_MENU: AdminMenuItem[] = [
  { label: "사이트 설정", labelEn: "Site settings", to: "/admin/content", bits: [Permissions.MANAGE_SITE_CONTENT], icon: PanelsTopLeft },
  { label: "일정 관리", labelEn: "Calendar", to: "/admin/calendar", bits: [Permissions.MANAGE_CALENDAR], icon: CalendarDays },
  { label: "유저 관리", labelEn: "Users", to: "/admin/users", bits: [Permissions.MANAGE_USERS], icon: Users },
  { label: "권한 관리", labelEn: "Permissions", to: "/admin/permissions", bits: [Permissions.MANAGE_ROLES], icon: ShieldCheck },
  { label: "과비 관리", labelEn: "Student fees", to: "/admin/finance", bits: [Permissions.MANAGE_FINANCE], icon: WalletCards },
  { label: "설문조사 관리", labelEn: "Surveys", to: "/admin/surveys", bits: [Permissions.MANAGE_SURVEY], icon: ClipboardList },
  { label: "투표 관리", labelEn: "Votes", to: "/admin/votes", bits: [Permissions.MANAGE_VOTE], icon: Vote },
  { label: "이메일 일괄 발송", labelEn: "Bulk email", to: "/admin/emails", bits: [Permissions.SEND_BULK_EMAIL], icon: Mail },
  { label: "연락망", labelEn: "Contacts", to: "/admin/contacts", bits: [Permissions.MANAGE_CONTACTS], icon: ContactRound },
  { label: "운영 로그", labelEn: "Audit logs", to: "/admin/audit-logs", bits: [Permissions.VIEW_AUDIT_LOG], icon: ScrollText },
  { label: "게시판 관리", labelEn: "Boards", to: "/admin/boards", bits: [Permissions.MANAGE_BOARDS], icon: LayoutList },
  {
    label: "FAQ 관리",
    labelEn: "FAQ",
    to: "/admin/faq",
    bits: [Permissions.MANAGE_SITE_CONTENT],
    icon: MessageCircleQuestion,
  },
  { label: "게시글/댓글 관리", labelEn: "Moderation", to: "/admin/moderation", bits: [Permissions.MODERATE_CONTENT], icon: EyeOff },
  { label: "로드맵 관리", labelEn: "Roadmap", to: "/admin/roadmap", bits: [Permissions.MANAGE_SITE_CONTENT], icon: Map },
];

const ADMIN_ACCESS_PERMISSIONS = ADMIN_MENU.flatMap((item) => item.bits);

export function AdminSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { data: session } = useCurrentSession();
  const { lang } = useLanguage();
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
  const activePath = visibleItems.find((item) => location.pathname.startsWith(item.to))?.to ?? "/admin";
  const adminHomeLabel = lang === "ko" ? "관리자 홈" : "Admin home";

  return (
    <>
      <div className="admin-mobile-navigation select-none border-b border-[#e5eaf0] bg-white px-4 py-3 md:hidden">
        <label className="sr-only" htmlFor="admin-mobile-menu">
          {lang === "ko" ? "관리자 메뉴 선택" : "Choose an admin section"}
        </label>
        <select
          id="admin-mobile-menu"
          value={activePath}
          onChange={(event) => navigate(event.currentTarget.value)}
          className="min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/15"
        >
          <option value="/admin">{adminHomeLabel}</option>
          {visibleItems.map((item) => (
            <option key={item.to} value={item.to}>
              {lang === "ko" ? item.label : item.labelEn}
            </option>
          ))}
        </select>
      </div>

      <aside className="select-none sticky top-16 hidden h-[calc(100vh-4rem)] max-h-[calc(100vh-4rem)] w-60 shrink-0 self-start flex-col overflow-y-auto border-r border-[#e5eaf0] bg-white px-3 py-6 text-app-text-strong md:flex">
        <div className="px-3 text-base font-semibold tracking-tight text-slate-900">{lang === "ko" ? "관리자 메뉴" : "Admin menu"}</div>

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
                {lang === "ko" ? item.label : item.labelEn}
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
