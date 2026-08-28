import { Link } from "react-router-dom";
import { CalendarCog } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useCurrentSession } from "@/hooks/use-current-session";
import { Permissions } from "@/lib/permissions";

export function EventsSurveysCalendarManagement() {
  const { data: session } = useCurrentSession();
  const canManage = Permissions.has(
    session?.permission ?? 0,
    Permissions.MANAGE_CALENDAR,
  );

  if (!canManage) return null;

  return (
    <Button asChild variant="outline" size="sm" className="h-9 min-h-9 gap-1.5 px-3 text-xs font-normal">
      <Link to="/admin/calendar">
        <CalendarCog className="size-4" aria-hidden="true" />
        일정 관리
      </Link>
    </Button>
  );
}
