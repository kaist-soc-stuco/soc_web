import { ArrowLeft } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

export function BackToListLink({to, lang = "ko", beforeLeave}: {to:string; lang?:string; beforeLeave?:()=>Promise<unknown>}) {
  const navigate = useNavigate();
  return <Link to={to} onClick={event => { if (beforeLeave && !event.metaKey && !event.ctrlKey && !event.shiftKey && event.button === 0) { event.preventDefault(); void beforeLeave().then(() => navigate(to)).catch(() => undefined); } }} className="inline-flex min-h-11 items-center gap-1.5 self-start rounded-md px-2.5 text-[length:var(--ui-text-body-sm-size)] font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"><ArrowLeft className="size-4" aria-hidden="true" />{lang === "ko" ? "목록으로" : "Back to list"}</Link>;
}
