import { sanitizeForDisplay } from "./rich-text-content";
import { useEffect, useRef } from "react";
import {
  Bold,
  Italic,
  Link2,
  List,
  ListOrdered,
  RemoveFormatting,
  Underline,
} from "lucide-react";

import { cn } from "@/lib/utils";

type RichTextInputProps = {
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  placeholder?: string;
  disabled?: boolean;
  singleLine?: boolean;
  className?: string;
};

const TOOLBAR_ITEMS = [
  { command: "bold", label: "굵게", icon: Bold },
  { command: "italic", label: "기울임", icon: Italic },
  { command: "underline", label: "밑줄", icon: Underline },
] as const;

function getEditorValue(element: HTMLDivElement) {
  if (!element.textContent?.trim() && !element.querySelector("img")) return "";
  return element.innerHTML;
}

export function RichTextInput({
  value,
  onChange,
  ariaLabel,
  placeholder,
  disabled = false,
  singleLine = false,
  className,
}: RichTextInputProps) {
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || document.activeElement === editor) return;
    const safeValue = sanitizeForDisplay(value);
    if (editor.innerHTML !== safeValue) editor.innerHTML = safeValue;
  }, [value]);

  const emitChange = () => {
    const editor = editorRef.current;
    if (!editor) return;
    onChange(getEditorValue(editor));
  };

  const runCommand = (command: string, commandValue?: string) => {
    if (disabled) return;
    editorRef.current?.focus();
    document.execCommand(command, false, commandValue);
    emitChange();
  };

  const addLink = () => {
    if (disabled) return;
    const url = window.prompt("링크 URL", "https://");
    if (!url?.trim()) return;
    runCommand("createLink", url.trim());
  };

  return (
    <div
      className={cn(
        "group/rich relative min-w-0",
        disabled && "cursor-not-allowed opacity-60",
        className,
      )}
    >
      <div
        ref={editorRef}
        contentEditable={!disabled}
        suppressContentEditableWarning
        role="textbox"
        aria-label={ariaLabel}
        aria-multiline={!singleLine}
        data-placeholder={placeholder}
        className={cn(
          "rich-text-input min-h-10 w-full rounded-none border-0 border-b border-slate-300 bg-slate-100/70 px-3 py-2 text-sm font-normal leading-6 text-[#172033] outline-none transition-colors hover:border-slate-300 focus:border-brand-primary focus:ring-0 empty:before:pointer-events-none empty:before:text-slate-400 empty:before:content-[attr(data-placeholder)]",
          singleLine && "h-10 overflow-hidden whitespace-nowrap",
        )}
        onInput={emitChange}
        onKeyDown={(event) => {
          if (singleLine && event.key === "Enter") event.preventDefault();
        }}
      />

      <div className="pointer-events-none absolute left-0 top-full z-30 mt-1 flex translate-y-[-2px] items-center gap-0.5 rounded-lg border border-slate-200 bg-white p-1 opacity-0 shadow-[0_6px_18px_rgba(15,23,42,0.12)] transition duration-150 group-focus-within/rich:pointer-events-auto group-focus-within/rich:translate-y-0 group-focus-within/rich:opacity-100">
        {TOOLBAR_ITEMS.map(({ command, label, icon: Icon }) => (
          <button
            key={command}
            type="button"
            aria-label={label}
            title={label}
            disabled={disabled}
            onMouseDown={(event) => {
              event.preventDefault();
              runCommand(command);
            }}
            className="inline-flex size-8 items-center justify-center rounded-md border-0 bg-transparent text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 disabled:pointer-events-none"
          >
            <Icon aria-hidden="true" className="size-4" />
          </button>
        ))}
        <button
          type="button"
          aria-label="링크"
          title="링크"
          disabled={disabled}
          onMouseDown={(event) => {
            event.preventDefault();
            addLink();
          }}
          className="inline-flex size-8 items-center justify-center rounded-md border-0 bg-transparent text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 disabled:pointer-events-none"
        >
          <Link2 aria-hidden="true" className="size-4" />
        </button>
        {!singleLine ? (
          <>
            <button
              type="button"
              aria-label="번호 매기기 목록"
              title="번호 매기기 목록"
              disabled={disabled}
              onMouseDown={(event) => {
                event.preventDefault();
                runCommand("insertOrderedList");
              }}
              className="inline-flex size-8 items-center justify-center rounded-md border-0 bg-transparent text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 disabled:pointer-events-none"
            >
              <ListOrdered aria-hidden="true" className="size-4" />
            </button>
            <button
              type="button"
              aria-label="글머리기호 목록"
              title="글머리기호 목록"
              disabled={disabled}
              onMouseDown={(event) => {
                event.preventDefault();
                runCommand("insertUnorderedList");
              }}
              className="inline-flex size-8 items-center justify-center rounded-md border-0 bg-transparent text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 disabled:pointer-events-none"
            >
              <List aria-hidden="true" className="size-4" />
            </button>
          </>
        ) : null}
        <button
          type="button"
          aria-label="서식 삭제"
          title="서식 삭제"
          disabled={disabled}
          onMouseDown={(event) => {
            event.preventDefault();
            runCommand("removeFormat");
            runCommand("unlink");
          }}
          className="inline-flex size-8 items-center justify-center rounded-md border-0 bg-transparent text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 disabled:pointer-events-none"
        >
          <RemoveFormatting aria-hidden="true" className="size-4" />
        </button>
      </div>
    </div>
  );
}
