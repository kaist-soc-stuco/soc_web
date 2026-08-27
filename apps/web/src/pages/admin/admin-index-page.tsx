import { Navigate } from "react-router-dom";

import { useCurrentSession } from "@/hooks/use-current-session";
import { Permissions } from "@/lib/permissions";

const ADMIN_ENTRY_ROUTES = [
  { to: "surveys", bit: Permissions.MANAGE_SURVEY },
  { to: "users", bit: Permissions.MANAGE_USERS },
  { to: "audit-logs", bit: Permissions.VIEW_AUDIT_LOG },
  { to: "content", bit: Permissions.MANAGE_SITE_CONTENT },
  { to: "calendar", bit: Permissions.MANAGE_CALENDAR },
  { to: "contacts", bit: Permissions.MANAGE_CONTACTS },
  { to: "emails", bit: Permissions.SEND_BULK_EMAIL },
  { to: "permissions", bit: Permissions.MANAGE_ROLES },
  { to: "finance", bit: Permissions.MANAGE_FINANCE },
  { to: "boards", bit: Permissions.MANAGE_BOARDS },
  { to: "moderation", bit: Permissions.MODERATE_CONTENT },
];

export function AdminIndexPage() {
  const { data: session, isLoading } = useCurrentSession();

  if (isLoading) {
    return null;
  }

  const permission = session?.permission ?? 0;
  const entry = ADMIN_ENTRY_ROUTES.find((route) =>
    Permissions.has(permission, route.bit),
  );

  if (!entry) {
    return <Navigate to="/mypage" replace />;
  }

  return <Navigate to={entry.to} replace />;
}
