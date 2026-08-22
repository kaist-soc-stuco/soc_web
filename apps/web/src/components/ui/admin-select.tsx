import { SelectDropdown, type SelectDropdownProps } from "@/components/atoms/select-dropdown";
import { cn } from "@/lib/utils";

const adminSelectButtonClassName =
  "h-[var(--ui-control-height-compact)] rounded-[var(--ui-control-radius)] border-[var(--ui-border-subtle)] px-3 py-0 text-sm font-normal text-[#344054] shadow-none";

/**
 * The shared select style for admin controls and pagination.
 * Keeping the defaults here prevents native selects from drifting across admin screens.
 */
export function AdminSelectDropdown({
  buttonClassName,
  className,
  menuClassName,
  optionClassName,
  ...props
}: SelectDropdownProps) {
  return (
    <SelectDropdown
      {...props}
      className={cn("w-full", className)}
      buttonClassName={cn(adminSelectButtonClassName, buttonClassName)}
      menuClassName={cn("rounded-lg border-slate-200 shadow-elevated", menuClassName)}
      optionClassName={cn("text-sm !font-normal", optionClassName)}
    />
  );
}
