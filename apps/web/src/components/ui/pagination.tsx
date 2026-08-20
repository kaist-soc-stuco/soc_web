import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

export type PaginationItem = number | "...";

export function getPaginationItems(
  currentPage: number,
  totalPages: number,
): PaginationItem[] {
  const items: PaginationItem[] = [];
  const total = Math.max(1, totalPages || 1);

  if (total <= 7) {
    for (let page = 1; page <= total; page += 1) {
      items.push(page);
    }
    return items;
  }

  if (currentPage <= 4) {
    for (let page = 1; page <= 5; page += 1) {
      items.push(page);
    }
    items.push("...");
    items.push(total);
    return items;
  }

  if (currentPage >= total - 3) {
    items.push(1);
    items.push("...");
    for (let page = total - 4; page <= total; page += 1) {
      items.push(page);
    }
    return items;
  }

  items.push(1);
  items.push("...");
  items.push(currentPage - 1);
  items.push(currentPage);
  items.push(currentPage + 1);
  items.push("...");
  items.push(total);
  return items;
}

interface PaginationProps {
  className?: string;
  currentPage: number;
  lang?: string;
  onPageChange: (page: number) => void;
  size?: "sm" | "md";
  totalPages: number;
}

export function Pagination({
  className,
  currentPage,
  lang = "ko",
  onPageChange,
  size = "md",
  totalPages,
}: PaginationProps) {
  const total = Math.max(1, totalPages || 1);
  const isSmall = size === "sm";
  const buttonSizeClassName = isSmall ? "h-8 w-8 rounded-md" : "h-9 w-9 rounded-md";

  return (
    <nav
      aria-label={lang === "ko" ? "페이지 탐색" : "Pagination"}
      className={cn("flex items-center gap-1", className)}
    >
      <button
        type="button"
        aria-label={lang === "ko" ? "이전 페이지" : "Previous page"}
        onClick={() => onPageChange(Math.max(1, currentPage - 1))}
        disabled={currentPage === 1}
        className={cn(
          buttonSizeClassName,
          "flex items-center justify-center border transition-all",
          currentPage === 1
            ? "cursor-not-allowed border-slate-100 bg-white text-slate-300"
            : "cursor-pointer border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900",
        )}
      >
        <ChevronLeft className="h-4 w-4 stroke-[2.5px]" />
      </button>

      <div className="flex items-center gap-0.5">
        {getPaginationItems(currentPage, total).map((item, index) => {
          if (item === "...") {
            return (
              <span
                key={`dots-${index}`}
                className={cn(
                  buttonSizeClassName,
                  "flex items-center justify-center px-1.5 text-xs text-slate-400 select-none",
                )}
              >
                ...
              </span>
            );
          }

          const isActive = currentPage === item;
          return (
            <button
              key={item}
              type="button"
              onClick={() => onPageChange(item)}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                buttonSizeClassName,
                "flex cursor-pointer items-center justify-center text-[13px] font-semibold tracking-tight transition-colors",
                isActive
                  ? "bg-brand-primary text-white"
                  : "bg-transparent text-slate-500 hover:text-slate-800",
              )}
            >
              {item}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        aria-label={lang === "ko" ? "다음 페이지" : "Next page"}
        onClick={() => onPageChange(Math.min(total, currentPage + 1))}
        disabled={currentPage === total}
        className={cn(
          buttonSizeClassName,
          "flex items-center justify-center border transition-all",
          currentPage === total
            ? "cursor-not-allowed border-slate-100 bg-white text-slate-300"
            : "cursor-pointer border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900",
        )}
      >
        <ChevronRight className="h-4 w-4 stroke-[2.5px]" />
      </button>
    </nav>
  );
}
