import { Check, Edit2, EllipsisVertical, Eye, EyeOff, Share2, Trash2 } from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Button } from "@/components/ui/button";
import { MobileDetailHeader } from "@/components/ui/mobile-detail-header";
import { AdminActionMenuDivider, AdminActionMenuItem, AdminActionMenuLink, AdminActionMenuPanel } from "@/components/ui/admin-action-menu";

export function MobileArticleHeader({ title, backTo, editHref, lang, canEdit, canModerate, hidden, copied, onShare, onHide, onRestore, onDelete, loading = false }: {
  title: string; backTo: string; editHref: string; lang: string; canEdit: boolean; canModerate: boolean; hidden: boolean; copied: boolean;
  onShare: () => void; onHide: () => void; onRestore: () => void; onDelete: () => void; loading?: boolean;
}) {
  return <MobileDetailHeader title={title} backTo={backTo} lang={lang} actions={<DropdownMenu.Root modal={false}>
    <DropdownMenu.Trigger asChild><Button className="mobile-more-trigger" variant="ghost" size="icon" disabled={loading} aria-label={lang === "ko" ? "게시글 더보기" : "More post actions"}><EllipsisVertical aria-hidden="true" /></Button></DropdownMenu.Trigger>
    <DropdownMenu.Portal><DropdownMenu.Content asChild align="end" sideOffset={8} collisionPadding={12}>
      <AdminActionMenuPanel className="mobile-detail-menu !w-44">
        {canEdit && <DropdownMenu.Item asChild><AdminActionMenuLink to={editHref} icon={<Edit2 />} >{lang === "ko" ? "수정" : "Edit"}</AdminActionMenuLink></DropdownMenu.Item>}
        {canModerate && <DropdownMenu.Item asChild><AdminActionMenuItem icon={hidden ? <Eye /> : <EyeOff />} onClick={hidden ? onRestore : onHide}>{lang === "ko" ? hidden ? "숨김 해제" : "숨기기" : hidden ? "Unhide" : "Hide"}</AdminActionMenuItem></DropdownMenu.Item>}
        {canEdit && <DropdownMenu.Item asChild><AdminActionMenuItem icon={<Trash2 />} tone="danger" onClick={onDelete}>{lang === "ko" ? "삭제" : "Delete"}</AdminActionMenuItem></DropdownMenu.Item>}
        {(canEdit || canModerate) && <AdminActionMenuDivider />}
        <DropdownMenu.Item asChild><AdminActionMenuItem icon={copied ? <Check /> : <Share2 />} onClick={onShare}>{lang === "ko" ? copied ? "링크 복사됨" : "공유" : copied ? "Link copied" : "Share"}</AdminActionMenuItem></DropdownMenu.Item>
      </AdminActionMenuPanel>
    </DropdownMenu.Content></DropdownMenu.Portal>
  </DropdownMenu.Root>} />;
}
