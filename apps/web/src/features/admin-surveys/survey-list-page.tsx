import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { createApiClient } from "@soc/api-client";
import type { SurveyRecord } from "@soc/contracts";
import { isoToDate, nowMs } from "@soc/shared";
import { resolveApiBaseUrl } from "@/lib/api";
import { AuthGuard } from "@/components/guards/auth-guard";
import { AdminEmptyState, AdminPageHeader, AdminPageShell, AdminTableCard } from "@/components/ui/admin-page";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";
import { PageSizeSelect, Pagination } from "@/components/ui/pagination";
import { AdminSelectDropdown } from "@/components/ui/admin-select";
import { PageSearchField } from "@/components/ui/page-layout";
import { TableSkeleton } from "@/components/ui/skeleton";
import { SurveyStatusBadge } from "@/components/ui/survey-status-badge";
import { SegmentedControl } from "@/components/ui/segmented-control";
import {
  AdminDataTable,
  AdminRowActions,
  AdminSortableHead,
  AdminTableBody,
  AdminTableCell,
  AdminTableHead,
  AdminTableHeader,
} from "@/components/ui/admin-data-table";
import {
  AdminActionMenuDivider,
  AdminActionMenuItem,
  AdminActionMenuPanel,
} from "@/components/ui/admin-action-menu";
import { useCurrentSession } from "@/hooks/use-current-session";
import { hasSurveyManagePermission, Permissions } from "@/lib/permissions";
import {
  filterAndSortSurveys,
  type SurveySortDirection,
  type SurveySortKey,
  type SurveyStatusFilter,
} from "@/lib/survey-display";
import {
  Copy, 
  Edit2, 
  BarChart3, 
  ClipboardList,
  Trash2, 
  Link2, 
} from "lucide-react";
import { Button } from "@/components/ui/button";

// Convert timestamp to 24-hour format
function format24hDateTime(dateIso: string | null) {
  if (!dateIso) return null;
  const d = isoToDate(dateIso);
  if (isNaN(d.getTime())) return null;

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hour = String(d.getHours()).padStart(2, "0");
  const minute = String(d.getMinutes()).padStart(2, "0");

  return {
    dateStr: `${year}.${month}.${day}`,
    timeStr: `${hour}:${minute}`
  };
}

// Convert timestamp to Korean relative time
function formatRelativeTime(dateIso: string | null) {
  if (!dateIso) return "—";
  const d = isoToDate(dateIso);
  if (isNaN(d.getTime())) return "—";

  const diffMs = nowMs() - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return "방금 전";
  if (diffMin < 60) return `${diffMin}분 전`;
  if (diffHour < 24) return `${diffHour}시간 전`;
  if (diffDay < 7) return `${diffDay}일 전`;

  // Standard short date format fallback
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}.${month}.${day}`;
}

function renderTypeLabel(survey: SurveyRecord) {
  const label = survey.kind === "VOTE" ? "투표" : survey.kind === "APPLICATION" ? "신청" : "설문";

  return <span className="text-[length:var(--ui-text-body-size)] font-normal text-[var(--ui-text-body)]">{label}</span>;
}

export function SurveyListPage() {
  const navigate = useNavigate();
  const [surveys, setSurveys] = useState<SurveyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [duplicating, setDuplicating] = useState<string | null>(null);

  // Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<SurveyStatusFilter>("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [sortBy, setSortBy] = useState<SurveySortKey>("updatedAt");
  const [sortDirection, setSortDirection] =
    useState<SurveySortDirection>("desc");
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);
  const [activeRowDropdown, setActiveRowDropdown] = useState<{
    id: string;
    top: number;
    left: number;
    placement: "up" | "down";
  } | null>(null);

  const client = useMemo(() => createApiClient({ baseUrl: resolveApiBaseUrl() }), []);
  const { data: session, isLoading: sessionLoading } = useCurrentSession();
  const { confirm: requestConfirm, ConfirmDialog } = useConfirmDialog();
  const showInitialLoading = loading && surveys.length === 0;

  const fetchSurveys = async () => {
    try {
      const data = await client.listSurveys();
      setSurveys(data);
    } catch {
      setError("설문조사 목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (sessionLoading || !hasSurveyManagePermission(session?.permission)) {
      return;
    }
    fetchSurveys();
  }, [client, session, sessionLoading]);

  useEffect(() => {
    if (!activeRowDropdown) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setActiveRowDropdown(null);
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [activeRowDropdown]);

  const handleDelete = async (survey: SurveyRecord) => {
    const confirmed = await requestConfirm({
      confirmLabel: "삭제하기",
      title: "설문조사 삭제",
      description: <>정말 <strong className="font-semibold text-slate-900">“{survey.titleKo}”</strong> 설문을 삭제하시겠습니까?</>,
      tone: "danger",
      warning: "(삭제된 응답 데이터는 영구히 복구할 수 없습니다.)",
    });
    if (!confirmed) return;

    setDeleting(survey.id);
    try {
      await client.deleteSurvey(survey.id);
      setSurveys((prev) => prev.filter((item) => item.id !== survey.id));
    } catch {
      alert("삭제에 실패했습니다.");
    } finally {
      setDeleting(null);
    }
  };


  const handleDuplicate = async (id: string, title: string) => {
    const confirmed = await requestConfirm({
      confirmLabel: "복제",
      title: `"${title}" 설문조사를 복제하시겠습니까?`,
    });
    if (!confirmed) return;

    setDuplicating(id);
    try {
      await client.duplicateSurvey(id);
      await fetchSurveys();
      alert("설문조사가 성공적으로 복제되었습니다.");
    } catch (err) {
      console.error(err);
      alert("설문 복제에 실패했습니다.");
    } finally {
      setDuplicating(null);
    }
  };

  const copyLink = (id: string) => {
    const url = `${window.location.origin}/survey/${id}`;
    navigator.clipboard
      .writeText(url)
      .then(() => alert("설문 응답 링크가 복사되었습니다."));
  };

  const openRowDropdown = (surveyId: string, buttonElement: HTMLButtonElement) => {
    if (activeRowDropdown?.id === surveyId) {
      setActiveRowDropdown(null);
      return;
    }

    const rect = buttonElement.getBoundingClientRect();
    const menuWidth = 168;
    const menuHeight = 272;
    const gap = 8;
    const viewportPadding = 8;
    const spaceBelow = window.innerHeight - rect.bottom;
    const placement: "up" | "down" =
      spaceBelow < menuHeight + gap && rect.top > menuHeight + gap
        ? "up"
        : "down";

    const top = placement === "up"
      ? Math.max(viewportPadding, rect.top - menuHeight - gap)
      : Math.min(window.innerHeight - menuHeight - viewportPadding, rect.bottom + gap);

    const left = Math.min(
      Math.max(viewportPadding, rect.right - menuWidth),
      window.innerWidth - menuWidth - viewportPadding,
    );

    setActiveRowDropdown({
      id: surveyId,
      top,
      left,
      placement,
    });
  };

  const handleSortChange = (nextSortBy: SurveySortKey) => {
    if (sortBy === nextSortBy) {
      setSortDirection((currentDirection) =>
        currentDirection === "desc" ? "asc" : "desc",
      );
      setCurrentPage(1);
      return;
    }

    setSortBy(nextSortBy);
    setSortDirection("desc");
    setCurrentPage(1);
  };

  // Perform Dynamic Client-Side Filtering & Sorting
  const filteredSurveys = useMemo(() => {
    return filterAndSortSurveys(surveys, {
      periodFilter: "all",
      searchQuery,
      sortBy,
      sortDirection,
      statusFilter,
      typeFilter,
    });
  }, [
    surveys,
    searchQuery,
    statusFilter,
    typeFilter,
    sortBy,
    sortDirection,
  ]);

  // Total pages
  const totalPages = Math.max(1, Math.ceil(filteredSurveys.length / pageSize));
  const rangeStart = filteredSurveys.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const rangeEnd = Math.min(filteredSurveys.length, currentPage * pageSize);

  // Paginated List
  const paginatedSurveys = useMemo(() => {
    const startIdx = (currentPage - 1) * pageSize;
    return filteredSurveys.slice(startIdx, startIdx + pageSize);
  }, [filteredSurveys, currentPage, pageSize]);

  // Adjust page number if filtered list shrinks
  useEffect(() => {
    if (currentPage > 1 && currentPage > totalPages) {
      setCurrentPage(Math.max(1, totalPages));
    }
  }, [filteredSurveys, totalPages, currentPage]);

  // Generate page items exactly as `< 1 2 3 ... 13 >`
  return (
    <AuthGuard requirePermission={Permissions.MANAGE_SURVEY}>
      <AdminPageShell>
        {ConfirmDialog}
        <main className="admin-page__main mx-auto flex w-full max-w-[var(--ui-admin-page-max-width)] flex-col gap-6 px-5 py-7 md:px-8 xl:px-10">
          
          <AdminPageHeader
            title="설문조사 관리"
            actions={
              <Button onClick={() => navigate("/admin/surveys/new")} className="gap-1.5 bg-brand-primary text-sm font-semibold text-white hover:bg-brand-primary/90">
                <span aria-hidden="true">+</span>
                새 설문조사
              </Button>
            }
          />

          {/* Inline filters use the shared search and select controls. */}
          <AdminTableCard className="overflow-visible">
            <div className="border-b border-slate-100 p-5">
            <div className="flex flex-wrap items-center gap-3">
              <SegmentedControl
                ariaLabel="설문 상태"
                role="tablist"
                className="shrink-0"
                value={statusFilter}
                options={[
                  { value: "all", label: "전체" },
                  { value: "open", label: "진행중" },
                  { value: "closed", label: "마감" },
                  { value: "draft", label: "임시저장" },
                ]}
                onChange={(value) => {
                  setStatusFilter(value as SurveyStatusFilter);
                  setCurrentPage(1);
                }}
              />
              <AdminSelectDropdown
                ariaLabel="설문 유형"
                value={typeFilter}
                options={[
                  { value: "all", label: "전체 유형" },
                  { value: "SURVEY", label: "설문" },
                  { value: "VOTE", label: "투표" },
                  { value: "APPLICATION", label: "신청" },
                ]}
                onChange={(value) => {
                  setTypeFilter(value);
                  setCurrentPage(1);
                }}
                className="w-28 shrink-0"
              />
              <PageSearchField
                ariaLabel="설문 검색"
                className="ml-auto w-full sm:w-72"
                onChange={(value) => {
                  setSearchQuery(value);
                  setCurrentPage(1);
                }}
                onClear={() => {
                  setSearchQuery("");
                  setCurrentPage(1);
                }}
                placeholder="제목 검색"
                value={searchQuery}
              />
            </div>
          </div>

          <div className="flex min-w-0 flex-col overflow-visible">
            {showInitialLoading ? <TableSkeleton columns={7} rows={8} /> : null}

            {error ? (
              <div className="m-5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-normal text-rose-700">
                {error}
              </div>
            ) : null}

            {!showInitialLoading && !error && filteredSurveys.length === 0 ? (
              <AdminEmptyState message="검색 및 필터 조건에 맞는 설문조사가 없습니다." />
            ) : null}

            {!showInitialLoading && filteredSurveys.length > 0 ? (
              <AdminDataTable minWidth={1152}>
                <colgroup>
                  <col style={{ width: 360 }} />
                  <col style={{ width: 110 }} />
                  <col style={{ width: 110 }} />
                  <col style={{ width: 120 }} />
                  <col style={{ width: 190 }} />
                  <col style={{ width: 190 }} />
                  <col style={{ width: 72 }} />
                </colgroup>
                <AdminTableHeader>
                  <tr>
                    <AdminTableHead className="pl-5 text-left">제목</AdminTableHead>
                    <AdminTableHead className="text-center">상태</AdminTableHead>
                    <AdminTableHead className="text-center">유형</AdminTableHead>
                    <AdminSortableHead
                      className="text-center"
                      active={sortBy === "responseCount"}
                      ascending={sortBy === "responseCount" && sortDirection === "asc"}
                      onClick={() => handleSortChange("responseCount")}
                    >
                      응답자 수
                    </AdminSortableHead>
                    <AdminSortableHead
                      className="text-center"
                      active={sortBy === "opensAt"}
                      ascending={sortBy === "opensAt" && sortDirection === "asc"}
                      onClick={() => handleSortChange("opensAt")}
                    >
                      시작
                    </AdminSortableHead>
                    <AdminSortableHead
                      className="text-center"
                      active={sortBy === "updatedAt"}
                      ascending={sortBy === "updatedAt" && sortDirection === "asc"}
                      onClick={() => handleSortChange("updatedAt")}
                    >
                      최근 수정
                    </AdminSortableHead>
                    <AdminTableHead><span className="sr-only">작업</span></AdminTableHead>
                  </tr>
                </AdminTableHeader>
                <AdminTableBody>
                  {paginatedSurveys.map((survey) => {
                    const start = format24hDateTime(survey.opensAt);
                    return (
                      <tr key={survey.id} className="interaction-row transition-colors hover:bg-slate-50/60">
                        <AdminTableCell className="pl-5" truncate>
                          <button
                            type="button"
                            onClick={() => navigate(`/admin/surveys/${survey.id}/edit`)}
                            className="admin-table-text-emphasis block max-w-full truncate text-left hover:underline"
                          >
                            {survey.titleKo}
                          </button>
                        </AdminTableCell>
                        <AdminTableCell className="text-center">
                          <SurveyStatusBadge survey={survey} />
                        </AdminTableCell>
                        <AdminTableCell className="text-center">{renderTypeLabel(survey)}</AdminTableCell>
                        <AdminTableCell className="text-center tabular-nums">
                          {survey.responseCount ?? 0}명
                        </AdminTableCell>
                        <AdminTableCell className="text-center tabular-nums whitespace-nowrap">
                          {start ? `${start.dateStr} ${start.timeStr}` : "상시"}
                        </AdminTableCell>
                        <AdminTableCell className="text-center whitespace-nowrap">
                          {formatRelativeTime(survey.updatedAt)}
                        </AdminTableCell>
                        <AdminTableCell className="text-center">
                          <AdminRowActions
                            label={`${survey.titleKo} 작업 메뉴`}
                            onClick={(event) => openRowDropdown(survey.id, event.currentTarget)}
                          />
                        </AdminTableCell>
                      </tr>
                    );
                  })}
                </AdminTableBody>
              </AdminDataTable>
            ) : null}

            {activeRowDropdown && createPortal(
              <>
                <div className="fixed inset-0 z-[80]" onClick={() => setActiveRowDropdown(null)} />
                <AdminActionMenuPanel
                  className={`fixed z-[90] select-none ${
                    activeRowDropdown.placement === "up"
                      ? "animate-in fade-in slide-in-from-bottom-1 duration-150"
                      : "animate-in fade-in slide-in-from-top-1 duration-150"
                  }`}
                  style={{ top: activeRowDropdown.top, left: activeRowDropdown.left }}
                >
                  <AdminActionMenuItem
                    icon={<Copy />}
                    onClick={() => {
                      setActiveRowDropdown(null);
                      const target = surveys.find((survey) => survey.id === activeRowDropdown.id);
                      if (target) handleDuplicate(target.id, target.titleKo);
                    }}
                    disabled={duplicating === activeRowDropdown.id}
                  >
                    설문 복제
                  </AdminActionMenuItem>

                  {(() => {
                    const target = surveys.find((survey) => survey.id === activeRowDropdown.id);
                    if (!target) return null;
                    const hasResponses = Boolean(target.isPublished);

                    return (
                      <>
                        <AdminActionMenuItem icon={<Edit2 />} onClick={() => { setActiveRowDropdown(null); navigate(`/admin/surveys/${target.id}/edit`); }}>편집</AdminActionMenuItem>
                        {hasResponses ? <AdminActionMenuItem icon={<ClipboardList />} onClick={() => { setActiveRowDropdown(null); navigate(`/admin/surveys/${target.id}/responses`); }}>응답 목록</AdminActionMenuItem> : null}
                        {hasResponses ? <AdminActionMenuItem icon={<BarChart3 />} onClick={() => { setActiveRowDropdown(null); navigate(`/survey/${target.id}/results`); }}>결과 보기</AdminActionMenuItem> : null}
                        {hasResponses ? <AdminActionMenuDivider /> : null}
                        {hasResponses && (
                          <AdminActionMenuItem
                            icon={<Link2 />}
                            onClick={() => {
                              setActiveRowDropdown(null);
                              copyLink(target.id);
                            }}
                          >
                            링크 복사
                          </AdminActionMenuItem>
                        )}

                        <AdminActionMenuDivider />
                        <AdminActionMenuItem
                          icon={<Trash2 />}
                          tone="danger"
                          onClick={() => {
                            setActiveRowDropdown(null);
                            void handleDelete(target);
                          }}
                          disabled={deleting === target.id}
                        >
                          삭제하기
                        </AdminActionMenuItem>
                      </>
                    );
                  })()}
                </AdminActionMenuPanel>
              </>,
              document.body,
            )}

            <div className="flex items-center justify-center border-t border-slate-100 bg-slate-50/10 px-5 py-3.5 select-none">
              <Pagination
                className="m-0 w-full"
                currentPage={currentPage}
                onPageChange={setCurrentPage}
                pageSizeControl={
                  <PageSizeSelect
                    value={pageSize}
                    onChange={(size) => {
                      setPageSize(size);
                      setCurrentPage(1);
                    }}
                  />
                }
                range={<span className="text-sm font-normal text-[#344054]">총 {filteredSurveys.length}건 중 {rangeStart}-{rangeEnd}</span>}
                totalPages={totalPages}
              />
            </div>

          </div>
          </AdminTableCard>
        </main>
      </AdminPageShell>
    </AuthGuard>
  );
}
