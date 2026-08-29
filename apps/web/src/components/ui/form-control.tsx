import * as React from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

const textControlClassName =
  "interaction-control select-text h-[var(--ui-control-height)] !rounded-[var(--ui-control-radius)] border border-slate-200 bg-white px-3 text-[length:var(--ui-control-font-size)] [font-weight:var(--ui-control-font-weight)] leading-[var(--ui-control-line-height)] text-[#172033] outline-none placeholder:font-normal placeholder:text-slate-400 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400 disabled:opacity-70";

const unstyledInputTypes = new Set([
  "checkbox",
  "color",
  "file",
  "hidden",
  "image",
  "radio",
  "range",
]);

export const UiInput = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, type = "text", ...props }, ref) => (
  <input
    ref={ref}
    type={type}
    data-slot="input"
    className={cn(unstyledInputTypes.has(type) ? undefined : textControlClassName, className)}
    {...props}
  />
));

UiInput.displayName = "UiInput";

type UiTextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  autoResize?: boolean;
};

export const UiTextarea = React.forwardRef<HTMLTextAreaElement, UiTextareaProps>(
  ({ className, autoResize = true, defaultValue, onInput, value, ...props }, ref) => {
    const textareaRef = React.useRef<HTMLTextAreaElement>(null);

    const resize = React.useCallback(() => {
      const element = textareaRef.current;
      if (!autoResize || !element) return;
      element.style.height = "auto";
      element.style.height = `${element.scrollHeight}px`;
    }, [autoResize]);

    React.useLayoutEffect(() => {
      resize();
    }, [defaultValue, resize, value]);

    const assignRef = React.useCallback(
      (element: HTMLTextAreaElement | null) => {
        textareaRef.current = element;
        if (typeof ref === "function") {
          ref(element);
        } else if (ref) {
          ref.current = element;
        }
      },
      [ref],
    );

    const handleInput = React.useCallback(
      (event: React.InputEvent<HTMLTextAreaElement>) => {
        resize();
        onInput?.(event);
      },
      [onInput, resize],
    );

    return (
      <textarea
        ref={assignRef}
        data-slot="textarea"
        value={value}
        defaultValue={defaultValue}
        onInput={autoResize ? handleInput : onInput}
        className={cn(
          "interaction-control select-text min-h-24 !rounded-[var(--ui-control-radius)] border border-slate-200 bg-white px-3 py-2.5 text-[length:var(--ui-control-font-size)] [font-weight:var(--ui-control-font-weight)] leading-relaxed text-[#172033] outline-none placeholder:font-normal placeholder:text-slate-400 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400 disabled:opacity-70",
          autoResize ? "resize-none overflow-hidden" : "resize-y overflow-y-auto",
          className,
        )}
        {...props}
      />
    );
  },
);

UiTextarea.displayName = "UiTextarea";

export const UiSelect = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, ...props }, ref) => (
  <span className="relative inline-flex max-w-full">
    <select
      ref={ref}
      data-slot="select"
      className={cn(
        "interaction-control h-[var(--ui-control-height)] max-w-full appearance-none !rounded-[var(--ui-control-radius)] border border-slate-200 bg-white px-3 pr-9 text-[length:var(--ui-control-font-size)] [font-weight:var(--ui-control-font-weight)] text-[#172033] outline-none disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400 disabled:opacity-70",
        className,
      )}
      {...props}
    />
    <ChevronDown
      aria-hidden="true"
      className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
    />
  </span>
));

UiSelect.displayName = "UiSelect";

export function UiFormField({
  children,
  className,
  hint,
  htmlFor,
  label,
}: React.ComponentProps<"div"> & {
  hint?: React.ReactNode;
  htmlFor?: string;
  label: React.ReactNode;
}) {
  return (
    <div className={cn("grid min-w-0 gap-1.5", className)}>
      <label
        className="text-xs font-normal leading-4 text-[#344054]"
        htmlFor={htmlFor}
      >
        {label}
      </label>
      {children}
      {hint ? (
        <span className="text-xs font-normal leading-4 text-[#344054]">
          {hint}
        </span>
      ) : null}
    </div>
  );
}
