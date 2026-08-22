import * as React from "react";

import { cn } from "@/lib/utils";

type IconButtonSize = "sm" | "md" | "lg";

const sizeClasses: Record<IconButtonSize, string> = {
  sm: "h-8 w-8",
  md: "h-[var(--ui-control-height-compact)] w-[var(--ui-control-height-compact)]",
  lg: "h-[var(--ui-control-height)] w-[var(--ui-control-height)]",
};

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  size?: IconButtonSize;
  tone?: "ghost" | "outline" | "navigation" | "table-action";
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, size = "md", tone = "ghost", type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(
        "ui-icon-button interaction-button inline-flex shrink-0 items-center justify-center rounded-lg text-slate-600 disabled:pointer-events-none disabled:opacity-45",
        sizeClasses[size],
        tone === "outline"
          ? "border border-slate-200 bg-white shadow-card hover:bg-slate-50 hover:text-slate-900"
          : tone === "navigation"
            ? "bg-transparent shadow-none hover:bg-slate-100 hover:text-slate-900"
            : tone === "table-action"
              ? "border-0 bg-transparent text-slate-400 shadow-none hover:border-0 hover:bg-slate-50 hover:text-slate-600"
            : "border border-transparent bg-transparent hover:border-slate-200 hover:bg-slate-50 hover:text-slate-900",
        className,
      )}
      {...props}
    />
  ),
);

IconButton.displayName = "IconButton";
