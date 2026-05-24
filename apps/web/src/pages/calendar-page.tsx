import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

export function CalendarPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const selected = searchParams.get("selected");

  useEffect(() => {
    const dest = selected 
      ? `/events-surveys?tab=calendar&selected=${selected}`
      : "/events-surveys?tab=calendar";
    navigate(dest, { replace: true });
  }, [navigate, selected]);

  return null;
}
