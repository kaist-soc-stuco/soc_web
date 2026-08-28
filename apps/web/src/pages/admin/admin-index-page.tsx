import { Navigate } from "react-router-dom";

import { useCurrentSession } from "@/hooks/use-current-session";
import { Permissions } from "@/lib/permissions";

const ADMIN_ENTRY_ROUTES = [
  { to: "surveys", bits: [Permissions.MANAGE_SURVEY, Permissions.MANAGE_POLL] },
  { to: "users", bits: [Permissions.MANAGE_USERS] },
  { to: "audit-logs", bits: [Permissions.VIEW_AUDIT_LOG] },
  { to: "content", bits: [Permissions.MANAGE_SITE_CONTENT] },
  { to: "calendar", bits: [Permissions.MANAGE_CALENDAR] },
  { to: "contacts", bits: [Permissions.MANAGE_CONTACTS] },
  { to: "emails", bits: [Permissions.SEND_EMAIL] },
  { to: "permissions", bits: [Permissions.MANAGE_PERMISSIONS] },
  { to: "finance", bits: [Permissions.MANAGE_FINANCE] },
  { to: "boards", bits: [Permissions.MANAGE_BOARD_SETTINGS] },
];

export function AdminIndexPage() {
  const { data: session, isLoading } = useCurrentSession();

  if (isLoading) {
    return null;
  }

  const permission = session?.permission ?? 0;
  const entry = ADMIN_ENTRY_ROUTES.find((route) =>
    Permissions.hasAny(permission, ...route.bits),
  );

  if (!entry) {
    return <Navigate to="/mypage" replace />;
  }

  return <Navigate to={entry.to} replace />;
}
