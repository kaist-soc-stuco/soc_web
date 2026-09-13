import type { ComponentProps, ReactNode } from "react";
import { RichTextInput } from "./rich-text-input";
import { UiInput, UiTextarea } from "./form-control";
import { cn } from "@/lib/utils";

type Props = ComponentProps<typeof RichTextInput> & { plainText?: boolean };

/** Shared field for survey and vote builders; votes store plain text. */
export function BuilderTextField({ plainText = false, ...props }: Props) {
  if (!plainText) return <RichTextInput {...props} inputClassName={cn("builder-text-control", props.inputClassName)} />;
  const { value, onChange, ariaLabel, placeholder, disabled, singleLine, className, inputClassName } = props;
  const control = { value, placeholder, disabled, "aria-label": ariaLabel,
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(event.target.value),
    className: cn("builder-text-control w-full !min-h-6 !h-auto px-0 py-0 text-base font-normal leading-6", inputClassName) };
  return <div className={cn("min-w-0", className)}>{singleLine ? <UiInput {...control} /> : <UiTextarea rows={1} {...control} />}</div>;
}

export function BuilderOptionAdd({ onAdd, disabled }: { onAdd: () => void; disabled?: boolean }) {
  return <UiInput type="text" readOnly aria-label="선택지 추가" placeholder="옵션 추가" disabled={disabled} onFocus={onAdd}
    className="builder-text-control !h-9 min-w-0 flex-1 px-1.5 text-base font-normal text-slate-400 placeholder:text-slate-400" />;
}

export function BuilderRuleRow({ children }: { children: ReactNode }) {
  return <div className="builder-rule-row mt-6 flex min-w-0 flex-wrap items-center gap-3 py-2">{children}</div>;
}
