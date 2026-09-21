import { DateRangePicker, type DateRange } from "@/components/ui/date-range-picker";
import { overlapsDateRange } from "@/lib/date-range-filter";
import { stripRichText } from "@/components/ui/rich-text-content";
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
  const [dateRange, setDateRange] = useState<DateRange>({ from: "", to: "" });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  useEffect(() => { void client.listAdminVotes().then(setVotes).finally(() => setLoading(false)); }, [client]);
  const filteredVotes = votes.filter(vote => overlapsDateRange(vote.startsAt, vote.endsAt, dateRange));
  const totalPages = Math.max(1, Math.ceil(filteredVotes.length / pageSize));
  const visible = filteredVotes.slice((page - 1) * pageSize, page * pageSize);
  const rangeStart = visible.length > 0 ? (page - 1) * pageSize + 1 : 0;
  const rangeEnd = visible.length > 0 ? rangeStart + visible.length - 1 : 0;

  return (
    <AuthGuard requirePermission={Permissions.MANAGE_VOTE}>
      <AdminPageShell>
        <AdminPageMain>
          <AdminPageHeader title="투표 관리" actions={<Button asChild><Link to="/admin/votes/new"><Plus />새 투표</Link></Button>} />
          <AdminTableCard toolbar={<div className="py-4"><DateRangePicker presetType="future" align="start" value={dateRange} onChange={range => { setDateRange(range); setPage(1); }} /></div>} pagination={(
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
              range={<span className="text-sm font-normal text-[#344054]">총 {filteredVotes.length}건 중 {rangeStart}-{rangeEnd}</span>}
              totalPages={totalPages}
            />
          )}>
            <AdminDataTable minWidth="56rem" mobileMode="cards">
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
                    aria-label={`${stripRichText(vote.titleKo)} 투표 관리`}
                  >
                    <AdminTableCell><div className="font-medium text-[#172033]">{stripRichText(vote.titleKo)}</div></AdminTableCell>
                    <AdminTableCell data-mobile-label="상태"><VoteStatusBadge status={vote.status} startsAt={vote.startsAt} endsAt={vote.endsAt} /></AdminTableCell>
                    <AdminTableCell data-mobile-label="기간" className="text-sm font-normal text-[#344054]"><time dateTime={vote.startsAt} className="whitespace-nowrap">{formatNumericDateRange(vote.startsAt, vote.endsAt, { includeTime: true })}</time></AdminTableCell>
                    <AdminTableCell data-mobile-label="참여" className="text-sm font-normal text-[#344054]">{vote.votedCount} / {vote.eligibleCount}명</AdminTableCell>
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
