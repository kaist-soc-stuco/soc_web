import type { ReactNode } from "react";
export function ArticleListTitle({ children }: { children: ReactNode }) {
  return <span className="line-clamp-2 min-w-0 text-[length:var(--ui-text-section-size)] font-medium leading-5 text-app-text-strong md:truncate">{children}</span>;
}
