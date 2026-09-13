import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
export function EditorBackButton({ to, beforeLeave }: { to: string; beforeLeave?: () => Promise<unknown> }) {
  const navigate = useNavigate();
  return <button type="button" className="inline-flex items-center gap-1 text-[length:var(--ui-text-caption-size)] font-semibold text-slate-500 transition-colors hover:text-brand-primary" onClick={() => { if (beforeLeave) void beforeLeave().then(() => navigate(to)).catch(() => undefined); else navigate(to); }}><ArrowLeft className="size-3.5" />목록으로</button>;
}
