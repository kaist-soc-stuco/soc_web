import { createApiClient } from "@soc/api-client";
import type { VoteRecord } from "@soc/contracts";
import { Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { AuthGuard } from "@/components/guards/auth-guard";
import { Button } from "@/components/ui/button";
import {
  AdminDataTable, AdminTableBody, AdminTableCell, AdminTableHead, AdminTableHeader, AdminTableEmpty,
} from "@/components/ui/admin-data-table";
import { AdminPageHeader, AdminPageMain, AdminPageShell, AdminTableCard } from "@/components/ui/admin-page";
import { VoteStatusBadge } from "@/components/ui/vote-status-badge";
import { PageSizeSelect, Pagination } from "@/components/ui/pagination";
import { formatNumericDateRange } from "@/lib/date-display";
import { resolveApiBaseUrl } from "@/lib/api-base-url";
import { Permissions } from "@/lib/permissions";

const PAGE_SIZE = 20;

export function VoteListPage() {
  const navigate = useNavigate();
  const client = useMemo(() => createApiClient({ baseUrl: resolveApiBaseUrl() }), []);
  const [votes, setVotes] = useState<VoteRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  useEffect(() => { void client.listAdminVotes().then(setVotes).finally(() => setLoading(false)); }, [client]);
  const totalPages = Math.max(1, Math.ceil(votes.length / pageSize));
  const visible = votes.slice((page - 1) * pageSize, page * pageSize);
  const rangeStart = visible.length > 0 ? (page - 1) * pageSize + 1 : 0;
  const rangeEnd = visible.length > 0 ? rangeStart + visible.length - 1 : 0;

  return (
    <AuthGuard requirePermission={Permissions.MANAGE_VOTE}>
      <AdminPageShell>
        <AdminPageMain>
          <AdminPageHeader title="투표 관리" actions={<Button asChild><Link to="/admin/votes/new"><Plus />새 투표</Link></Button>} />
          <AdminTableCard pagination={(
            <Pagination
              className="m-0 w-full"
              currentPage={page}
              onPageChange={setPage}
              pageSizeControl={(
                <PageSizeSelect
                  value={pageSize}
                  onChange={(size) => {
                    setPageSize(size);
                    setPage(1);
                  }}
                />
              )}
              range={<span className="text-sm font-normal text-[#344054]">총 {votes.length}건 중 {rangeStart}-{rangeEnd}</span>}
              totalPages={totalPages}
            />
          )}>
            <AdminDataTable minWidth="56rem">
              <AdminTableHeader><tr><AdminTableHead className="w-[42%]">투표</AdminTableHead><AdminTableHead className="w-28">상태</AdminTableHead><AdminTableHead>기간</AdminTableHead><AdminTableHead className="w-32">참여</AdminTableHead></tr></AdminTableHeader>
              <AdminTableBody>
                {loading ? <AdminTableEmpty colSpan={4}>불러오는 중...</AdminTableEmpty> : visible.length === 0 ? <AdminTableEmpty colSpan={4}>등록된 투표가 없습니다.</AdminTableEmpty> : visible.map((vote) => (
                  <tr
                    key={vote.id}
                    className="cursor-pointer border-t border-slate-100 transition-colors hover:bg-slate-50/70 focus:bg-slate-50/70 focus:outline-none"
                    onClick={() => navigate(`/admin/votes/${vote.id}`)}
                    onKeyDown={(event) => {
                      if (event.key !== "Enter" && event.key !== " ") return;
                      event.preventDefault();
                      navigate(`/admin/votes/${vote.id}`);
                    }}
                    tabIndex={0}
                    role="link"
                    aria-label={`${vote.titleKo} 투표 관리`}
                  >
                    <AdminTableCell><div className="font-medium text-[#172033]">{vote.titleKo}</div><div className="mt-1 text-xs font-normal text-[#344054]">전산학부 주전공 학부생 명부</div></AdminTableCell>
                    <AdminTableCell><VoteStatusBadge status={vote.status} startsAt={vote.startsAt} endsAt={vote.endsAt} /></AdminTableCell>
                    <AdminTableCell className="text-sm font-normal text-[#344054]"><time dateTime={vote.startsAt} className="whitespace-nowrap">{formatNumericDateRange(vote.startsAt, vote.endsAt, { includeTime: true })}</time></AdminTableCell>
                    <AdminTableCell className="text-sm font-normal text-[#344054]">{vote.votedCount} / {vote.eligibleCount}명</AdminTableCell>
                  </tr>
                ))}
              </AdminTableBody>
            </AdminDataTable>
          </AdminTableCard>
        </AdminPageMain>
      </AdminPageShell>
    </AuthGuard>
  );
}
