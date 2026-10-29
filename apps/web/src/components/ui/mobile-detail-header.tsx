import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

export function MobileDetailHeader({ title, backTo, lang, actions }: { title: string; backTo: string; lang: string; actions?: ReactNode }) {
  return <header className="mobile-detail-header md:hidden">
    <Link to={backTo} aria-label={lang === "ko" ? "목록으로" : "Back to list"}><ArrowLeft aria-hidden="true" strokeWidth={1.5} /></Link>
    <span className="mobile-detail-header-title">{title}</span>
    <div className="mobile-detail-header-actions">{actions}</div>
  </header>;
}
