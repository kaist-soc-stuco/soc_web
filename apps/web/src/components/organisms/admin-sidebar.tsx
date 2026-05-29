import { Link, useLocation } from "react-router-dom";
import {
  ClipboardList,
  ContactRound,
  Mail,
  ShieldCheck,
  WalletCards,
} from "lucide-react";

import { Permissions } from "@/lib/permissions";
import { useCurrentSession } from "@/hooks/use-current-session";

const ADMIN_MENU = [
  { label: "설문조사 관리", to: "/admin/surveys", bit: Permissions.MANAGE_SURVEY, icon: ClipboardList },
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
      <nav className="flex md:hidden gap-2 overflow-x-auto border-b border-kaist-grey/20 bg-white px-4 py-3">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname.startsWith(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-bold transition-colors ${
                isActive
                  ? "border-kaist-darkgreen bg-kaist-darkgreen text-white"
                  : "border-kaist-grey/20 text-kaist-black hover:bg-kaist-darkgreen/5"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <aside className="hidden md:flex w-56 min-h-full bg-kaist-darkgreen text-white flex-col px-5 py-6">
        <div className="text-xs font-extrabold tracking-[0.3em] text-white/70">ADMIN</div>
        <div className="mt-2 text-lg font-black">관리자 메뉴</div>

        <nav className="mt-8 flex flex-col gap-1">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                  isActive
                    ? "bg-white text-kaist-darkgreen"
                    : "text-white/85 hover:bg-white/10"
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
