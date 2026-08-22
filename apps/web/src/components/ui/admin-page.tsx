import { Search } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

import { EmptyState } from "@/components/ui/data-state";
import { AdminSelectDropdown } from "@/components/ui/admin-select";
import { UiInput } from "@/components/ui/form-control";
import { AdminPageTitle } from "@/components/ui/page-layout";
import { cn } from "@/lib/utils";

interface AdminPageShellProps extends ComponentProps<"div"> {
  children: ReactNode;
}

export function AdminPageShell({ children, className, ...props }: AdminPageShellProps) {
  return (
    <div className={cn("admin-page min-h-full bg-[#f7f9fc] text-[#172033]", className)} {...props}>
      {children}
    </div>
  );
}

export function AdminPageMain({ className, ...props }: ComponentProps<"main">) {
  return (
    <main
      className={cn(
        "admin-page__main mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-5 py-7 md:px-8 xl:px-10",
        className,
      )}
      {...props}
    />
  );
}

interface AdminPageHeaderProps {
  actions?: ReactNode;
  eyebrow?: ReactNode;
  title: ReactNode;
}

export function AdminPageHeader({ actions, eyebrow, title }: AdminPageHeaderProps) {
  return (
    <header className="admin-page__header flex flex-col gap-4 border-b border-slate-200/80 pb-5 md:flex-row md:items-center md:justify-between">
      <div className="min-w-0">
        {eyebrow ? (
          <div className="mb-1.5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-primary">
            {eyebrow}
          </div>
        ) : null}
        <AdminPageTitle className="truncate text-[28px] leading-8 md:text-[30px] md:leading-9">
          {title}
        </AdminPageTitle>
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function AdminCard({ className, ...props }: ComponentProps<"section">) {
  return (
    <section
      className={cn(
        "admin-card overflow-hidden rounded-xl border border-[#e5eaf0] bg-white shadow-none",
        className,
      )}
      {...props}
    />
  );
}

interface AdminTableCardProps extends ComponentProps<"section"> {
  pagination?: ReactNode;
  toolbar?: ReactNode;
}

/**
 * A single surface for the controls, table and pagination of an admin list.
 * Keeping these regions together prevents filter/table cards from drifting
 * apart as each page evolves.
 */
export function AdminTableCard({
  children,
  className,
  pagination,
  toolbar,
  ...props
}: AdminTableCardProps) {
  return (
    <section
      className={cn(
        "admin-table-card overflow-hidden rounded-xl border border-[#e5eaf0] bg-white shadow-none",
        className,
      )}
      {...props}
    >
      {toolbar ? <div className="border-b border-slate-100">{toolbar}</div> : null}
      {children}
      {pagination ? <div className="border-t border-slate-100 bg-white px-5 py-3">{pagination}</div> : null}
    </section>
  );
}

export function AdminCardHeader({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex min-h-14 flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-3",
        className,
      )}
      {...props}
    />
  );
}

export function AdminToolbar({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "admin-toolbar flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#e5eaf0] bg-white px-4 py-3",
        className,
      )}
      {...props}
    />
  );
}

export function AdminToolbarGroup({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("flex min-w-0 flex-wrap items-center gap-2", className)}
      {...props}
    />
  );
}

interface AdminSearchFieldProps
  extends Omit<ComponentProps<"input">, "onChange" | "type"> {
  onValueChange?: (value: string) => void;
}

export function AdminSearchField({
  className,
  onValueChange,
  ...props
}: AdminSearchFieldProps) {
  return (
    <label className={cn("relative block min-w-0", className)}>
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
      />
      <UiInput
        type="search"
        className="w-full pl-9 pr-3"
        onChange={(event) => onValueChange?.(event.currentTarget.value)}
        {...props}
      />
    </label>
  );
}

export function AdminSectionTitle({ className, ...props }: ComponentProps<"h2">) {
  return (
    <h2
      className={cn("text-[15px] font-medium tracking-[-0.01em] text-[#172033]", className)}
      {...props}
    />
  );
}

export function AdminMetaText({ className, ...props }: ComponentProps<"span">) {
  return (
    <span className={cn("text-xs font-normal text-[#344054]", className)} {...props} />
  );
}

export function AdminFormField({
  children,
  className,
  hint,
  label,
  labelClassName,
  ...props
}: ComponentProps<"label"> & {
  hint?: ReactNode;
  label: ReactNode;
  labelClassName?: string;
}) {
  return (
    <label className={cn("grid min-w-0 gap-1.5", className)} {...props}>
      <span className={cn("text-xs font-medium leading-4 text-slate-600", labelClassName)}>{label}</span>
      {children}
      {hint ? <span className="text-xs font-normal leading-4 text-slate-500">{hint}</span> : null}
    </label>
  );
}

export function AdminTableViewport({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("admin-table-viewport min-w-0 overflow-x-auto", className)} {...props} />;
}

export function AdminStickyActionBar({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "sticky bottom-4 z-20 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white/95 px-4 py-3 shadow-[0_12px_36px_rgba(15,23,42,0.12)] backdrop-blur",
        className,
      )}
      {...props}
    />
  );
}

export function AdminPageSizeSelect({
  onChange,
  options = [20, 50, 100],
  value,
}: {
  onChange: (value: number) => void;
  options?: readonly number[];
  value: number;
}) {
  return (
    <AdminSelectDropdown
      ariaLabel="페이지당 표시 개수"
      value={String(value)}
      onChange={(nextValue) => onChange(Number(nextValue))}
      options={options.map((option) => ({ value: String(option), label: `${option}개씩 보기` }))}
      className="min-w-32"
    />
  );
}

export function AdminEmptyState({ message, className, ...props }: ComponentProps<"div"> & { message: string }) {
  return (
    <EmptyState
      message={message}
      className={cn("rounded-none border-0 bg-transparent py-16 text-slate-400", className)}
      {...props}
    />
  );
}
