import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface SegmentedControlOption<T extends string = string> {
  disabled?: boolean;
  label: ReactNode;
  value: T;
}

interface SegmentedControlProps<T extends string> {
  ariaLabel: string;
  className?: string;
  itemClassName?: string;
  onChange: (value: T) => void;
  options: readonly SegmentedControlOption<T>[];
  role?: "group" | "tablist";
  value: T;
}

export function SegmentedControl<T extends string>({
  ariaLabel,
  className,
  itemClassName,
  onChange,
  options,
  role = "group",
  value,
}: SegmentedControlProps<T>) {
  const isTablist = role === "tablist";

  return (
    <div
      aria-label={ariaLabel}
      className={cn("ui-segmented-control filter-chips", className)}
      role={role}
    >
      {options.map((option) => {
        const active = option.value === value;

        return (
          <Button
            key={option.value}
            type="button"
            variant="ghost"
            size="sm"
            aria-pressed={isTablist ? undefined : active}
            aria-selected={isTablist ? active : undefined}
            disabled={option.disabled}
            onClick={() => onChange(option.value)}
            role={isTablist ? "tab" : undefined}
            className={cn(
              "!h-[var(--ui-page-tab-height)] !min-h-[var(--ui-page-tab-height)] !font-normal",
              itemClassName,
              active && "is-active",
            )}
          >
            {option.label}
          </Button>
        );
      })}
    </div>
  );
}
