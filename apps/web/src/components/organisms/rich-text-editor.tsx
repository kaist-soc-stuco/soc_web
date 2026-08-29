import type { ChangeEvent, KeyboardEvent as ReactKeyboardEvent, ReactNode, RefObject } from "react";
import { useEffect, useId, useRef, useState } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TiptapImage from "@tiptap/extension-image";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { TextStyleKit } from "@tiptap/extension-text-style";
import {
  Bold,
  Code,
  Check,
  CircleHelp,
  ChevronDown,
  EllipsisVertical,
  FileText,
  Heading1,
  Heading2,
  Heading3,
  Image,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Loader2,
  PaintBucket,
  Palette,
  Quote,
  Redo2,
  Strikethrough,
  Underline as UnderlineIcon,
  Unlink,
  Undo2,
  X,
  type LucideIcon,
} from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";

import { SelectDropdown } from "@/components/atoms/select-dropdown";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";

export interface RichTextEditorProps {
  className?: string;
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  fileInputRef?: RefObject<HTMLInputElement | null>;
  onImageUpload?: (file: File) => Promise<string | null>;
  uploading?: boolean;
  lang?: string;
  title?: string;
  onTitleChange?: (value: string) => void;
  titlePlaceholder?: string;
  compact?: boolean;
  disabled?: boolean;
  spellCheck?: boolean;
  toolbarVariant?: "default" | "email";
  toolbarSuffix?: ReactNode;
  variableLabel?: string;
  variableToken?: string;
  variableOptions?: ReadonlyArray<RichTextVariableOption>;
  onSave?: () => void | Promise<void>;
  onSubmit?: () => void | Promise<void>;
}

export interface RichTextVariableOption {
  label: string;
  token: string;
}

export interface BilingualRichTextEditorProps {
  contentEn: string;
  contentKo: string;
  fileInputRef?: RefObject<HTMLInputElement | null>;
  isKoreanOnly: boolean;
  lang?: string;
  onImageUpload?: (file: File) => Promise<string | null>;
  onContentEnChange: (value: string) => void;
  onContentKoChange: (value: string) => void;
  onTitleEnChange: (value: string) => void;
  onTitleKoChange: (value: string) => void;
  titleEn: string;
  titleKo: string;
  uploading?: boolean;
  disabled?: boolean;
  onSave?: () => void | Promise<void>;
  onSubmit?: () => void | Promise<void>;
}

const DEFAULT_FONT_SIZE = "14px";
const FONT_SIZE_OPTIONS = [8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 28, 30, 36, 50, 72, 96].map(
  (size) => ({ value: `${size}px`, labelKo: `${size}px`, labelEn: `${size}px` }),
);

const TEXT_COLOR_PALETTE = [
  { value: "#111827", label: "검정" },
  { value: "#b42318", label: "빨강" },
  { value: "#c2410c", label: "주황" },
  { value: "#a16207", label: "노랑" },
  { value: "#15803d", label: "초록" },
  { value: "#0e7490", label: "청록" },
  { value: "#1d4ed8", label: "파랑" },
  { value: "#7e22ce", label: "보라" },
] as const;

const BACKGROUND_COLOR_PALETTE = [
  { value: "#f3f4f6", label: "회색" },
  { value: "#fee2e2", label: "연한 빨강" },
  { value: "#ffedd5", label: "연한 주황" },
  { value: "#fef3c7", label: "연한 노랑" },
  { value: "#dcfce7", label: "연한 초록" },
  { value: "#cffafe", label: "연한 청록" },
  { value: "#dbeafe", label: "연한 파랑" },
  { value: "#f3e8ff", label: "연한 보라" },
] as const;

function ToolbarDivider() {
  return <span className="mx-1 h-5 w-px bg-slate-200" aria-hidden="true" />;
}

function getSafeEditorHTML(editor: Editor) {
  if (editor.isDestroyed || !editor.schema) return null;

  try {
    return editor.getHTML();
  } catch {
    return null;
  }
}

function promptForLink(editor: Editor, lang: string) {
  const previousUrl = editor.getAttributes("link").href;
  const url = window.prompt(
    lang === "ko" ? "URL을 입력하세요:" : "Enter a URL:",
    previousUrl || "https://",
  );
  if (url === null) return;
  if (url === "") {
    editor.chain().focus().extendMarkRange("link").unsetLink().run();
    return;
  }
  const finalUrl = /^https?:\/\//i.test(url.trim()) ? url.trim() : `https://${url.trim()}`;
  editor.chain().focus().extendMarkRange("link").setLink({ href: finalUrl }).run();
}

function handleEditorShortcut({
  event,
  editor,
  lang,
  onOpenShortcutHelp,
  onSave,
  onSubmit,
  onLanguageChange,
}: {
  event: ReactKeyboardEvent<HTMLElement>;
  editor: Editor;
  lang: string;
  onOpenShortcutHelp: () => void;
  onSave?: () => void | Promise<void>;
  onSubmit?: () => void | Promise<void>;
  onLanguageChange?: (language: "ko" | "en") => void;
}) {
  const key = event.key.toLowerCase();
  const isModifier = event.ctrlKey || event.metaKey;

  if (
    event.altKey &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.shiftKey &&
    (key === "1" || key === "2") &&
    onLanguageChange
  ) {
    event.preventDefault();
    onLanguageChange(key === "1" ? "ko" : "en");
    return;
  }

  if (!isModifier) return;

  if (key === "k") {
    event.preventDefault();
    promptForLink(editor, lang);
    return;
  }

  if (key === "s" && onSave) {
    event.preventDefault();
    void onSave();
    return;
  }

  if (key === "enter" && onSubmit) {
    event.preventDefault();
    void onSubmit();
    return;
  }

  if ((key === "/" || event.code === "Slash") && onOpenShortcutHelp) {
    event.preventDefault();
    onOpenShortcutHelp();
  }
}

type ShortcutHelpItem = {
  keys: string;
  label: string;
};

type EditorSupportItem = {
  detail: string;
  label: string;
};

type EditorInputRuleItem = {
  label: string;
  trigger: string;
};

function ShortcutHelpModal({
  lang,
  onClose,
  open,
  showFileAttachment,
  showImageUpload,
  showLanguageShortcuts,
  showSaveShortcut,
  showSubmitShortcut,
}: {
  lang: string;
  onClose: () => void;
  open: boolean;
  showFileAttachment: boolean;
  showImageUpload: boolean;
  showLanguageShortcuts: boolean;
  showSaveShortcut: boolean;
  showSubmitShortcut: boolean;
}) {
  const isKorean = lang === "ko";
  const shortcuts: ShortcutHelpItem[] = [
    { keys: "Ctrl + B", label: isKorean ? "굵게" : "Bold" },
    { keys: "Ctrl + I", label: isKorean ? "기울임" : "Italic" },
    { keys: "Ctrl + U", label: isKorean ? "밑줄" : "Underline" },
    { keys: "Ctrl + Z", label: isKorean ? "실행 취소" : "Undo" },
    { keys: "Ctrl + Y", label: isKorean ? "다시 실행" : "Redo" },
    { keys: "Ctrl + Shift + Z", label: isKorean ? "다시 실행" : "Redo" },
    { keys: "Ctrl + Shift + 7", label: isKorean ? "번호 목록" : "Ordered list" },
    { keys: "Ctrl + Shift + 8", label: isKorean ? "글머리 기호 목록" : "Bullet list" },
    { keys: "Ctrl + Alt + 1/2/3", label: isKorean ? "제목 1/2/3" : "Heading 1/2/3" },
    { keys: "Ctrl + K", label: isKorean ? "링크 삽입" : "Insert link" },
    ...(showSaveShortcut
      ? [{ keys: "Ctrl + S", label: isKorean ? "저장" : "Save" }]
      : []),
    ...(showSubmitShortcut
      ? [{ keys: "Ctrl + Enter", label: isKorean ? "작성 완료 (등록)" : "Finish and publish" }]
      : []),
    ...(showLanguageShortcuts
      ? [
          { keys: "Alt + 1", label: isKorean ? "국문 에디터" : "Korean editor" },
          { keys: "Alt + 2", label: isKorean ? "영문 에디터" : "English editor" },
        ]
      : []),
    { keys: "Ctrl + /", label: isKorean ? "도움말 열기" : "Open help" },
  ];

  const supportedFormats: EditorSupportItem[] = [
    { label: isKorean ? "제목" : "Headings", detail: isKorean ? "제목 1 · 제목 2 · 제목 3" : "Heading 1 · 2 · 3" },
    { label: isKorean ? "텍스트 강조" : "Text emphasis", detail: isKorean ? "굵게 · 기울임 · 밑줄 · 취소선" : "Bold · italic · underline · strikethrough" },
    { label: isKorean ? "블록 서식" : "Block formatting", detail: isKorean ? "인용 · 코드 블록" : "Blockquote · code block" },
    { label: isKorean ? "목록" : "Lists", detail: isKorean ? "글머리 기호 · 번호 목록" : "Bullet · ordered list" },
    { label: isKorean ? "링크" : "Links", detail: isKorean ? "링크 삽입 · 링크 해제" : "Insert · remove links" },
    { label: isKorean ? "색상 및 크기" : "Color and size", detail: isKorean ? "글자 크기 · 글자 색상 · 배경 색상" : "Font size · text color · background color" },
    ...(showImageUpload
      ? [{ label: isKorean ? "이미지" : "Images", detail: isKorean ? "이미지 삽입" : "Insert image" }]
      : []),
    ...(showFileAttachment
      ? [{ label: isKorean ? "파일" : "Files", detail: isKorean ? "파일 첨부" : "Attach file" }]
      : []),
  ];

  const inputRules: EditorInputRuleItem[] = [
    { trigger: "#  /  ##  /  ###  + Space", label: isKorean ? "제목 1 / 2 / 3" : "Heading 1 / 2 / 3" },
    { trigger: ">  + Space", label: isKorean ? "인용" : "Blockquote" },
    { trigger: "-  /  *  /  +  + Space", label: isKorean ? "글머리 기호 목록" : "Bullet list" },
    { trigger: "1.  + Space", label: isKorean ? "번호 목록" : "Ordered list" },
    { trigger: "```  /  ~~~  + Space 또는 Enter", label: isKorean ? "코드 블록" : "Code block" },
    { trigger: "`텍스트`", label: isKorean ? "인라인 코드" : "Inline code" },
    { trigger: "**텍스트**  /  __텍스트__", label: isKorean ? "굵게" : "Bold" },
    { trigger: "*텍스트*  /  _텍스트_", label: isKorean ? "기울임" : "Italic" },
    { trigger: "~~텍스트~~", label: isKorean ? "취소선" : "Strikethrough" },
  ];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isKorean ? "에디터 도움말" : "Editor help"}
      className="max-w-5xl"
      bodyClassName="space-y-6"
    >
      <section className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <h3 className="text-sm font-semibold text-slate-800">{isKorean ? "키보드 단축키" : "Keyboard shortcuts"}</h3>
          <p className="text-[length:var(--ui-text-caption-size)] text-slate-400">Windows/Linux: Ctrl · macOS: ⌘</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {shortcuts.map(({ keys, label }) => (
            <div key={`${keys}-${label}`} className="flex min-h-11 items-center justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50/70 px-3 py-2">
              <span className="text-sm text-slate-700">{label}</span>
              <kbd className="shrink-0 rounded-md border border-slate-200 bg-white px-2 py-1 text-[length:var(--ui-text-caption-size)] font-medium text-slate-600 shadow-xs">{keys}</kbd>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-800">{isKorean ? "지원 서식" : "Supported formatting"}</h3>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {supportedFormats.map(({ detail, label }) => (
            <div key={label} className="rounded-lg border border-slate-100 px-3 py-2.5">
              <p className="text-sm font-medium text-slate-700">{label}</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">{detail}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">{isKorean ? "빠른 입력 문법" : "Quick input syntax"}</h3>
          <p className="mt-1 text-xs text-slate-400">{isKorean ? "문장 맨 앞에서 입력한 뒤 Space 또는 Enter를 누르면 서식이 적용됩니다." : "Type at the start of a line, then press Space or Enter to apply formatting."}</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {inputRules.map(({ label, trigger }) => (
            <div key={trigger} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-lg bg-slate-50/70 px-3 py-2.5">
              <span className="text-sm text-slate-700">{label}</span>
              <code className="text-right text-xs font-medium text-slate-500">{trigger}</code>
            </div>
          ))}
        </div>
      </section>
    </Modal>
  );
}

function useTiptapEditor({
  content,
  disabled,
  editorMinHeight,
  onImageUpload,
  onChange,
  placeholder,
  spellCheck,
}: {
  content: string;
  disabled: boolean;
  editorMinHeight: string;
  onImageUpload?: (file: File) => Promise<string | null>;
  onChange: (content: string) => void;
  placeholder: string;
  spellCheck: boolean;
}) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: false,
        underline: false,
      }),
      TextStyleKit.configure({
        backgroundColor: {},
        fontFamily: false,
        lineHeight: false,
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: "text-kaist-darkgreen font-semibold" },
      }),
      TiptapImage.configure({
        allowBase64: false,
        HTMLAttributes: { class: "rich-text-image" },
      }),
      Placeholder.configure({
        placeholder,
        emptyEditorClass: "is-editor-empty",
      }),
    ],
    content,
    editable: !disabled,
    onUpdate: ({ editor: updatedEditor }) => {
      const html = getSafeEditorHTML(updatedEditor);
      if (html !== null) onChange(html);
    },
    editorProps: {
      attributes: {
        class: `${editorMinHeight} text-[length:var(--ui-text-section-size)] leading-normal text-slate-800`,
        spellcheck: spellCheck ? "true" : "false",
      },
      handlePaste: (view, event) => {
        if (!onImageUpload) return false;

        const imageFile = Array.from(event.clipboardData?.items ?? [])
          .find((item) => item.kind === "file" && item.type.startsWith("image/"))
          ?.getAsFile();
        if (!imageFile) return false;

        event.preventDefault();
        void onImageUpload(imageFile)
          .then((src) => {
            if (!src || view.state.schema.nodes.image == null) return;
            const image = view.state.schema.nodes.image.create({ src, alt: "" });
            view.dispatch(view.state.tr.replaceSelectionWith(image).scrollIntoView());
          })
          .catch(() => undefined);
        return true;
      },
    },
  });

  useEffect(() => {
    if (!editor || editor.isDestroyed || !editor.schema) return;
    if (!editor.isFocused) editor.commands.setContent(content, { emitUpdate: false });
  }, [content, editor]);

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    editor.setEditable(!disabled);
  }, [disabled, editor]);

  return editor;
}

function ToolbarButton({
  active = false,
  children,
  disabled = false,
  expanded,
  hasPopup,
  label,
  onClick,
}: {
  active?: boolean;
  children: ReactNode;
  disabled?: boolean;
  expanded?: boolean;
  hasPopup?: "menu" | "dialog";
  label: string;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={label}
      aria-pressed={active}
      aria-expanded={expanded}
      aria-haspopup={hasPopup}
      title={label}
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={cn(
        "size-8 rounded-md text-slate-500",
        active && "bg-brand-primary-light text-brand-primary",
      )}
    >
      {children}
    </Button>
  );
}

function ColorPopover({
  colors,
  currentValue,
  label,
  onApply,
  onClose,
}: {
  colors: ReadonlyArray<{ value: string; label: string }>;
  currentValue: string;
  label: string;
  onApply: (value: string) => void;
  onClose: () => void;
}) {
  const [hexValue, setHexValue] = useState(currentValue || "");
  const [error, setError] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!popoverRef.current?.contains(event.target as Node)) onClose();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onClose();
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  const applyHex = () => {
    const normalized = hexValue.trim();
    if (!/^#[0-9a-f]{6}$/i.test(normalized)) {
      setError(true);
      return;
    }
    onApply(normalized.toLowerCase());
    onClose();
  };

  return (
    <div
      ref={popoverRef}
      role="dialog"
      aria-label={label}
      className="absolute left-0 top-full z-50 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-3 shadow-[0_12px_32px_rgb(15_23_42_/_0.14)]"
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-700">{label}</span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="닫기"
          title="닫기"
          onClick={onClose}
          className="size-7 rounded-md text-slate-400"
        >
          <X />
        </Button>
      </div>
      <div className="grid grid-cols-8 gap-2" role="listbox" aria-label={`${label} 팔레트`}>
        {colors.map((color) => (
          <button
            key={color.value}
            type="button"
            role="option"
            aria-label={color.label}
            aria-selected={currentValue.toLowerCase() === color.value}
            onClick={() => {
              onApply(color.value);
              onClose();
            }}
            className="relative size-6 rounded-full border border-slate-200 outline-none transition-transform hover:scale-105"
            style={{ backgroundColor: color.value }}
          >
            {currentValue.toLowerCase() === color.value ? (
              <Check
                aria-hidden="true"
                className={cn(
                  "absolute inset-1/2 size-3 -translate-x-1/2 -translate-y-1/2",
                  color.value === "#fef3c7" || color.value === "#fee2e2"
                    ? "text-slate-700"
                    : "text-white",
                )}
              />
            ) : null}
          </button>
        ))}
      </div>
      <div className="my-3 h-px bg-slate-100" aria-hidden="true" />
      <div className="flex items-center">
        <input
          aria-label={`${label} HEX 코드`}
          value={hexValue}
          onChange={(event) => {
            setHexValue(event.target.value);
            setError(false);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              applyHex();
            }
          }}
          placeholder="#RRGGBB"
          className={cn(
            "h-8 min-w-0 flex-1 rounded-md border bg-white px-2 text-xs text-slate-800 outline-none placeholder:text-slate-400",
            error ? "border-rose-400" : "border-slate-200",
          )}
        />
      </div>
    </div>
  );
}

function MoreFormattingMenu({
  editor,
  lang,
}: {
  editor: Editor;
  lang: string;
}) {
  return (
    <DropdownMenu.Portal>
      <DropdownMenu.Content
        align="start"
        sideOffset={6}
        collisionPadding={12}
        className="z-[200] min-w-44 rounded-xl border border-slate-200 bg-white p-1.5 shadow-[0_12px_32px_rgb(15_23_42_/_0.14)]"
      >
      {[
        {
          icon: Heading1,
          label: lang === "ko" ? "제목 1" : "Heading 1",
          active: editor.isActive("heading", { level: 1 }),
          run: () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
        },
        {
          icon: Heading2,
          label: lang === "ko" ? "제목 2" : "Heading 2",
          active: editor.isActive("heading", { level: 2 }),
          run: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
        },
        {
          icon: Heading3,
          label: lang === "ko" ? "제목 3" : "Heading 3",
          active: editor.isActive("heading", { level: 3 }),
          run: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
        },
        {
          icon: Strikethrough,
          label: lang === "ko" ? "취소선" : "Strikethrough",
          active: editor.isActive("strike"),
          run: () => editor.chain().focus().toggleStrike().run(),
        },
        {
          icon: Quote,
          label: lang === "ko" ? "인용" : "Blockquote",
          active: editor.isActive("blockquote"),
          run: () => editor.chain().focus().toggleBlockquote().run(),
        },
        {
          icon: Code,
          label: lang === "ko" ? "코드 블록" : "Code block",
          active: editor.isActive("codeBlock"),
          run: () => editor.chain().focus().toggleCodeBlock().run(),
        },
        {
          icon: Unlink,
          label: lang === "ko" ? "링크 해제" : "Remove link",
          active: false,
          run: () => editor.chain().focus().unsetLink().run(),
        },
      ].map((item) => {
        const ItemIcon = item.icon as LucideIcon;

        return (
          <DropdownMenu.Item
            key={item.label}
            onSelect={item.run}
            className={cn(
              "flex h-8 w-full cursor-pointer items-center gap-2 rounded-md px-2.5 text-xs font-normal text-slate-700 outline-none",
              item.active && "bg-brand-primary-light text-brand-primary",
              "data-[highlighted]:bg-slate-100",
            )}
          >
            <ItemIcon aria-hidden="true" className="size-3.5 shrink-0 text-slate-400" />
            <span>{item.label}</span>
          </DropdownMenu.Item>
        );
      })}
      </DropdownMenu.Content>
    </DropdownMenu.Portal>
  );
}

function RichTextToolbar({
  editor,
  fileInputRef,
  lang,
  onImageUpload,
  onShortcutHelp,
  toolbarVariant = "default",
  toolbarSuffix,
  uploading,
  variableLabel,
  variableToken,
  variableOptions,
}: {
  editor: Editor;
  fileInputRef?: RefObject<HTMLInputElement | null>;
  lang: string;
  onImageUpload?: (file: File) => Promise<string | null>;
  onShortcutHelp: () => void;
  toolbarVariant?: "default" | "email";
  toolbarSuffix?: ReactNode;
  uploading: boolean;
  variableLabel?: string;
  variableToken?: string;
  variableOptions?: ReadonlyArray<RichTextVariableOption>;
}) {
  const editorId = useId().replace(/:/g, "");
  const [colorPopover, setColorPopover] = useState<"text" | "background" | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const currentTextColor = editor.getAttributes("textStyle").color ?? "";
  const currentBackgroundColor = editor.getAttributes("textStyle").backgroundColor ?? "";
  const sizeValue = editor.getAttributes("textStyle").fontSize ?? DEFAULT_FONT_SIZE;
  const variableMenuOptions = variableOptions?.length
    ? variableOptions
    : variableToken
      ? [{ label: variableLabel || variableToken, token: variableToken }]
      : [];

  const setLink = () => {
    promptForLink(editor, lang);
  };

  const handleImageSelection = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !onImageUpload) return;

    const src = await onImageUpload(file).catch(() => null);
    if (!src || editor.isDestroyed) return;
    editor.chain().focus().setImage({ src, alt: "" }).run();
  };

  return (
    <div className="flex items-center justify-between gap-3 bg-slate-50/60 px-3 py-2">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
      <label className="sr-only" htmlFor={`${editorId}-font-size`}>
        {lang === "ko" ? "글자 크기" : "Font size"}
      </label>
      <SelectDropdown
        id={`${editorId}-font-size`}
        ariaLabel={lang === "ko" ? "글자 크기" : "Font size"}
        value={sizeValue}
        onChange={(value) => {
          editor.chain().focus().setFontSize(value).run();
        }}
        options={FONT_SIZE_OPTIONS.map((option) => ({
          value: option.value,
          label: lang === "ko" ? option.labelKo : option.labelEn,
        }))}
        className="w-[96px]"
        buttonClassName="h-8 rounded-md border-slate-200 px-2.5 text-xs font-medium text-slate-700"
        menuClassName="rounded-lg"
        optionClassName="text-xs"
      />

      <ToolbarDivider />
      <ToolbarButton
        label={lang === "ko" ? "굵게 (Ctrl+B)" : "Bold (Ctrl+B)"}
        active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold />
      </ToolbarButton>
      <ToolbarButton
        label={lang === "ko" ? "기울임 (Ctrl+I)" : "Italic (Ctrl+I)"}
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic />
      </ToolbarButton>
      <ToolbarButton
        label={lang === "ko" ? "밑줄 (Ctrl+U)" : "Underline (Ctrl+U)"}
        active={editor.isActive("underline")}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        <UnderlineIcon />
      </ToolbarButton>

      <DropdownMenu.Root modal={false} onOpenChange={(open) => { if (open) setColorPopover(null); }}>
        <DropdownMenu.Trigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={lang === "ko" ? "더보기" : "More formatting"}
            title={lang === "ko" ? "더보기" : "More formatting"}
            aria-haspopup="menu"
            className="size-8 rounded-md text-slate-500 data-[state=open]:bg-brand-primary-light data-[state=open]:text-brand-primary"
          >
            <EllipsisVertical />
          </Button>
        </DropdownMenu.Trigger>
        <MoreFormattingMenu editor={editor} lang={lang} />
      </DropdownMenu.Root>

      {toolbarVariant !== "email" ? (
        <>
          <ToolbarDivider />
          <div className="relative">
            <ToolbarButton
              label={lang === "ko" ? "글자 색상" : "Text color"}
              active={Boolean(currentTextColor) || colorPopover === "text"}
              expanded={colorPopover === "text"}
              hasPopup="dialog"
              onClick={() => {
                setColorPopover((open) => (open === "text" ? null : "text"));
              }}
            >
              <Palette />
            </ToolbarButton>
            {colorPopover === "text" ? (
              <ColorPopover
                colors={TEXT_COLOR_PALETTE}
                currentValue={currentTextColor}
                label={lang === "ko" ? "글자 색상" : "Text color"}
                onApply={(value) => editor.chain().focus().setColor(value).run()}
                onClose={() => setColorPopover(null)}
              />
            ) : null}
          </div>
          <div className="relative">
            <ToolbarButton
              label={lang === "ko" ? "배경 색상" : "Background color"}
              active={Boolean(currentBackgroundColor) || colorPopover === "background"}
              expanded={colorPopover === "background"}
              hasPopup="dialog"
              onClick={() => {
                setColorPopover((open) => (open === "background" ? null : "background"));
              }}
            >
              <PaintBucket />
            </ToolbarButton>
            {colorPopover === "background" ? (
              <ColorPopover
                colors={BACKGROUND_COLOR_PALETTE}
                currentValue={currentBackgroundColor}
                label={lang === "ko" ? "배경 색상" : "Background color"}
                onApply={(value) => editor.chain().focus().setBackgroundColor(value).run()}
                onClose={() => setColorPopover(null)}
              />
            ) : null}
          </div>
        </>
      ) : null}

      {toolbarVariant === "email" ? <ToolbarDivider /> : null}
      {toolbarVariant !== "email" ? (
        <>
          <ToolbarDivider />
          <ToolbarButton
            label={lang === "ko" ? "글머리 기호 목록" : "Bullet list"}
            active={editor.isActive("bulletList")}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
          >
            <List />
          </ToolbarButton>
          <ToolbarButton
            label={lang === "ko" ? "번호 목록" : "Ordered list"}
            active={editor.isActive("orderedList")}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
          >
            <ListOrdered />
          </ToolbarButton>
        </>
      ) : null}
      <ToolbarButton
        label={lang === "ko" ? "링크 삽입" : "Insert link"}
        active={editor.isActive("link")}
        onClick={setLink}
      >
        <LinkIcon />
      </ToolbarButton>

      {variableMenuOptions.length ? (
        <DropdownMenu.Root modal={false}>
          <DropdownMenu.Trigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label={lang === "ko" ? "치환자 선택" : "Choose variable"}
              title={lang === "ko" ? "치환자 선택" : "Choose variable"}
              className="h-8 shrink-0 rounded-md px-2 text-xs font-normal text-slate-600"
            >
              <span className="whitespace-nowrap">
                {variableMenuOptions[0]?.label ?? variableLabel ?? variableToken}
              </span>
              <ChevronDown aria-hidden="true" className="size-3.5 text-slate-400" />
            </Button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="start"
              sideOffset={6}
              collisionPadding={12}
              className="z-[200] min-w-40 rounded-xl border border-slate-200 bg-white p-1.5 shadow-[0_12px_32px_rgb(15_23_42_/_0.14)]"
            >
              {variableMenuOptions.map((option) => (
                <DropdownMenu.Item
                  key={option.token}
                  onSelect={() => editor.chain().focus().insertContent(option.token).run()}
                  className="flex h-8 cursor-pointer items-center rounded-md px-2.5 text-xs font-normal text-slate-700 outline-none data-[highlighted]:bg-slate-100"
                >
                  {option.label}
                </DropdownMenu.Item>
              ))}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      ) : null}

      {fileInputRef || onImageUpload ? (
        <>
          <ToolbarDivider />
          {onImageUpload ? (
            <>
              <ToolbarButton
                label={lang === "ko" ? "이미지 삽입" : "Insert image"}
                onClick={() => imageInputRef.current?.click()}
                disabled={uploading}
              >
                <Image />
              </ToolbarButton>
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                tabIndex={-1}
                onChange={(event) => void handleImageSelection(event)}
              />
            </>
          ) : null}
          {fileInputRef ? (
            <ToolbarButton
              label={lang === "ko" ? "파일 첨부" : "Attach file"}
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? <Loader2 className="animate-spin" /> : <FileText />}
            </ToolbarButton>
          ) : null}
        </>
      ) : null}

      <ToolbarDivider />
      <ToolbarButton
        label={lang === "ko" ? "실행 취소 (Ctrl+Z)" : "Undo (Ctrl+Z)"}
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
      >
        <Undo2 />
      </ToolbarButton>
      <ToolbarButton
        label={lang === "ko" ? "다시 실행 (Ctrl+Y)" : "Redo (Ctrl+Y)"}
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
      >
        <Redo2 />
      </ToolbarButton>
      <ToolbarDivider />
      <ToolbarButton
        label={lang === "ko" ? "에디터 단축키 보기 (Ctrl+/)" : "Show editor shortcuts (Ctrl+/)"}
        hasPopup="dialog"
        onClick={onShortcutHelp}
      >
        <CircleHelp />
      </ToolbarButton>
      </div>
      {toolbarSuffix ? <div className="shrink-0">{toolbarSuffix}</div> : null}
    </div>
  );
}

function EditorPane({
  editor,
  onFocus,
  onTitleChange,
  placeholder,
  title,
  titleLabel,
}: {
  editor: Editor;
  onFocus: () => void;
  onTitleChange: (value: string) => void;
  placeholder: string;
  title: string;
  titleLabel: string;
}) {
  return (
    <section className="min-w-0 px-4 py-4 md:px-6 md:py-5" onFocusCapture={onFocus}>
      <input
        type="text"
        spellCheck={false}
        aria-label={titleLabel}
        placeholder={placeholder}
        value={title}
        onChange={(event) => onTitleChange(event.target.value)}
        className="h-9 w-full border-0 border-b border-slate-100 bg-transparent px-0 pb-2 text-lg font-semibold leading-7 text-slate-800 outline-none placeholder:text-slate-300"
      />
      <div className="tiptap-container mt-4 min-w-0 max-w-none prose prose-slate">
        <EditorContent editor={editor} />
      </div>
    </section>
  );
}

export function RichTextEditor({
  className,
  content,
  onChange,
  placeholder,
  fileInputRef,
  onImageUpload,
  uploading = false,
  lang = "ko",
  title,
  onTitleChange,
  titlePlaceholder,
  compact = false,
  disabled = false,
  spellCheck = true,
  toolbarVariant = "default",
  toolbarSuffix,
  variableLabel,
  variableToken,
  variableOptions,
  onSave,
  onSubmit,
}: RichTextEditorProps) {
  const [shortcutHelpOpen, setShortcutHelpOpen] = useState(false);
  const editor = useTiptapEditor({
    content,
    disabled,
    editorMinHeight: compact ? "min-h-[104px]" : "min-h-[380px]",
    onImageUpload,
    onChange,
    placeholder: placeholder || (lang === "ko" ? "내용을 입력하세요..." : "Enter content..."),
    spellCheck,
  });
  const canvasMinHeight = compact ? "min-h-[120px]" : "min-h-[400px]";

  if (!editor) return null;

  return (
    <div
      aria-disabled={disabled}
      onKeyDownCapture={(event) => {
        if (disabled) return;
        handleEditorShortcut({
          event,
          editor,
          lang,
          onOpenShortcutHelp: () => setShortcutHelpOpen(true),
          onSave,
          onSubmit,
        });
      }}
      className={cn(
        "mx-auto w-full max-w-4xl bg-white",
        className,
        disabled && "pointer-events-none opacity-65",
      )}
    >
      <RichTextToolbar
        editor={editor}
        fileInputRef={fileInputRef}
        lang={lang}
        onImageUpload={onImageUpload}
        onShortcutHelp={() => setShortcutHelpOpen(true)}
        toolbarVariant={toolbarVariant}
        toolbarSuffix={toolbarSuffix}
        uploading={uploading}
        variableLabel={variableLabel}
        variableToken={variableToken}
        variableOptions={variableOptions}
      />
      <div className="flex flex-col pt-5">
        {onTitleChange ? (
          <>
            <input
              type="text"
              aria-label={lang === "ko" ? "제목" : "Title"}
              placeholder={titlePlaceholder || (lang === "ko" ? "제목을 입력하세요" : "Enter a title")}
              value={title}
              onChange={(event) => onTitleChange(event.target.value)}
              className="h-10 w-full border-0 bg-transparent px-1 pb-3 text-xl font-semibold leading-7 text-slate-800 outline-none placeholder:text-slate-300"
            />
            <div className="mx-1 mb-5 h-px bg-slate-100" aria-hidden="true" />
          </>
        ) : null}
        <div
          className={cn(
            "tiptap-container min-w-0 flex-1 px-1 py-2 prose prose-slate max-w-none",
            canvasMinHeight,
          )}
        >
          <EditorContent editor={editor} />
        </div>
      </div>
      <ShortcutHelpModal
        lang={lang}
        onClose={() => setShortcutHelpOpen(false)}
        open={shortcutHelpOpen}
        showFileAttachment={Boolean(fileInputRef)}
        showImageUpload={Boolean(onImageUpload)}
        showLanguageShortcuts={false}
        showSaveShortcut={Boolean(onSave)}
        showSubmitShortcut={Boolean(onSubmit)}
      />
    </div>
  );
}

export function BilingualRichTextEditor({
  contentEn,
  contentKo,
  fileInputRef,
  isKoreanOnly,
  lang = "ko",
  onImageUpload,
  onContentEnChange,
  onContentKoChange,
  onTitleEnChange,
  onTitleKoChange,
  titleEn,
  titleKo,
  uploading = false,
  disabled = false,
  onSave,
  onSubmit,
}: BilingualRichTextEditorProps) {
  const koreanEditor = useTiptapEditor({
    content: contentKo,
    disabled,
    editorMinHeight: "min-h-[300px]",
    onImageUpload,
    onChange: onContentKoChange,
    placeholder: lang === "ko" ? "국문 내용을 입력하세요" : "Enter Korean content",
    spellCheck: true,
  });
  const englishEditor = useTiptapEditor({
    content: contentEn,
    disabled,
    editorMinHeight: "min-h-[300px]",
    onImageUpload,
    onChange: onContentEnChange,
    placeholder: lang === "ko" ? "영문 내용을 입력하세요" : "Enter English content",
    spellCheck: true,
  });
  const [activeLanguage, setActiveLanguage] = useState<"ko" | "en">("ko");
  const [shortcutHelpOpen, setShortcutHelpOpen] = useState(false);

  useEffect(() => {
    if (isKoreanOnly && activeLanguage === "en") setActiveLanguage("ko");
  }, [activeLanguage, isKoreanOnly]);

  if (!koreanEditor || !englishEditor) return null;

  const activeEditor = activeLanguage === "ko" ? koreanEditor : englishEditor;
  const switchEditorLanguage = (language: "ko" | "en") => {
    if (language === "en" && isKoreanOnly) return;
    setActiveLanguage(language);
    window.requestAnimationFrame(() => {
      const nextEditor = language === "ko" ? koreanEditor : englishEditor;
      if (!nextEditor.isDestroyed) nextEditor.commands.focus();
    });
  };

  return (
    <div
      aria-disabled={disabled}
      onKeyDownCapture={(event) => {
        if (disabled) return;
        handleEditorShortcut({
          event,
          editor: activeEditor,
          lang,
          onLanguageChange: switchEditorLanguage,
          onOpenShortcutHelp: () => setShortcutHelpOpen(true),
          onSave,
          onSubmit,
        });
      }}
      className={cn(
        "mx-auto w-full min-w-0 max-w-none bg-white",
        disabled && "pointer-events-none opacity-65",
      )}
    >
      <RichTextToolbar
        editor={activeEditor}
        fileInputRef={fileInputRef}
        lang={lang}
        onImageUpload={onImageUpload}
        onShortcutHelp={() => setShortcutHelpOpen(true)}
        uploading={uploading}
      />
      <div className={cn("grid min-w-0", !isKoreanOnly && "md:grid-cols-2")}>
        <EditorPane
          editor={koreanEditor}
          onFocus={() => setActiveLanguage("ko")}
          onTitleChange={onTitleKoChange}
          placeholder={lang === "ko" ? "국문 제목을 입력하세요" : "Enter Korean title"}
          title={titleKo}
          titleLabel={lang === "ko" ? "국문" : "Korean"}
        />
        {!isKoreanOnly ? (
          <div className="min-w-0 border-t border-slate-200 md:border-l md:border-t-0">
            <EditorPane
              editor={englishEditor}
              onFocus={() => setActiveLanguage("en")}
              onTitleChange={onTitleEnChange}
              placeholder={lang === "ko" ? "영문 제목을 입력하세요" : "Enter English title"}
              title={titleEn}
              titleLabel={lang === "ko" ? "영문" : "English"}
            />
          </div>
        ) : null}
      </div>
      <ShortcutHelpModal
        lang={lang}
        onClose={() => setShortcutHelpOpen(false)}
        open={shortcutHelpOpen}
        showFileAttachment={Boolean(fileInputRef)}
        showImageUpload={Boolean(onImageUpload)}
        showLanguageShortcuts={!isKoreanOnly}
        showSaveShortcut={Boolean(onSave)}
        showSubmitShortcut={Boolean(onSubmit)}
      />
    </div>
  );
}
