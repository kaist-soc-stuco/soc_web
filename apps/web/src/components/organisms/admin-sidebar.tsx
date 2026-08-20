import { Link, useLocation } from "react-router-dom";
import {
  ClipboardList,
  ContactRound,
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
  { label: "설문조사 관리", to: "/admin/surveys", bit: Permissions.MANAGE_SURVEY, icon: ClipboardList },
  { label: "유저 관리", to: "/admin/users", bit: Permissions.ADMIN, icon: Users },
  { label: "운영 로그", to: "/admin/audit-logs", bit: Permissions.ADMIN, icon: ScrollText },
  { label: "사이트 콘텐츠", to: "/admin/content", bit: Permissions.MANAGE_CONTENT, icon: PanelsTopLeft },
  { label: "집행위연락망 관리", to: "/admin/contacts", bit: Permissions.MANAGE_CONTENT, icon: ContactRound },
  { label: "이메일 일괄발송", to: "/admin/emails", bit: Permissions.ADMIN, icon: Mail },
  { label: "권한 관리", to: "/admin/permissions", bit: Permissions.ADMIN, icon: ShieldCheck },
  { label: "과비 납부 관리", to: "/admin/finance", bit: Permissions.MANAGE_FINANCE, icon: WalletCards },
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
      <nav className="flex gap-2 overflow-x-auto border-b border-slate-200 bg-white px-4 py-3 md:hidden">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname.startsWith(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-md border px-3 py-2 text-xs font-semibold transition-colors ${
                isActive
                  ? "border-brand-primary bg-brand-primary text-white"
                  : "border-slate-200 text-app-text-body hover:bg-brand-primary-light"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <aside className="hidden min-h-full w-56 flex-col border-r border-slate-200 bg-white px-4 py-6 text-app-text-strong md:flex">
        <div className="text-xs font-semibold tracking-[0.2em] text-app-text-muted">ADMIN</div>
        <div className="mt-2 text-lg font-semibold">관리자 메뉴</div>

        <nav className="mt-8 flex flex-col gap-1">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
              className={`flex min-h-10 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-brand-primary-light font-semibold text-brand-primary"
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
