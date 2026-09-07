import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { FilterSheet } from "@/components/ui/filter-sheet";
import { cn } from "@/lib/utils";

export interface MobileSectionOption {
  label: string;
  value: string;
}

interface MobileSectionSelectorProps {
  ariaLabel: string;
  className?: string;
  closeLabel?: string;
  onChange: (value: string) => void;
  options: MobileSectionOption[];
  title: string;
  value: string;
}

/**
 * Replaces clipped horizontal section tabs on narrow viewports with an
 * explicit, discoverable option list. Desktop keeps the existing tab pattern.
 */
export function MobileSectionSelector({
  ariaLabel,
  className,
  closeLabel,
  onChange,
  options,
  title,
  value,
}: MobileSectionSelectorProps) {
  const [open, setOpen] = useState(false);
  const selectedOption = options.find((option) => option.value === value);

  return (
    <div className={cn("md:hidden", className)}>
      <Button
        type="button"
        variant="outline"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className="interaction-control h-[var(--ui-control-height)] w-full justify-between rounded-[var(--ui-control-radius)] border-[var(--ui-border-subtle)] bg-white px-3 text-left text-[length:var(--ui-control-font-size)] font-medium text-app-text-strong"
      >
        <span className="min-w-0 truncate">
          {selectedOption?.label ?? options[0]?.label ?? ""}
        </span>
        <ChevronDown
          aria-hidden="true"
          className={cn(
            "size-4 shrink-0 text-slate-400 transition-transform",
            open && "rotate-180 text-brand-primary",
          )}
        />
      </Button>

      <FilterSheet
        closeLabel={closeLabel ?? `${title} 닫기`}
        onClose={() => setOpen(false)}
        open={open}
        title={title}
      >
        <div className="space-y-2 pb-1">
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <Button
                key={option.value}
                type="button"
                variant="ghost"
                aria-pressed={isSelected}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className={cn(
                  "min-h-[var(--ui-control-height)] w-full justify-between rounded-[var(--ui-control-radius)] border px-3 text-left text-[length:var(--ui-control-font-size)] font-medium",
                  isSelected
                    ? "border-emerald-200 bg-emerald-50 text-brand-primary"
                    : "border-slate-200 bg-white text-slate-700",
                )}
              >
                <span className="min-w-0 truncate">{option.label}</span>
                {isSelected ? (
                  <Check aria-hidden="true" className="size-4 shrink-0" />
                ) : null}
              </Button>
            );
          })}
        </div>
      </FilterSheet>
    </div>
  );
}
