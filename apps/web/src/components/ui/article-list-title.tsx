import type { ReactNode } from "react";
export function ArticleListTitle({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <span className={`line-clamp-2 min-w-0 text-[length:var(--ui-text-section-size)] font-medium leading-5 text-app-text-strong md:truncate ${className}`}>{children}</span>;
}
