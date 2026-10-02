import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

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
  variant?: "pill" | "underline";
}

export function SegmentedControl<T extends string>({
  ariaLabel,
  className,
  itemClassName,
  onChange,
  options,
  role = "group",
  value,
  variant = "pill",
}: SegmentedControlProps<T>) {
  const isTablist = role === "tablist";
  const containerRef = useRef<HTMLDivElement>(null);
  const [indicator, setIndicator] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  useLayoutEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    const measure = () => {
      const active = root.querySelector<HTMLButtonElement>("button.is-active");
      const next = active ? { left: active.offsetLeft, top: active.offsetTop, width: active.offsetWidth, height: active.offsetHeight } : null;
      setIndicator(previous => previous?.left === next?.left && previous?.top === next?.top && previous?.width === next?.width && previous?.height === next?.height ? previous : next);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    Array.from(root.querySelectorAll("button")).forEach(button => observer.observe(button));
    return () => observer.disconnect();
  }, [options, value, variant]);

  return (
    <div
      ref={containerRef}
      aria-label={ariaLabel}
      className={cn(variant === "underline" ? "ui-view-tabs" : "ui-segmented-control filter-chips", className)}
      role={role}
      onKeyDown={isTablist ? event => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
        const tabs = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]:not(:disabled)'));
        if (!tabs.length) return;
        const index = tabs.indexOf(document.activeElement as HTMLButtonElement);
        if (index < 0) return;
        event.preventDefault();
        const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
        tabs[next].focus(); tabs[next].click();
      } : undefined}
    >
      {indicator ? <span aria-hidden="true" className={variant === "pill" ? "ui-segmented-indicator" : "ui-view-tab-indicator"} style={{ transform: `translateX(${indicator.left}px)`, top: variant === "pill" ? indicator.top : undefined, width: indicator.width, height: variant === "pill" ? indicator.height : undefined }} /> : null}
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
            tabIndex={isTablist ? (active || (!options.some(item => item.value === value && !item.disabled) && option === options.find(item => !item.disabled)) ? 0 : -1) : undefined}
            className={cn(
              "!h-[var(--ui-page-tab-height)] !min-h-[var(--ui-page-tab-height)]",
              variant === "underline" ? "![font-weight:var(--ui-view-tab-weight,500)]" : "![font-weight:var(--ui-segmented-weight,500)]",
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
