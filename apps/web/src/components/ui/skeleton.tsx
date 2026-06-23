import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export function Skeleton({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn("animate-pulse rounded-md bg-slate-200/70", className)}
      {...props}
    />
  );
}

interface TableSkeletonProps {
  className?: string;
  columns?: number;
  rows?: number;
}

export function TableSkeleton({
  className,
  columns = 5,
  rows = 6,
}: TableSkeletonProps) {
  const columnItems = Array.from({ length: columns });
  const rowItems = Array.from({ length: rows });

  return (
    <div className={cn("min-w-full animate-pulse", className)}>
      <div
        className="grid gap-4 border-b border-slate-100 bg-slate-50/60 px-5 py-4"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {columnItems.map((_, index) => (
          <Skeleton
            key={index}
            className={cn("h-3 rounded", index === 0 ? "w-20" : "w-16")}
          />
        ))}
      </div>
      <div className="divide-y divide-slate-100">
        {rowItems.map((_, rowIndex) => (
          <div
            key={rowIndex}
            className="grid gap-4 px-5 py-4"
            style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
          >
            {columnItems.map((__, columnIndex) => (
              <Skeleton
                key={columnIndex}
                className={cn(
                  "h-4 rounded",
                  columnIndex === 0 ? "w-28" : "w-full max-w-32",
                )}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
