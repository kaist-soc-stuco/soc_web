import * as React from "react";

import { cn } from "@/lib/utils";

type IconButtonSize = "sm" | "md" | "lg";

const sizeClasses: Record<IconButtonSize, string> = {
  sm: "h-8 w-8",
  md: "h-[var(--ui-control-height)] w-[var(--ui-control-height)]",
  lg: "h-[var(--ui-control-height)] w-[var(--ui-control-height)]",
};

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  size?: IconButtonSize;
  tone?: "ghost" | "outline" | "navigation" | "table-action";
  "data-tooltip"?: string;
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, size = "md", tone = "ghost", type = "button", ...props }, ref) => {
    const tooltip = props["data-tooltip"];

    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          "ui-icon-button interaction-button inline-flex shrink-0 cursor-pointer select-none items-center justify-center rounded-lg text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/30 focus-visible:ring-offset-1 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-45",
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
        data-tooltip={tooltip}
        {...props}
      />
    );
  },
);

IconButton.displayName = "IconButton";
