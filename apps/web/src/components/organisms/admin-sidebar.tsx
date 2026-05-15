import { Link, useLocation } from "react-router-dom";

import { Permissions } from "@/lib/permissions";
import { useCurrentSession } from "@/hooks/use-current-session";

const ADMIN_MENU = [
  { label: "설문조사 관리", to: "/admin/surveys", bit: Permissions.MANAGE_SURVEY },
  { label: "권한 관리", to: "/admin/permissions", bit: Permissions.ADMIN },
  { label: "과비 납부 관리", to: "/admin/finance", bit: Permissions.MANAGE_FINANCE },
];

export function AdminSidebar() {
  const location = useLocation();
  const { data: session } = useCurrentSession();
  const permission = session?.permission ?? 0;

  const canShow = Permissions.hasAny(
    permission,
    Permissions.MANAGE_SURVEY,
    Permissions.MANAGE_FINANCE,
    Permissions.ADMIN,
  );

  if (!canShow) {
    return null;
  }

  return (
    <aside className="hidden md:flex w-56 min-h-full bg-kaist-darkgreen text-white flex-col px-5 py-6">
      <div className="text-xs font-extrabold tracking-[0.3em] text-white/70">ADMIN</div>
      <div className="mt-2 text-lg font-black">관리자 메뉴</div>

      <nav className="mt-8 flex flex-col gap-1">
        {ADMIN_MENU.map((item) => {
          if (!Permissions.has(permission, item.bit)) {
            return null;
          }
          const isActive = location.pathname.startsWith(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                isActive
                  ? "bg-white text-kaist-darkgreen"
                  : "text-white/85 hover:bg-white/10"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
