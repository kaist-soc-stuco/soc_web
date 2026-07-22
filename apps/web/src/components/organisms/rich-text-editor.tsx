import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { useEffect } from "react";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Code,
  Link as LinkIcon,
  Unlink,
  Undo2,
  Redo2,
  Image,
  FileText,
  Video,
  Loader2,
} from "lucide-react";

interface RichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  fileInputRef?: React.RefObject<HTMLInputElement | null>;
  uploading?: boolean;
  lang?: string;
  title?: string;
  onTitleChange?: (value: string) => void;
  titlePlaceholder?: string;
}

export function RichTextEditor({
  content,
  onChange,
  placeholder,
  fileInputRef,
  uploading = false,
  lang = "ko",
  title,
  onTitleChange,
  titlePlaceholder,
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "text-kaist-darkgreen hover:underline cursor-pointer font-semibold",
        },
      }),
      Placeholder.configure({
        placeholder:
          placeholder ||
          (lang === "ko" ? "내용을 입력하세요..." : "Enter content..."),
        emptyEditorClass: "is-editor-empty",
      }),
    ],
    content: content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: "focus:outline-none min-h-[380px] text-slate-800 leading-normal text-[15px]",
      },
    },
  });

  // Sync content from outside (e.g. draft restore or initial load)
  useEffect(() => {
    if (!editor) return;
    const currentHTML = editor.getHTML();
    if (content !== currentHTML && !editor.isFocused) {
      editor.commands.setContent(content, { emitUpdate: false });
    }
  }, [content, editor]);

  if (!editor) {
    return null;
  }

  const setLink = () => {
    const previousUrl = editor.getAttributes("link").href;
    const url = window.prompt(
      lang === "ko" ? "URL을 입력하세요:" : "Enter a URL:",
      previousUrl || "https://",
    );

    if (url === null) {
      return;
    }

    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }

    let finalUrl = url.trim();
    if (!/^https?:\/\//i.test(finalUrl)) {
      finalUrl = `https://${finalUrl}`;
    }

    editor.chain().focus().extendMarkRange("link").setLink({ href: finalUrl }).run();
  };

  return (
    <div className="bg-white transition-all flex flex-col w-full">
      {/* Formatting & Media Toolbar */}
      {/* Bleeds out to card edges and shifts up to align exactly with header controls bottom border */}
      <div className="flex flex-wrap items-center gap-1 bg-slate-50/45 border-b border-slate-150 p-2 mx-[-24px] md:mx-[-32px] mt-[-24px] md:mt-[-32px] px-6 md:px-8 select-none">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`p-1.5 rounded-md hover:bg-slate-200/60 transition-colors cursor-pointer ${
            editor.isActive("bold") ? "bg-kaist-darkgreen/10 text-kaist-darkgreen font-bold" : "text-slate-500"
          }`}
          title={lang === "ko" ? "굵게 (Ctrl+B)" : "Bold (Ctrl+B)"}
        >
          <Bold className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`p-1.5 rounded-md hover:bg-slate-200/60 transition-colors cursor-pointer ${
            editor.isActive("italic") ? "bg-kaist-darkgreen/10 text-kaist-darkgreen" : "text-slate-500"
          }`}
          title={lang === "ko" ? "기울임 (Ctrl+I)" : "Italic (Ctrl+I)"}
        >
          <Italic className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={`p-1.5 rounded-md hover:bg-slate-200/60 transition-colors cursor-pointer ${
            editor.isActive("underline") ? "bg-kaist-darkgreen/10 text-kaist-darkgreen" : "text-slate-500"
          }`}
          title={lang === "ko" ? "밑줄 (Ctrl+U)" : "Underline (Ctrl+U)"}
        >
          <UnderlineIcon className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleStrike().run()}
          className={`p-1.5 rounded-md hover:bg-slate-200/60 transition-colors cursor-pointer ${
            editor.isActive("strike") ? "bg-kaist-darkgreen/10 text-kaist-darkgreen" : "text-slate-500"
          }`}
          title={lang === "ko" ? "취소선" : "Strikethrough"}
        >
          <Strikethrough className="w-4 h-4" />
        </button>

        <div className="w-px h-5 bg-slate-200 mx-1" />

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className={`p-1.5 rounded-md hover:bg-slate-200/60 transition-colors cursor-pointer ${
            editor.isActive("heading", { level: 1 }) ? "bg-kaist-darkgreen/10 text-kaist-darkgreen font-bold" : "text-slate-500"
          }`}
          title={lang === "ko" ? "제목 1 (Ctrl+Alt+1)" : "Heading 1 (Ctrl+Alt+1)"}
        >
          <Heading1 className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={`p-1.5 rounded-md hover:bg-slate-200/60 transition-colors cursor-pointer ${
            editor.isActive("heading", { level: 2 }) ? "bg-kaist-darkgreen/10 text-kaist-darkgreen font-bold" : "text-slate-500"
          }`}
          title={lang === "ko" ? "제목 2 (Ctrl+Alt+2)" : "Heading 2 (Ctrl+Alt+2)"}
        >
          <Heading2 className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className={`p-1.5 rounded-md hover:bg-slate-200/60 transition-colors cursor-pointer ${
            editor.isActive("heading", { level: 3 }) ? "bg-kaist-darkgreen/10 text-kaist-darkgreen font-bold" : "text-slate-500"
          }`}
          title={lang === "ko" ? "제목 3 (Ctrl+Alt+3)" : "Heading 3 (Ctrl+Alt+3)"}
        >
          <Heading3 className="w-4 h-4" />
        </button>

        <div className="w-px h-5 bg-slate-200 mx-1" />

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`p-1.5 rounded-md hover:bg-slate-200/60 transition-colors cursor-pointer ${
            editor.isActive("bulletList") ? "bg-kaist-darkgreen/10 text-kaist-darkgreen" : "text-slate-500"
          }`}
          title={lang === "ko" ? "글머리 기호 목록 (Ctrl+Shift+8)" : "Bullet List (Ctrl+Shift+8)"}
        >
          <List className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`p-1.5 rounded-md hover:bg-slate-200/60 transition-colors cursor-pointer ${
            editor.isActive("orderedList") ? "bg-kaist-darkgreen/10 text-kaist-darkgreen" : "text-slate-500"
          }`}
          title={lang === "ko" ? "번호 매기기 목록 (Ctrl+Shift+9)" : "Ordered List (Ctrl+Shift+9)"}
        >
          <ListOrdered className="w-4 h-4" />
        </button>

        <div className="w-px h-5 bg-slate-200 mx-1" />

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={`p-1.5 rounded-md hover:bg-slate-200/60 transition-colors cursor-pointer ${
            editor.isActive("blockquote") ? "bg-kaist-darkgreen/10 text-kaist-darkgreen" : "text-slate-500"
          }`}
          title={lang === "ko" ? "인용구 (Ctrl+Shift+B)" : "Blockquote (Ctrl+Shift+B)"}
        >
          <Quote className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          className={`p-1.5 rounded-md hover:bg-slate-200/60 transition-colors cursor-pointer ${
            editor.isActive("codeBlock") ? "bg-kaist-darkgreen/10 text-kaist-darkgreen" : "text-slate-500"
          }`}
          title={lang === "ko" ? "코드 블록" : "Code Block"}
        >
          <Code className="w-4 h-4" />
        </button>

        <div className="w-px h-5 bg-slate-200 mx-1" />

        <button
          type="button"
          onClick={setLink}
          className={`p-1.5 rounded-md hover:bg-slate-200/60 transition-colors cursor-pointer ${
            editor.isActive("link") ? "bg-kaist-darkgreen/10 text-kaist-darkgreen" : "text-slate-500"
          }`}
          title={lang === "ko" ? "링크 삽입" : "Insert Link"}
        >
          <LinkIcon className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().unsetLink().run()}
          disabled={!editor.isActive("link")}
          className="p-1.5 rounded-md hover:bg-slate-200/60 transition-colors cursor-pointer text-slate-500 disabled:opacity-40 disabled:cursor-not-allowed"
          title={lang === "ko" ? "링크 해제" : "Remove Link"}
        >
          <Unlink className="w-4 h-4" />
        </button>

        {fileInputRef && (
          <>
            <div className="w-px h-5 bg-slate-200 mx-1" />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="p-1.5 rounded-md hover:bg-slate-200/60 transition-colors cursor-pointer text-slate-500 disabled:opacity-40 disabled:cursor-not-allowed"
              title={lang === "ko" ? "이미지 추가" : "Add Image"}
            >
              <Image className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="p-1.5 rounded-md hover:bg-slate-200/60 transition-colors cursor-pointer text-slate-500 disabled:opacity-40 disabled:cursor-not-allowed"
              title={lang === "ko" ? "파일 첨부" : "Attach File"}
            >
              {uploading ? (
                <Loader2 className="w-4 h-4 animate-spin text-kaist-darkgreen" />
              ) : (
                <FileText className="w-4 h-4" />
              )}
            </button>
            <button
              type="button"
              className="p-1.5 rounded-md hover:bg-slate-200/60 transition-colors cursor-pointer text-slate-500"
              title={lang === "ko" ? "비디오 링크" : "Add Video"}
            >
              <Video className="w-4 h-4" />
            </button>
          </>
        )}

        <div className="w-px h-5 bg-slate-200 mx-1" />

        <button
          type="button"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          className="p-1.5 rounded-md hover:bg-slate-200/60 transition-colors cursor-pointer text-slate-500 disabled:opacity-40 disabled:cursor-not-allowed"
          title={lang === "ko" ? "실행 취소 (Ctrl+Z)" : "Undo (Ctrl+Z)"}
        >
          <Undo2 className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          className="p-1.5 rounded-md hover:bg-slate-200/60 transition-colors cursor-pointer text-slate-500 disabled:opacity-40 disabled:cursor-not-allowed"
          title={lang === "ko" ? "다시 실행 (Ctrl+Y)" : "Redo (Ctrl+Y)"}
        >
          <Redo2 className="w-4 h-4" />
        </button>
      </div>

      {/* Editor Content Area / Canvas */}
      <div className="pt-6 flex flex-col flex-1">
        {onTitleChange && (
          <>
            <input
              type="text"
              placeholder={
                titlePlaceholder ||
                (lang === "ko" ? "제목을 입력하세요" : "Enter a title")
              }
              value={title}
              onChange={(event) => onTitleChange(event.target.value)}
              className="w-full text-2xl font-semibold text-slate-800 bg-transparent focus:outline-none placeholder:text-slate-300 px-1 pb-3"
            />
            <div className="h-px bg-slate-100 mx-1 mb-5" />
          </>
        )}
        <div className="py-2 px-1 min-h-[400px] prose prose-slate max-w-none focus:outline-none tiptap-container flex-1">
          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
  );
}
