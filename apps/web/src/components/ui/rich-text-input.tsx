import { sanitizeForDisplay } from "./rich-text-content";
import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import {
  Bold,
  Italic,
  Link2,
  List,
  ListOrdered,
  RemoveFormatting,
  Underline,
} from "lucide-react";

import { EditorLinkDialog, EditorLinkPopover, type EditorLinkPreview } from "./editor-link";
import { cn } from "@/lib/utils";

type RichTextInputProps = {
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  placeholder?: string;
  disabled?: boolean;
  singleLine?: boolean;
  className?: string;
  inputClassName?: string;
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
  inputClassName,
}: RichTextInputProps) {
  const [focused, setFocused] = useState(false);
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

  const [linkDialog, setLinkDialog] = useState<{text:string;url:string} | null>(null);
  const [linkPreview, setLinkPreview] = useState<EditorLinkPreview | null>(null);
  const selectedRange = useRef<Range | null>(null);
  const selectedAnchor = useRef<HTMLAnchorElement | null>(null);
  const addLink = () => {
    if (disabled) return;
    const selection = window.getSelection();
    const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
    selectedRange.current = range && editorRef.current?.contains(range.commonAncestorContainer) ? range.cloneRange() : null;
    const node = range?.startContainer;
    const anchor = (node?.nodeType === Node.ELEMENT_NODE ? node as Element : node?.parentElement)?.closest("a") as HTMLAnchorElement | null;
    selectedAnchor.current = anchor && editorRef.current?.contains(anchor) ? anchor : null;
    setLinkDialog({text:selectedAnchor.current?.textContent ?? selection?.toString() ?? "",url:selectedAnchor.current?.getAttribute("href") ?? ""});
    setLinkPreview(null);
  };
  const restoreSelection = () => {
    editorRef.current?.focus();
    const selection = window.getSelection();
    if (selectedRange.current && selection) { selection.removeAllRanges(); selection.addRange(selectedRange.current); }
  };
  const applyLink = (text: string, url: string) => {
    // Release the modal focus trap before restoring the contenteditable range.
    flushSync(() => setLinkDialog(null));
    restoreSelection();
    const anchor = selectedAnchor.current;
    if (anchor?.isConnected) {
      const range = document.createRange(); range.selectNode(anchor);
      const selection = window.getSelection(); selection?.removeAllRanges(); selection?.addRange(range);
    }
    const element = document.createElement("a");
    element.href = url; element.textContent = text; element.target = "_blank"; element.rel = "noopener noreferrer";
    document.execCommand("insertHTML", false, element.outerHTML);
    emitChange();
  };

  return (
    <div
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setFocused(false); }}
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
          inputClassName,
        )}
        onClick={event => {
          const anchor = (event.target as HTMLElement).closest("a");
          if (!anchor || disabled) return;
          event.preventDefault();
          selectedAnchor.current = anchor;
          const range = document.createRange(); range.selectNodeContents(anchor); selectedRange.current = range;
          const rect = anchor.getBoundingClientRect();
          setLinkPreview({url:anchor.getAttribute("href") ?? "",text:anchor.textContent ?? "",left:rect.left,top:rect.bottom+6});
        }}
        onInput={emitChange}
        onKeyDown={(event) => {
          if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); addLink(); }
          if (singleLine && event.key === "Enter") event.preventDefault();
        }}
      />

      <div className="rich-input-toolbar-space" data-open={focused && !disabled}><div className="min-h-0 overflow-hidden"><div className="rich-input-toolbar flex flex-wrap items-center gap-0.5 py-1" aria-hidden={!focused} inert={!focused}>
        {TOOLBAR_ITEMS.map(({ command, label, icon: Icon }) => (
          <button
            key={command}
            type="button"
            aria-label={label}
            data-tooltip={label}
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
          aria-label="링크 삽입"
          data-tooltip="링크 삽입"
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
              data-tooltip="번호 매기기 목록"
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
              data-tooltip="글머리기호 목록"
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
          data-tooltip="서식 삭제"
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
      </div></div></div>
      {linkDialog && <EditorLinkDialog initialText={linkDialog.text} initialUrl={linkDialog.url} onApply={applyLink} onClose={() => { flushSync(() => setLinkDialog(null)); restoreSelection(); }} />}
      {linkPreview && <EditorLinkPopover link={linkPreview} onClose={() => setLinkPreview(null)} onEdit={() => { setLinkDialog({text:linkPreview.text,url:linkPreview.url});setLinkPreview(null); }} onUnlink={() => { restoreSelection(); document.execCommand("unlink"); emitChange(); setLinkPreview(null); }} />}
    </div>
  );
}
