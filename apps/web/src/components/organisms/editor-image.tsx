import { useRef, useState } from "react";
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from "@tiptap/react";
import Image from "@tiptap/extension-image";
import { AlignLeft, AlignCenter, AlignRight, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

function ImageView({ node, selected, updateAttributes, deleteNode, editor }: NodeViewProps) {
  const imageRef = useRef<HTMLImageElement>(null);
  const [width, setWidth] = useState<number | null>(null);
  const resize = useRef<{ x: number; width: number; max: number; direction: number } | null>(null);
  return <NodeViewWrapper className="editor-image-node" data-align={node.attrs.align}>
    <div className={`editor-image-frame ${selected ? "is-selected" : ""}`} style={{ width: width ?? node.attrs.width ?? undefined }}>
      <img ref={imageRef} src={node.attrs.src} alt={node.attrs.alt || ""} draggable data-drag-handle />
      {selected && editor.isEditable && <>
        {[-1, 1].map((direction) => <button key={direction} type="button" className={`editor-image-resize ${direction < 0 ? "is-left" : "is-right"}`} aria-label="이미지 크기 조절"
          onPointerDown={(event) => {
            event.preventDefault(); event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId);
            const rect = imageRef.current!.getBoundingClientRect();
            resize.current = { x: event.clientX, width: rect.width, max: editor.view.dom.clientWidth, direction };
          }}
          onPointerMove={(event) => {
            const start = resize.current;
            if (start) setWidth(Math.round(Math.max(48, Math.min(start.max, start.width + (event.clientX - start.x) * start.direction))));
          }}
          onPointerUp={(event) => {
            if (!resize.current) return;
            const start = resize.current;
            updateAttributes({ width: Math.round(Math.max(48, Math.min(start.max, start.width + (event.clientX - start.x) * start.direction))), height: null });
            resize.current = null; setWidth(null); event.currentTarget.releasePointerCapture(event.pointerId);
          }}
          onPointerCancel={() => { resize.current = null; setWidth(null); }} />)}
        <div contentEditable={false} className="editor-image-actions" onMouseDown={(event) => event.preventDefault()}>
          {([["left", AlignLeft, "왼쪽 정렬"], ["center", AlignCenter, "가운데 정렬"], ["right", AlignRight, "오른쪽 정렬"]] as const).map(([align, Icon, label]) =>
            <Button key={align} type="button" variant="ghost" size="icon" aria-label={label} title={label} aria-pressed={node.attrs.align === align} onClick={() => updateAttributes({ align })}><Icon className="h-4 w-4" /></Button>)}
          <Button type="button" variant="ghost" size="icon" aria-label="원래 크기" title="원래 크기" onClick={() => updateAttributes({ width: null, height: null })}><RotateCcw className="h-4 w-4" /></Button>
          <Button type="button" variant="ghost" size="icon" aria-label="이미지 삭제" title="이미지 삭제" onClick={deleteNode}><Trash2 className="h-4 w-4" /></Button>
        </div>
      </>}
    </div>
  </NodeViewWrapper>;
}

export const EditorImage = Image.extend({
  addAttributes() {
    return { ...this.parent?.(), align: { default: "left", parseHTML: (element) => element.getAttribute("data-align") || "left", renderHTML: (attrs) => ({ "data-align": attrs.align }) } };
  },
  addNodeView() { return ReactNodeViewRenderer(ImageView); },
});
