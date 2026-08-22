import { Navigate } from "react-router-dom";

import { useCurrentSession } from "@/hooks/use-current-session";
import { Permissions } from "@/lib/permissions";

const ADMIN_ENTRY_ROUTES = [
  { to: "surveys", bit: Permissions.MANAGE_SURVEY },
  { to: "users", bit: Permissions.ADMIN },
  { to: "audit-logs", bit: Permissions.ADMIN },
  { to: "content", bit: Permissions.MANAGE_CONTENT },
  { to: "contacts", bit: Permissions.MANAGE_CONTENT },
  { to: "emails", bit: Permissions.ADMIN },
  { to: "permissions", bit: Permissions.ADMIN },
  { to: "finance", bit: Permissions.MANAGE_FINANCE },
  { to: "boards", bit: Permissions.ADMIN },
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
