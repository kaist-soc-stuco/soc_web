import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/utils";

export function AdminActionMenuPanel({
  children,
  className,
  ...props
}: ComponentProps<"div"> & { children: ReactNode }) {
  return (
    <div
      role="menu"
      className={cn(
        "w-40 overflow-hidden rounded-lg border border-slate-200 bg-white p-1.5 shadow-[0_8px_24px_rgb(15_23_42_/_0.10)]",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function AdminActionMenuItem({
  children,
  className,
  icon,
  tone = "default",
  ...props
}: ComponentProps<"button"> & {
  children: ReactNode;
  icon?: ReactNode;
  tone?: "default" | "danger";
}) {
  return (
    <button
      type="button"
      role="menuitem"
      className={cn(
        "flex h-9 w-full items-center justify-start gap-2 rounded-md px-2.5 text-left text-[13px] font-normal transition-colors disabled:cursor-not-allowed disabled:opacity-40",
        tone === "danger"
          ? "text-rose-600 hover:bg-rose-50"
          : "text-[#344054] hover:bg-slate-50 hover:text-[#172033]",
        className,
      )}
      {...props}
    >
      {icon ? <span className="inline-flex size-4 shrink-0 items-center justify-center [&_svg]:size-4">{icon}</span> : null}
      <span className="truncate">{children}</span>
    </button>
  );
}

export function AdminActionMenuDivider() {
  return <div className="my-1 border-t border-slate-100" aria-hidden="true" />;
}
