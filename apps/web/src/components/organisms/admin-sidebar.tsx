import { Link, useLocation } from "react-router-dom";
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

  const groups = [
    { title: "콘텐츠", paths: ["content", "boards", "moderation", "faq", "roadmap"] },
    { title: "행사·참여", paths: ["calendar", "surveys", "votes"] },
    { title: "회원·재정", paths: ["users", "contacts", "finance", "emails"] },
    { title: "운영·권한", paths: ["permissions", "audit-logs"] },
  ];
  return <nav className="space-y-5 px-3 py-5" aria-label="관리자 메뉴">{groups.map(group => {
    const items = visibleItems.filter(item => group.paths.includes(item.to.split("/").pop()!));
    return items.length ? <section key={group.title}><h2 className="mb-2 px-3 text-xs font-semibold text-slate-400">{group.title}</h2>{items.map(item => { const Icon = item.icon; return <Link key={item.to} to={item.to} className={`flex min-h-10 items-center gap-2 rounded-lg px-3 py-2 text-sm ${location.pathname.startsWith(item.to) ? "bg-emerald-50 font-semibold text-brand-primary" : "text-slate-600 hover:bg-slate-50"}`}><Icon className="size-4" />{lang === "ko" ? item.label : item.labelEn}</Link>; })}</section> : null;
  })}</nav>;
}
