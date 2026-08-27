import { createApiClient } from "@soc/api-client";
import type { HiddenArticleItem, HiddenCommentItem } from "@soc/contracts";
import { isoToDate } from "@soc/shared";
import { RotateCcw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { AuthGuard } from "@/components/guards/auth-guard";
import {
  AdminDataTable,
  AdminTableBody,
  AdminTableCell,
  AdminTableEmpty,
  AdminTableHead,
  AdminTableHeader,
} from "@/components/ui/admin-data-table";
import { AdminPageHeader, AdminPageMain, AdminPageShell, AdminTableCard } from "@/components/ui/admin-page";
import { Button } from "@/components/ui/button";
import { PageSizeSelect, Pagination } from "@/components/ui/pagination";
import { PageSearchField } from "@/components/ui/page-layout";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { useToast } from "@/components/ui/toast";
import { resolveApiBaseUrl } from "@/lib/api-base-url";
import { Permissions } from "@/lib/permissions";

function formatDate(value: string) {
  const date = isoToDate(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function ContentModerationPage() {
  return (
    <AuthGuard requirePermission={Permissions.MODERATE_CONTENT}>
      <ContentModerationPageContent />
    </AuthGuard>
  );
}

function ContentModerationPageContent() {
  const apiClient = useMemo(() => createApiClient({ baseUrl: resolveApiBaseUrl() }), []);
  const { toast } = useToast();
  const [items, setItems] = useState<HiddenArticleItem[]>([]);
  const [comments, setComments] = useState<HiddenCommentItem[]>([]);
  const [view, setView] = useState<"articles" | "comments">("articles");
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const boards = await apiClient.getBoards();
      const [responses, hiddenComments] = await Promise.all([
        Promise.all(boards.items.map((board) => apiClient.getHiddenArticles(board.code))),
        apiClient.getHiddenComments(),
      ]);
      setItems(responses.flatMap((response) => response.items).sort((a, b) => b.hiddenAt.localeCompare(a.hiddenAt)));
      setComments(hiddenComments.items.sort((a, b) => b.hiddenAt.localeCompare(a.hiddenAt)));
    } catch {
      toast({ type: "error", message: "숨김 게시글 목록을 불러오지 못했습니다." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filtered = items.filter((item) => !normalizedQuery || [item.titleKo, item.authorName, item.hiddenReason, item.boardCode].some((value) => value.toLocaleLowerCase().includes(normalizedQuery)));
  const filteredComments = comments.filter((item) => !normalizedQuery || [item.content, item.articleTitleKo, item.authorName, item.hiddenReason, item.boardCode].some((value) => value.toLocaleLowerCase().includes(normalizedQuery)));
  const activeItems = view === "articles" ? filtered : filteredComments;
  const totalPages = Math.max(1, Math.ceil(activeItems.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  const pageComments = filteredComments.slice((safePage - 1) * pageSize, safePage * pageSize);
  const rangeStart = activeItems.length === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const rangeEnd = Math.min(activeItems.length, safePage * pageSize);

  const restore = async (article: HiddenArticleItem) => {
    setRestoringId(article.articleId);
    try {
      await apiClient.restoreArticle(article.boardCode, article.articleId);
      setItems((current) => current.filter((item) => item.articleId !== article.articleId));
      toast({ type: "success", message: "게시글을 복구했습니다." });
    } catch {
      toast({ type: "error", message: "게시글을 복구하지 못했습니다." });
    } finally {
      setRestoringId(null);
    }
  };

  const restoreComment = async (comment: HiddenCommentItem) => {
    setRestoringId(`comment:${comment.commentId}`);
    try {
      await apiClient.restoreComment(comment.boardCode, comment.articleId, comment.commentId);
      setComments((current) => current.filter((item) => item.commentId !== comment.commentId));
      toast({ type: "success", message: "댓글을 복구했습니다." });
    } catch {
      toast({ type: "error", message: "댓글을 복구하지 못했습니다." });
    } finally {
      setRestoringId(null);
    }
  };

  return (
    <AdminPageShell>
      <AdminPageMain>
        <AdminPageHeader title="게시글 관리" />
        <SegmentedControl
          ariaLabel="숨김 콘텐츠 종류"
          className="mb-4 w-fit"
          value={view}
          onChange={(value) => { setView(value); setPage(1); setQuery(""); }}
          options={[
            { value: "articles", label: `게시글 ${items.length}` },
            { value: "comments", label: `댓글 ${comments.length}` },
          ]}
        />
        <AdminTableCard
          toolbar={(
            <div className="flex items-center justify-between gap-3 px-5 py-4">
              <p className="text-sm font-normal text-app-text-secondary">숨김 {activeItems.length}건</p>
              <PageSearchField
                ariaLabel="숨김 게시글 검색"
                className="w-full max-w-80"
                value={query}
                onChange={(value) => { setQuery(value); setPage(1); }}
                onClear={() => { setQuery(""); setPage(1); }}
                placeholder="제목·작성자·사유 검색"
              />
            </div>
          )}
          pagination={activeItems.length > 0 ? (
            <Pagination
              currentPage={safePage}
              totalPages={totalPages}
              onPageChange={setPage}
              pageSizeControl={<PageSizeSelect value={pageSize} onChange={(value) => { setPageSize(value); setPage(1); }} />}
              range={`전체 ${activeItems.length}건 중 ${rangeStart}-${rangeEnd}`}
            />
          ) : undefined}
        >
          {loading && items.length === 0 && comments.length === 0 ? null : view === "articles" ? (
            <AdminDataTable minWidth={920}>
              <colgroup><col style={{ width: 120 }} /><col /><col style={{ width: 140 }} /><col style={{ width: 300 }} /><col style={{ width: 170 }} /><col style={{ width: 92 }} /></colgroup>
              <AdminTableHeader><tr><AdminTableHead>게시판</AdminTableHead><AdminTableHead>제목</AdminTableHead><AdminTableHead>작성자</AdminTableHead><AdminTableHead>숨김 사유</AdminTableHead><AdminTableHead>처리 일시</AdminTableHead><AdminTableHead>작업</AdminTableHead></tr></AdminTableHeader>
              <AdminTableBody>
                {pageItems.length === 0 ? <AdminTableEmpty colSpan={6}>숨긴 게시글이 없습니다.</AdminTableEmpty> : pageItems.map((article) => (
                  <tr key={`${article.boardCode}:${article.articleId}`}>
                    <AdminTableCell>{article.boardCode}</AdminTableCell>
                    <AdminTableCell truncate><span className="font-medium text-app-text-strong">{article.titleKo}</span></AdminTableCell>
                    <AdminTableCell truncate>{article.authorName}</AdminTableCell>
                    <AdminTableCell><span className="line-clamp-2 font-normal">{article.hiddenReason}</span></AdminTableCell>
                    <AdminTableCell>{formatDate(article.hiddenAt)}</AdminTableCell>
                    <AdminTableCell>
                      <Button type="button" variant="ghost" size="sm" disabled={restoringId === article.articleId} onClick={() => void restore(article)}>
                        <RotateCcw className="size-3.5" aria-hidden="true" /> 복구
                      </Button>
                    </AdminTableCell>
                  </tr>
                ))}
              </AdminTableBody>
            </AdminDataTable>
          ) : (
            <AdminDataTable minWidth={920}>
              <colgroup><col style={{ width: 120 }} /><col style={{ width: 260 }} /><col /><col style={{ width: 140 }} /><col style={{ width: 220 }} /><col style={{ width: 92 }} /></colgroup>
              <AdminTableHeader><tr><AdminTableHead>게시판</AdminTableHead><AdminTableHead>게시글</AdminTableHead><AdminTableHead>댓글 내용</AdminTableHead><AdminTableHead>작성자</AdminTableHead><AdminTableHead>숨김 사유</AdminTableHead><AdminTableHead>작업</AdminTableHead></tr></AdminTableHeader>
              <AdminTableBody>
                {pageComments.length === 0 ? <AdminTableEmpty colSpan={6}>숨긴 댓글이 없습니다.</AdminTableEmpty> : pageComments.map((comment) => (
                  <tr key={comment.commentId}>
                    <AdminTableCell>{comment.boardCode}</AdminTableCell>
                    <AdminTableCell truncate>{comment.articleTitleKo}</AdminTableCell>
                    <AdminTableCell><span className="line-clamp-2 font-normal text-app-text-strong">{comment.content}</span></AdminTableCell>
                    <AdminTableCell truncate>{comment.authorName}</AdminTableCell>
                    <AdminTableCell><span className="line-clamp-2 font-normal">{comment.hiddenReason}</span></AdminTableCell>
                    <AdminTableCell>
                      <Button type="button" variant="ghost" size="sm" disabled={restoringId === `comment:${comment.commentId}`} onClick={() => void restoreComment(comment)}>
                        <RotateCcw className="size-3.5" aria-hidden="true" /> 복구
                      </Button>
                    </AdminTableCell>
                  </tr>
                ))}
              </AdminTableBody>
            </AdminDataTable>
          )}
        </AdminTableCard>
      </AdminPageMain>
    </AdminPageShell>
  );
}
