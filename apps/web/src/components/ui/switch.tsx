import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

export function Switch({ checked, onCheckedChange, className, ...props }: Omit<ComponentProps<"button">, "onChange"> & {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return <button {...props} type="button" role="switch" aria-checked={checked}
    onClick={() => onCheckedChange(!checked)}
    className={cn("relative inline-flex h-6 w-10 shrink-0 items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary disabled:opacity-50 motion-reduce:transition-none", checked ? "bg-brand-primary" : "bg-slate-200", className)}>
    <span aria-hidden="true" className={cn("size-5 rounded-full bg-white transition-transform motion-reduce:transition-none", checked ? "translate-x-4" : "translate-x-0")} />
  </button>;
}
