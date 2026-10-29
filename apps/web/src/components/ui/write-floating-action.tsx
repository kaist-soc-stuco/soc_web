import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { SquarePen } from "lucide-react";

export function WriteFloatingAction({
  to,
  label,
}: {
  to: string;
  label: string;
}) {
  useEffect(() => {
    document.body.classList.add("board-write-fab-visible");
    return () => document.body.classList.remove("board-write-fab-visible");
  }, []);
  return createPortal(
    <Link to={to} className="board-write-fab" aria-label={label}>
      <SquarePen aria-hidden="true" className="size-6" strokeWidth={1.5} />
    </Link>,
    document.body,
  );
}
