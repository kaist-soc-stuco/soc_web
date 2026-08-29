import type { InputHTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/utils";

interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  containerClassName?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
}

export function TextInput({
  className,
  containerClassName,
  leading,
  trailing,
  ...props
}: TextInputProps) {
  return (
    <div
      className={cn(
        "interaction-control select-none flex h-10 min-w-0 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-slate-700",
        containerClassName,
      )}
    >
      {leading ? <span className="flex shrink-0 text-slate-400">{leading}</span> : null}
      <input
        className={cn(
          "select-text min-w-0 flex-1 bg-transparent text-[length:var(--ui-text-body-sm-size)] font-medium text-slate-900 outline-none placeholder:font-normal placeholder:text-slate-400",
          className,
        )}
        {...props}
      />
      {trailing}
    </div>
  );
}
