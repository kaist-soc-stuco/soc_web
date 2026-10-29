import { Permissions } from "@soc/contracts";

export const MOBILE_ADMIN_PATHS = [
  "/admin/moderation",
  "/admin/calendar",
  "/admin/contacts",
  "/admin/faq",
  "/admin/boards",
];

export function isMobileAdminRoute(pathname: string): boolean {
  return MOBILE_ADMIN_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

export const MOBILE_ADMIN_HOME = "/admin/moderation";

export function getMobileAdminHome(permission: number): string | null {
  const routes: [string, number][] = [
    ["/admin/moderation", Permissions.MODERATE_CONTENT],
    ["/admin/calendar", Permissions.MANAGE_CALENDAR],
    ["/admin/contacts", Permissions.MANAGE_CONTACTS],
    ["/admin/faq", Permissions.MANAGE_SITE_CONTENT],
    ["/admin/boards", Permissions.MANAGE_BOARDS],
  ];
  return (
    routes.find(([, bit]) => Permissions.has(permission, bit))?.[0] ?? null
  );
}
