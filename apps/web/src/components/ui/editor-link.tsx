import { UiInput } from "./form-control";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Pencil, Unlink } from "lucide-react";
import { isSafeUrlReference } from "@soc/contracts";
import { Button } from "./button";

export function EditorLinkDialog({ initialText, initialUrl, anchor, onApply, onClose }: {
  anchor: HTMLElement | null; initialText: string; initialUrl: string; onApply: (text: string, url: string) => void; onClose: () => void;
}) {
  const [text, setText] = useState(initialText);
  const [url, setUrl] = useState(initialUrl);
  const [error, setError] = useState(false);
  const urlInput = useRef<HTMLInputElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const [rect, setRect] = useState(() => anchor?.getBoundingClientRect());
  useEffect(() => {
    const reposition = () => setRect(anchor?.getBoundingClientRect());
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => { window.removeEventListener("scroll", reposition, true); window.removeEventListener("resize", reposition); };
  }, [anchor]);
  useEffect(() => {
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node) && !anchor?.contains(event.target as Node)) onClose(); };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [anchor, onClose]);
  useEffect(() => { const frame = requestAnimationFrame(() => urlInput.current?.focus()); return () => cancelAnimationFrame(frame); }, []);
  const apply = () => {
    const trimmed = url.trim();
    const normalized = /^(?:[a-z][a-z\d+.-]*:|[/#?])/i.test(trimmed) ? trimmed : `https://${trimmed}`;
    if (!trimmed || !isSafeUrlReference(normalized)) { setError(true); return; }
    onApply(text.trim() || normalized, normalized);
  };
  return createPortal(<div ref={root} role="dialog" aria-label="링크 추가" data-editor-link-ui className="fixed z-[120] w-80 max-w-[calc(100vw-24px)] rounded-xl border border-slate-200 bg-white p-4 shadow-lg" style={{left:Math.max(12,Math.min(rect?.left ?? 12,window.innerWidth-332)),top:Math.max(12,Math.min((rect?.bottom ?? 12)+8,window.innerHeight-270))}}
    onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); onClose(); } if (event.key === "Enter") { event.stopPropagation(); event.preventDefault(); apply(); } }}>
      <div className="space-y-3">
        <label className="block space-y-1 text-sm"><span>표시할 텍스트</span><UiInput aria-label="표시할 텍스트" placeholder="표시할 텍스트" value={text} onChange={event => setText(event.target.value)} className="w-full" /></label>
        <label className="block space-y-1 text-sm"><span>링크 URL</span><UiInput ref={urlInput} aria-label="링크 URL" placeholder="https://..." value={url} onChange={event => { setUrl(event.target.value); setError(false); }} aria-invalid={error} className="w-full" /></label>
        {error && <p role="alert" className="text-sm text-rose-600">올바른 링크를 입력해 주세요.</p>}
      </div>
      <div className="mt-3 flex justify-end gap-2"><Button size="sm" variant="ghost" onClick={onClose}>취소</Button><Button size="sm" onClick={apply}>적용</Button></div>
    </div>, document.body);
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
