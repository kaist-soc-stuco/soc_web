import type { LucideIcon } from "lucide-react";

/** Public mobile pages share the same quiet, centered empty-state treatment. */
export function MobileEmptyState({ icon: Icon, message, className = "" }: { icon: LucideIcon; message: string; className?: string }) {
  return <div className={`mobile-public-empty-state md:hidden ${className}`} role="status">
    <Icon aria-hidden="true" strokeWidth={1.5} />
    <p>{message}</p>
  </div>;
}
