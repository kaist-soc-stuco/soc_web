import { useAdminListQuery } from "@/hooks/use-admin-list-query";
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
import { AdminLoadingState, AdminPageHeader, AdminPageMain, AdminPageShell, AdminTableCard } from "@/components/ui/admin-page";
import { IconButton } from "@/components/ui/icon-button";
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

  const [view, setView] = useState<"articles" | "comments">("articles");

  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const moderationQuery = useAdminListQuery({ resource: "moderation", queryFn: async () => {
    const boards = await apiClient.getBoards();
    const [responses, hiddenComments] = await Promise.all([
      Promise.all(boards.items.map(board => apiClient.getHiddenArticles(board.code))),
      apiClient.getHiddenComments(),
    ]);
    return {
      boardNames: Object.fromEntries(boards.items.map(board => [board.code, board.nameKo])),
      items: responses.flatMap(response => response.items).sort((a, b) => b.hiddenAt.localeCompare(a.hiddenAt)),
      comments: hiddenComments.items.sort((a, b) => b.hiddenAt.localeCompare(a.hiddenAt)),
    };
  } });
  const boardNames = moderationQuery.data?.boardNames ?? {};
  const items = moderationQuery.data?.items ?? [];
  const comments = moderationQuery.data?.comments ?? [];
  const loading = moderationQuery.isPending;
  useEffect(() => {
    if (moderationQuery.isError) toast({ type: "error", message: "숨김 게시글 목록을 불러오지 못했습니다." });
  }, [moderationQuery.isError, toast]);

  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filtered = items.filter((item) => !normalizedQuery || [item.titleKo, item.authorName, item.hiddenReason, boardNames[item.boardCode] ?? ""].some((value) => value.toLocaleLowerCase().includes(normalizedQuery)));
  const filteredComments = comments.filter((item) => !normalizedQuery || [item.content, item.articleTitleKo, item.authorName, item.hiddenReason, boardNames[item.boardCode] ?? ""].some((value) => value.toLocaleLowerCase().includes(normalizedQuery)));
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
      moderationQuery.setData(current => ({ ...current, items: current.items.filter(item => item.articleId !== article.articleId) }));
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
      moderationQuery.setData(current => ({ ...current, comments: current.comments.filter(item => item.commentId !== comment.commentId) }));
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
          variant="underline" ariaLabel="숨김 콘텐츠 종류"
          className="mb-4 w-fit"
          value={view}
          onChange={(value) => { setView(value); setPage(1); setQuery(""); }}
          options={[
            { value: "articles", label: `게시글 ${items.length}` },
            { value: "comments", label: `댓글 ${comments.length}` },
          ]}
        />
        <AdminTableCard refreshing={moderationQuery.isFetching}
          toolbar={(
            <div className="flex items-center justify-between gap-3 py-2">
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
              className="m-0 w-full"
              currentPage={safePage}
              totalPages={totalPages}
              onPageChange={setPage}
              pageSizeControl={<PageSizeSelect value={pageSize} onChange={(value) => { setPageSize(value); setPage(1); }} />}
              range={`전체 ${activeItems.length}건 중 ${rangeStart}-${rangeEnd}`}
            />
          ) : undefined}
        >
          {loading && items.length === 0 && comments.length === 0 ? <AdminLoadingState /> : view === "articles" ? (
            <AdminDataTable minWidth={0} mobileMode="cards">
              <colgroup><col style={{ width: "12%" }} /><col style={{ width: "26%" }} /><col style={{ width: "12%" }} /><col style={{ width: "22%" }} /><col style={{ width: "14%" }} /><col style={{ width: "14%" }} /></colgroup>
              <AdminTableHeader><tr><AdminTableHead>게시판</AdminTableHead><AdminTableHead>제목</AdminTableHead><AdminTableHead>작성자</AdminTableHead><AdminTableHead>숨김 사유</AdminTableHead><AdminTableHead>처리 일시</AdminTableHead><AdminTableHead className="text-center"><span className="sr-only">작업</span></AdminTableHead></tr></AdminTableHeader>
              <AdminTableBody>
                {pageItems.length === 0 ? <AdminTableEmpty colSpan={6}>숨긴 게시글이 없습니다.</AdminTableEmpty> : pageItems.map((article) => (
                  <tr key={`${article.boardCode}:${article.articleId}`}>
                    <AdminTableCell>{boardNames[article.boardCode] ?? "게시판"}</AdminTableCell>
                    <AdminTableCell data-mobile-label="제목" truncate><span className="font-medium text-app-text-strong">{article.titleKo}</span></AdminTableCell>
                    <AdminTableCell data-mobile-label="작성자" truncate>{article.authorName}</AdminTableCell>
                    <AdminTableCell data-mobile-label="숨김 사유"><span className="line-clamp-2 font-normal">{article.hiddenReason}</span></AdminTableCell>
                    <AdminTableCell data-mobile-label="처리 일시">{formatDate(article.hiddenAt)}</AdminTableCell>
                    <AdminTableCell data-mobile-label="작업" className="text-center align-middle">
                      <IconButton aria-label="복구" data-tooltip="복구" size="sm" disabled={restoringId === article.articleId} onClick={() => void restore(article)}>
                        <RotateCcw className="size-3.5" aria-hidden="true" />
                      </IconButton>
                    </AdminTableCell>
                  </tr>
                ))}
              </AdminTableBody>
            </AdminDataTable>
          ) : (
            <AdminDataTable minWidth={0} mobileMode="cards">
              <colgroup><col style={{ width: "12%" }} /><col style={{ width: "24%" }} /><col style={{ width: "26%" }} /><col style={{ width: "12%" }} /><col style={{ width: "12%" }} /><col style={{ width: "14%" }} /></colgroup>
              <AdminTableHeader><tr><AdminTableHead>게시판</AdminTableHead><AdminTableHead>게시글</AdminTableHead><AdminTableHead>댓글 내용</AdminTableHead><AdminTableHead>작성자</AdminTableHead><AdminTableHead>숨김 사유</AdminTableHead><AdminTableHead className="text-center"><span className="sr-only">작업</span></AdminTableHead></tr></AdminTableHeader>
              <AdminTableBody>
                {pageComments.length === 0 ? <AdminTableEmpty colSpan={6}>숨긴 댓글이 없습니다.</AdminTableEmpty> : pageComments.map((comment) => (
                  <tr key={comment.commentId}>
                    <AdminTableCell>{boardNames[comment.boardCode] ?? "게시판"}</AdminTableCell>
                    <AdminTableCell data-mobile-label="게시글" truncate>{comment.articleTitleKo}</AdminTableCell>
                    <AdminTableCell data-mobile-label="댓글 내용"><span className="line-clamp-2 font-normal text-app-text-strong">{comment.content}</span></AdminTableCell>
                    <AdminTableCell data-mobile-label="작성자" truncate>{comment.authorName}</AdminTableCell>
                    <AdminTableCell data-mobile-label="숨김 사유"><span className="line-clamp-2 font-normal">{comment.hiddenReason}</span></AdminTableCell>
                    <AdminTableCell data-mobile-label="작업" className="text-center align-middle">
                      <IconButton aria-label="복구" data-tooltip="복구" size="sm" disabled={restoringId === `comment:${comment.commentId}`} onClick={() => void restoreComment(comment)}>
                        <RotateCcw className="size-3.5" aria-hidden="true" />
                      </IconButton>
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
