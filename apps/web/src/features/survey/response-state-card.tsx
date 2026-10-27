import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export const responseStateActionClassName = "w-36 shrink-0 !rounded-full !shadow-none";

export function ResponseStateCard({ icon: Icon, title, description, children, actions, mobileAction, className, embedded = false, tone = "neutral", role, headingAs: Heading = "h2" }: {
  icon: LucideIcon;
  title: string;
  description: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  mobileAction?: ReactNode;
  className?: string;
  embedded?: boolean;
  tone?: "neutral" | "success" | "warning";
  role?: "alert";
  headingAs?: "h1" | "h2";
}) {
  return <div className={cn(
    "response-state-view mx-auto flex w-full max-w-[42rem] flex-col items-center justify-center text-center",
    !embedded && "min-h-[22rem] rounded-2xl border border-slate-200 bg-white px-6 py-8 sm:px-8",
    className,
  )} role={role}>
    <div className={cn("mb-4 flex size-12 shrink-0 items-center justify-center rounded-2xl",
      tone === "success" ? "bg-emerald-50 text-emerald-700" : tone === "warning" ? "bg-amber-50 text-amber-600" : "bg-slate-100 text-slate-500",
    )}><Icon aria-hidden="true" className="size-6" strokeWidth={1.7} /></div>
    <Heading className="max-w-full break-keep text-xl font-semibold leading-7 text-slate-900">{title}</Heading>
    <p className="mt-2 max-w-md break-keep text-sm font-normal leading-6 text-slate-500">{description}</p>
    {children ? <div className="response-state-details mt-6 flex w-full flex-col items-center gap-3">{children}</div> : null}
    {actions || mobileAction ? <div className={cn("response-state-actions flex w-full flex-col items-center gap-3", children ? "mt-3" : "mt-6", !actions && "md:hidden")}>
      {actions ? <div className={cn("contents", mobileAction && "max-md:hidden")}>{actions}</div> : null}
      {mobileAction ? <div className="contents md:hidden">{mobileAction}</div> : null}
    </div> : null}
  </div>;
}
