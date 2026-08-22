import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface SectionHeaderProps {
  action?: ReactNode;
  className?: string;
  navigation?: ReactNode;
  title?: ReactNode;
}

export function SectionHeader({
  action,
  className,
  navigation,
  title,
}: SectionHeaderProps) {
  return (
    <header
      className={cn(
        "flex h-12 shrink-0 items-center gap-4 border-b border-slate-100 px-3",
        className,
      )}
    >
      {title ? (
        <h2 className="shrink-0 text-xs font-extrabold tracking-[-0.015em] text-slate-950">
          {title}
        </h2>
      ) : null}
      {navigation ? <div className="min-w-0 flex-1">{navigation}</div> : <div className="flex-1" />}
      {action}
    </header>
  );
}
