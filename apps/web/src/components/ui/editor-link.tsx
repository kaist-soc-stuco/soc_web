import { UiInput } from "./form-control";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Pencil, Unlink } from "lucide-react";
import { isSafeUrlReference } from "@soc/contracts";
import { Modal } from "./modal";
import { Button } from "./button";

export function EditorLinkDialog({ initialText, initialUrl, onApply, onClose }: {
  initialText: string; initialUrl: string; onApply: (text: string, url: string) => void; onClose: () => void;
}) {
  const [text, setText] = useState(initialText);
  const [url, setUrl] = useState(initialUrl);
  const [error, setError] = useState(false);
  const urlInput = useRef<HTMLInputElement>(null);
  useEffect(() => { const frame = requestAnimationFrame(() => urlInput.current?.focus()); return () => cancelAnimationFrame(frame); }, []);
  const apply = () => {
    const trimmed = url.trim();
    const normalized = /^(?:[a-z][a-z\d+.-]*:|[/#?])/i.test(trimmed) ? trimmed : `https://${trimmed}`;
    if (!trimmed || !isSafeUrlReference(normalized)) { setError(true); return; }
    onApply(text.trim() || normalized, normalized);
  };
  return <Modal open onClose={onClose} title="링크 추가" className="max-w-md" footer={<><Button variant="outline" onClick={onClose}>취소</Button><Button onClick={apply}>확인</Button></>}>
    <div data-editor-link-ui className="space-y-4" onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); onClose(); } if (event.key === "Enter") { event.stopPropagation(); event.preventDefault(); apply(); } }}>
      <label className="block space-y-2 text-sm"><span>표시할 텍스트</span><UiInput aria-label="표시할 텍스트" placeholder="표시할 텍스트" value={text} onChange={event => setText(event.target.value)} className="w-full" /></label>
      <label className="block space-y-2 text-sm"><span>링크 URL</span><UiInput ref={urlInput} autoFocus aria-label="링크 URL" placeholder="https://..." value={url} onChange={event => { setUrl(event.target.value); setError(false); }} aria-invalid={error} className="w-full" /></label>
      {error && <p role="alert" className="text-sm text-rose-600">올바른 링크를 입력해 주세요.</p>}
    </div>
  </Modal>;
}

export interface EditorLinkPreview { url: string; text: string; left: number; top: number }
export function EditorLinkPopover({ link, onEdit, onUnlink, onClose }: {
  link: EditorLinkPreview; onEdit: () => void; onUnlink: () => void; onClose: () => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) onClose(); };
    const key = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", key);
    window.addEventListener("scroll", onClose, true);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", key); window.removeEventListener("scroll", onClose, true); };
  }, [onClose]);
  return createPortal(<div ref={root} data-editor-link-ui role="dialog" aria-label="링크" className="fixed z-[100] flex max-w-[calc(100vw-24px)] items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1 shadow-md" style={{left:Math.max(12, Math.min(link.left, window.innerWidth - 332)), top:Math.max(12,Math.min(link.top,window.innerHeight-64))}}>
    <a href={link.url} target="_blank" rel="noopener noreferrer" className="max-w-56 truncate text-sm text-blue-600 underline">{link.url}</a>
    <Button size="icon" variant="ghost" aria-label="링크 수정" onClick={onEdit}><Pencil className="size-4" /></Button>
    <Button size="icon" variant="ghost" aria-label="링크 해제" onClick={onUnlink}><Unlink className="size-4" /></Button>
  </div>, document.body);
}
