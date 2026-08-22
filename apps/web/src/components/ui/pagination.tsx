import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { AdminSelectDropdown } from "@/components/ui/admin-select";
import { UiInput } from "@/components/ui/form-control";
import { IconButton } from "@/components/ui/icon-button";
import { cn } from "@/lib/utils";

interface PageSizeSelectProps {
  className?: string;
  lang?: string;
  onChange: (value: number) => void;
  options?: readonly number[];
  value: number;
}

export function PageSizeSelect({
  className = "w-36",
  lang = "ko",
  onChange,
  options = [20, 50, 100],
  value,
}: PageSizeSelectProps) {
  return (
    <AdminSelectDropdown
      ariaLabel={lang === "ko" ? "페이지당 표시 개수" : "Items per page"}
      value={String(value)}
      options={options.map((option) => ({
        value: String(option),
        label: lang === "ko" ? `${option}개씩 보기` : `${option} per page`,
      }))}
      onChange={(nextValue) => onChange(Number(nextValue))}
      className={className}
      emptyLabel={lang === "ko" ? "선택지가 없습니다." : "No options."}
    />
  );
}

interface PaginationProps {
  className?: string;
  currentPage: number;
  lang?: string;
  onPageChange: (page: number) => void;
  pageSizeControl?: ReactNode;
  range?: ReactNode;
  size?: "sm" | "md";
  totalPages: number;
  variant?: "default" | "compact";
}

export function Pagination({
  className,
  currentPage,
  lang = "ko",
  onPageChange,
  pageSizeControl,
  range,
  totalPages,
}: PaginationProps) {
  const total = Math.max(1, totalPages || 1);
  const safePage = Math.min(Math.max(currentPage, 1), total);
  const [pageDraft, setPageDraft] = useState(String(safePage));
  const previousPage = useRef(safePage);

  useEffect(() => {
    if (previousPage.current === safePage) return;
    previousPage.current = safePage;
    setPageDraft(String(safePage));
  }, [safePage]);

  const changePage = (nextPage: number) => {
    const resolvedPage = Math.min(Math.max(nextPage, 1), total);
    if (resolvedPage !== safePage) onPageChange(resolvedPage);
  };

  const commitPage = (value: string) => {
    const requestedPage = Number(value);
    if (!Number.isInteger(requestedPage) || requestedPage < 1) {
      setPageDraft(String(safePage));
      return;
    }

    const resolvedPage = Math.min(requestedPage, total);
    setPageDraft(String(resolvedPage));
    changePage(resolvedPage);
  };

  return (
    <nav
      aria-label={lang === "ko" ? "페이지 이동" : "Pagination"}
      className={cn("data-table-pagination ui-pagination", className)}
    >
      {pageSizeControl || range !== undefined ? (
        <div className="data-table-pagination__summary ui-pagination__summary">
          {pageSizeControl}
          {range !== undefined ? (
            <span className="data-table-pagination__range ui-pagination__range">{range}</span>
          ) : null}
        </div>
      ) : null}

      <div className="data-table-pagination__controls ui-pagination__controls">
        <IconButton
          tone="navigation"
          size="md"
          aria-label={lang === "ko" ? "이전 페이지" : "Previous page"}
          onClick={() => changePage(safePage - 1)}
          disabled={safePage <= 1}
          className="data-table-pagination__previous ui-pagination__previous"
        >
          <ChevronLeft aria-hidden="true" size={16} />
        </IconButton>

        <label className="data-table-pagination__input-label ui-pagination__input-label">
          <span className="sr-only">{lang === "ko" ? "현재 페이지" : "Current page"}</span>
          <UiInput
            key={safePage}
            inputMode="numeric"
            type="text"
            value={pageDraft}
            aria-label={lang === "ko" ? "페이지 번호" : "Page number"}
            onChange={(event) => setPageDraft(event.currentTarget.value.replace(/\D/g, ""))}
            onBlur={(event) => commitPage(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              commitPage(event.currentTarget.value);
              event.currentTarget.blur();
            }}
          />
        </label>

        <span className="data-table-pagination__total-pages ui-pagination__total-pages" aria-hidden="true">
          <span>/</span>
          <span>{total}</span>
        </span>

        <IconButton
          tone="navigation"
          size="md"
          aria-label={lang === "ko" ? "다음 페이지" : "Next page"}
          onClick={() => changePage(safePage + 1)}
          disabled={safePage >= total}
          className="data-table-pagination__next ui-pagination__next"
        >
          <ChevronRight aria-hidden="true" size={16} />
        </IconButton>
      </div>
    </nav>
  );
}
