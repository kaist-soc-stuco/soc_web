import { ArrowDown, MoreHorizontal } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

import { AdminTableViewport } from "@/components/ui/admin-page";
import { IconButton } from "@/components/ui/icon-button";
import { cn } from "@/lib/utils";

export function AdminDataTable({
  children,
  className,
  minWidth = 760,
  ...props
}: ComponentProps<"table"> & { minWidth?: number }) {
  return (
    <AdminTableViewport className="w-full">
      <table
        className={cn("admin-data-table w-full table-fixed text-left", className)}
        style={{ minWidth }}
        {...props}
      >
        {children}
      </table>
    </AdminTableViewport>
  );
}

export function AdminTableHeader({ className, ...props }: ComponentProps<"thead">) {
  return <thead className={cn("admin-data-table__header border-t-2 border-t-brand-primary bg-slate-50/70", className)} {...props} />;
}

export function AdminTableBody({ className, ...props }: ComponentProps<"tbody">) {
  return <tbody className={cn("admin-data-table__body", className)} {...props} />;
}

export function AdminTableHead({ className, ...props }: ComponentProps<"th">) {
  return <th className={cn("h-12 px-4 text-[14px] font-medium tracking-tight text-[var(--j-color-text-secondary)]", className)} {...props} />;
}

export function AdminTableCell({
  className,
  truncate = false,
  ...props
}: ComponentProps<"td"> & { truncate?: boolean }) {
  return (
    <td
      className={cn(
        "admin-table-text px-4 py-3.5 [word-break:keep-all]",
        truncate && "overflow-hidden text-ellipsis whitespace-nowrap",
        className,
      )}
      {...props}
    />
  );
}

export function AdminSortableHead({
  active,
  ascending,
  children,
  className,
  onClick,
  ...props
}: Omit<ComponentProps<"th">, "onClick"> & {
  active: boolean;
  ascending: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <AdminTableHead className={className} {...props}>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "inline-flex h-8 items-center gap-1 rounded-md px-0 text-[14px] font-medium text-[var(--j-color-text-secondary)] transition-colors hover:bg-slate-100",
        )}
      >
        {children}
        {active ? (
          <ArrowDown
            aria-hidden="true"
            className={cn("size-3 transition-transform", ascending && "rotate-180")}
          />
        ) : null}
      </button>
    </AdminTableHead>
  );
}

export function AdminRowActions({
  label = "작업 메뉴",
  onClick,
}: {
  label?: string;
  onClick: ComponentProps<"button">["onClick"];
}) {
  return (
    <IconButton size="sm" tone="table-action" aria-label={label} onClick={onClick}>
      <MoreHorizontal aria-hidden="true" />
    </IconButton>
  );
}

export function AdminTableEmpty({
  children,
  colSpan,
}: {
  children: ReactNode;
  colSpan: number;
}) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-16 text-center text-[14px] font-normal text-[var(--j-color-text-secondary)]">
        {children}
      </td>
    </tr>
  );
}
