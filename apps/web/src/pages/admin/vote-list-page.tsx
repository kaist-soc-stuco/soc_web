import { createApiClient } from "@soc/api-client";
import type { VoteRecord } from "@soc/contracts";
import { isoToMs } from "@soc/shared";
import { Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { AuthGuard } from "@/components/guards/auth-guard";
import { Button } from "@/components/ui/button";
import {
  AdminDataTable, AdminTableBody, AdminTableCell, AdminTableHead, AdminTableHeader, AdminTableEmpty,
} from "@/components/ui/admin-data-table";
import { AdminPageHeader, AdminPageMain, AdminPageShell, AdminTableCard } from "@/components/ui/admin-page";
import { VoteStatusBadge } from "@/components/ui/vote-status-badge";
import { Pagination } from "@/components/ui/pagination";
import { resolveApiBaseUrl } from "@/lib/api-base-url";
import { Permissions } from "@/lib/permissions";

const PAGE_SIZE = 20;
const formatDate = (value: string) => new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(isoToMs(value));

export function VoteListPage() {
  const client = useMemo(() => createApiClient({ baseUrl: resolveApiBaseUrl() }), []);
  const [votes, setVotes] = useState<VoteRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  useEffect(() => { void client.listAdminVotes().then(setVotes).finally(() => setLoading(false)); }, [client]);
  const totalPages = Math.max(1, Math.ceil(votes.length / PAGE_SIZE));
  const visible = votes.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <AuthGuard requirePermission={Permissions.MANAGE_VOTE}>
      <AdminPageShell>
        <AdminPageMain>
          <AdminPageHeader title="투표 관리" actions={<Button asChild><Link to="/admin/votes/new"><Plus />새 투표</Link></Button>} />
          <AdminTableCard pagination={<Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} range={`총 ${votes.length}건`} />}>
            <AdminDataTable minWidth="56rem">
              <AdminTableHeader><tr><AdminTableHead className="w-[42%]">투표</AdminTableHead><AdminTableHead className="w-28">상태</AdminTableHead><AdminTableHead>기간</AdminTableHead><AdminTableHead className="w-32">참여</AdminTableHead><AdminTableHead className="w-24">관리</AdminTableHead></tr></AdminTableHeader>
              <AdminTableBody>
                {loading ? <AdminTableEmpty colSpan={5}>불러오는 중...</AdminTableEmpty> : visible.length === 0 ? <AdminTableEmpty colSpan={5}>등록된 투표가 없습니다.</AdminTableEmpty> : visible.map((vote) => (
                  <tr key={vote.id} className="border-t border-slate-100">
                    <AdminTableCell><div className="font-medium text-[#172033]">{vote.titleKo}</div><div className="mt-1 text-xs font-normal text-[#344054]">전산학부 주전생 명부</div></AdminTableCell>
                    <AdminTableCell><VoteStatusBadge status={vote.status} startsAt={vote.startsAt} endsAt={vote.endsAt} /></AdminTableCell>
                    <AdminTableCell className="text-sm font-normal text-[#344054]">{formatDate(vote.startsAt)}<br />{formatDate(vote.endsAt)}</AdminTableCell>
                    <AdminTableCell className="text-sm font-normal text-[#344054]">{vote.votedCount} / {vote.eligibleCount}명</AdminTableCell>
                    <AdminTableCell><Button variant="outline" size="sm" asChild><Link to={`/admin/votes/${vote.id}`}>열기</Link></Button></AdminTableCell>
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
