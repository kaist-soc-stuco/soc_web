import type { ComponentProps, ReactNode } from "react";
import { ChevronRight, Search, X } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { UiInput } from "@/components/ui/form-control";
import { IconButton } from "@/components/ui/icon-button";
import { cn } from "@/lib/utils";

export function PageShell({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("flex min-h-screen flex-col bg-[var(--ui-surface-canvas)]", className)} {...props} />;
}

export function PageMain({ className, ...props }: ComponentProps<"main">) {
  return (
    <main
      className={cn("channel-talk-safe-area w-full flex-1 bg-[var(--ui-surface-canvas)]", className)}
      {...props}
    />
  );
}

export function PageContainer({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "mx-auto w-full max-w-[var(--ui-page-max-width)] px-[var(--ui-space-page-x)] md:px-[var(--ui-space-page-x-wide)]",
        className,
      )}
      {...props}
    />
  );
}

export interface PageBreadcrumb {
  label: ReactNode;
  to?: string;
}

export function Breadcrumbs({
  breadcrumbs,
  homeLabel = "홈",
}: {
  breadcrumbs: PageBreadcrumb[];
  homeLabel?: ReactNode;
}) {
  return (
    <nav aria-label="현재 위치" className="page-breadcrumbs">
      <Link to="/">{homeLabel}</Link>
      {breadcrumbs.map((breadcrumb, index) => (
        <span className="page-breadcrumbs__item" key={index}>
          <ChevronRight aria-hidden="true" size={13} />
          {breadcrumb.to ? (
            <Link to={breadcrumb.to}>{breadcrumb.label}</Link>
          ) : (
            <span aria-current={index === breadcrumbs.length - 1 ? "page" : undefined}>
              {breadcrumb.label}
            </span>
          )}
        </span>
      ))}
    </nav>
  );
}

export function PageHeader({
  actions,
  breadcrumbs = [],
  className,
  title,
  titleId,
}: {
  actions?: ReactNode;
  breadcrumbs?: PageBreadcrumb[];
  className?: string;
  title: ReactNode;
  titleId?: string;
}) {
  return (
    <section className={cn("mb-6 bg-[var(--ui-surface-canvas)]", className)} aria-labelledby={titleId}>
      <PageContainer className="flex items-end justify-between gap-4 pb-4 pt-6">
        <div className="min-w-0">
          {breadcrumbs.length > 0 ? (
            <Breadcrumbs breadcrumbs={breadcrumbs} />
          ) : null}
          <h1
            id={titleId}
            className="truncate text-[30px] font-bold leading-9 tracking-[-0.025em] text-app-text-strong"
          >
            {title}
          </h1>
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </PageContainer>
    </section>
  );
}

export function AdminPageTitle({ children, className, ...props }: ComponentProps<"h1">) {
  return (
    <h1
      className={cn("text-[30px] font-bold leading-9 tracking-[-0.025em] text-slate-900", className)}
      {...props}
    >
      {children}
    </h1>
  );
}

export function PageToolbar({ className, ...props }: ComponentProps<"div">) {
  return (
    <div className={cn("mb-5 bg-[var(--ui-surface-canvas)]", className)}>
      <PageContainer
        className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center"
        {...props}
      />
    </div>
  );
}

export function DataViewCard({ className, ...props }: ComponentProps<"section">) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-[var(--ui-card-radius)] border border-slate-200 bg-white shadow-card",
        className,
      )}
      data-ui="data-view-card"
      {...props}
    />
  );
}

export function DataViewToolbar({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex min-h-16 flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-2.5 sm:px-5",
        className,
      )}
      {...props}
    />
  );
}

export function DataViewBody({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("min-w-0", className)} {...props} />;
}

export function DataViewFooter({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex min-h-16 flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 sm:px-5",
        className,
      )}
      data-ui="data-view-footer"
      {...props}
    />
  );
}

export function PageTabs({
  children,
  className,
  variant = "segmented",
  ...props
}: ComponentProps<"nav"> & { variant?: "segmented" | "trackless" }) {
  return (
    <nav
      className="min-w-0 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      {...props}
    >
      <div
        className={cn(
          variant === "segmented"
            ? "ui-segmented-control filter-chips"
            : "ui-trackless-tabs",
          className,
        )}
      >
        {children}
      </div>
    </nav>
  );
}

const pageTabClassName = "interaction-link !h-[34px] !min-h-[34px] !font-normal";
const pageActionClassName =
  "interaction-button inline-flex h-[var(--ui-control-height)] shrink-0 items-center justify-center gap-1.5 rounded-[var(--ui-control-radius)] border px-3.5 text-[length:var(--ui-control-font-size)] font-semibold tracking-tight";

function pageActionToneClassName(tone: "neutral" | "primary") {
  return tone === "primary"
    ? "interaction-primary border-transparent bg-brand-primary text-white"
    : "interaction-hover-neutral border-[var(--ui-border-subtle)] bg-white text-slate-600";
}

export function PageTabLink({
  active,
  className,
  ...props
}: ComponentProps<typeof Link> & { active?: boolean }) {
  return (
    <Link
      className={cn(
        pageTabClassName,
        active && "is-active",
        className,
      )}
      aria-current={active ? "page" : undefined}
      {...props}
    />
  );
}

export function PageTabButton({
  active,
  className,
  ...props
}: Omit<ComponentProps<typeof Button>, "variant" | "size"> & { active?: boolean }) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn(
        pageTabClassName,
        active && "is-active",
        className,
      )}
      aria-pressed={active}
      {...props}
    />
  );
}

export function PageActionButton({
  className,
  tone = "neutral",
  ...props
}: Omit<ComponentProps<typeof Button>, "variant" | "size"> & {
  tone?: "neutral" | "primary";
}) {
  return (
    <Button
      variant="ghost"
      className={cn(pageActionClassName, pageActionToneClassName(tone), className)}
      {...props}
    />
  );
}

export function PageActionLink({
  className,
  tone = "neutral",
  ...props
}: ComponentProps<typeof Link> & { tone?: "neutral" | "primary" }) {
  return (
    <Link
      className={cn(pageActionClassName, pageActionToneClassName(tone), className)}
      {...props}
    />
  );
}

export function PageSearchField({
  ariaLabel,
  className,
  onChange,
  onClear,
  placeholder,
  value,
}: {
  ariaLabel: string;
  className?: string;
  onChange: (value: string) => void;
  onClear: () => void;
  placeholder: string;
  value: string;
}) {
  return (
    <div className={cn("group relative min-w-0 flex-1 lg:w-80 lg:flex-none", className)}>
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 group-focus-within:text-brand-primary"
      />
      <UiInput
        type="search"
        aria-label={ariaLabel}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-[var(--ui-control-height)] w-full border-[var(--ui-border-subtle)] pl-9 pr-9 text-[length:var(--ui-control-font-size)] font-normal tracking-tight"
      />
      {value ? (
        <IconButton
          size="sm"
          aria-label={`${ariaLabel} 지우기`}
          onClick={onClear}
          className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2 text-slate-400"
        >
          <X aria-hidden="true" />
        </IconButton>
      ) : null}
    </div>
  );
}
