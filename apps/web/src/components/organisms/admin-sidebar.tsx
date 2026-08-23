import { Link, useLocation } from "react-router-dom";
import {
  ClipboardList,
  ContactRound,
  LayoutList,
  Mail,
  PanelsTopLeft,
  ScrollText,
  ShieldCheck,
  Users,
  WalletCards,
} from "lucide-react";

import { Permissions } from "@/lib/permissions";
import { useCurrentSession } from "@/hooks/use-current-session";

const ADMIN_MENU = [
  { label: "사이트 설정", to: "/admin/content", bit: Permissions.MANAGE_CONTENT, icon: PanelsTopLeft },
  { label: "유저 관리", to: "/admin/users", bit: Permissions.ADMIN, icon: Users },
  { label: "권한 관리", to: "/admin/permissions", bit: Permissions.ADMIN, icon: ShieldCheck },
  { label: "과비 납부 관리", to: "/admin/finance", bit: Permissions.MANAGE_FINANCE, icon: WalletCards },
  { label: "설문조사 관리", to: "/admin/surveys", bit: Permissions.MANAGE_SURVEY, icon: ClipboardList },
  { label: "이메일 일괄 발송", to: "/admin/emails", bit: Permissions.ADMIN, icon: Mail },
  { label: "연락망", to: "/admin/contacts", bit: Permissions.MANAGE_CONTENT, icon: ContactRound },
  { label: "운영 로그", to: "/admin/audit-logs", bit: Permissions.ADMIN, icon: ScrollText },
  // 게시판 관리 기능은 유지하되, 운영 핵심 메뉴 뒤에 배치한다.
  { label: "게시판 관리", to: "/admin/boards", bit: Permissions.ADMIN, icon: LayoutList },
];

export function AdminSidebar() {
  const location = useLocation();
  const { data: session } = useCurrentSession();
  const permission = session?.permission ?? 0;

  const canShow = Permissions.hasAny(
    permission,
    Permissions.MANAGE_SURVEY,
    Permissions.MANAGE_CONTENT,
    Permissions.MANAGE_FINANCE,
    Permissions.ADMIN,
  );

  if (!canShow) {
    return null;
  }

  const visibleItems = ADMIN_MENU.filter((item) =>
    Permissions.has(permission, item.bit),
  );

  return (
    <>
      <nav className="flex min-w-0 gap-1.5 overflow-x-auto border-b border-[#e5eaf0] bg-white px-4 py-2.5 md:hidden">
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

      <aside className="hidden min-h-full w-60 shrink-0 flex-col border-r border-[#e5eaf0] bg-white px-3 py-6 text-app-text-strong md:flex">
        <div className="px-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Admin</div>
        <div className="mt-1 px-3 text-base font-semibold tracking-tight text-slate-900">관리자 메뉴</div>

        <nav className="mt-6 flex flex-col gap-0.5">
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
