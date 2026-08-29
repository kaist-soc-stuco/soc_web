import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { createApiClient } from "@soc/api-client";
import type {
  SurveyAnalyticsResponse,
  SurveyDetailResponse,
  SurveyQuestionRecord,
  SurveyResponseRecord,
  SurveyResponseWithAnswers,
} from "@soc/contracts";
import { isoToDate, isoToMs } from "@soc/shared";
import { resolveApiBaseUrl } from "@/lib/api";
import { AuthGuard } from "@/components/guards/auth-guard";
import { AdminCard, AdminEmptyState, AdminPageHeader, AdminPageMain, AdminPageShell, AdminTableCard } from "@/components/ui/admin-page";
import { SurveyRespondentDrawer } from "@/components/organisms/survey-respondent-drawer";
import { PageSizeSelect, Pagination } from "@/components/ui/pagination";
import { Breadcrumbs, PageSearchField } from "@/components/ui/page-layout";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { SurveyStatusBadge } from "@/components/ui/survey-status-badge";
import { useCurrentSession } from "@/hooks/use-current-session";
import { useToast } from "@/components/ui/toast";
import { hasSurveyManagePermission, Permissions } from "@/lib/permissions";
import { 
  ChevronLeft,
  Eye,
  Sheet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import {
  AdminDataTable,
  AdminTableBody,
  AdminTableCell,
  AdminTableHead,
  AdminTableHeader,
} from "@/components/ui/admin-data-table";
import { SurveyQuestionSummary, SurveyResponseSummary } from "./survey-analytics-dashboard";

type ResponseView = "summary" | "questions" | "individual";

function formatResponseName(response: SurveyResponseRecord) {
  return response.user?.nameKo ?? "—";
}

function formatResponseEmail(response: SurveyResponseRecord) {
  return response.user?.email ?? "—";
}

function formatResponseDepartment(response: SurveyResponseRecord) {
  if (!response.user) return "—";
  const parts = [response.user.departmentKo, response.user.stdNo].filter(Boolean);
  return parts.length > 0 ? parts.join(" / ") : "—";
}

// Convert timestamp to 24-hour single line format
function format24hDateTime(dateIso: string | null) {
  if (!dateIso) return null;
  const d = isoToDate(dateIso);
  if (isNaN(d.getTime())) return null;

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hour = String(d.getHours()).padStart(2, "0");
  const minute = String(d.getMinutes()).padStart(2, "0");

  return `${year}.${month}.${day} ${hour}:${minute}`;
}

export function SurveyResponseListPage() {
  const navigate = useNavigate();
  const { id: surveyId } = useParams<{ id: string }>();
  const [survey, setSurvey] = useState<SurveyDetailResponse | null>(null);
  const [responses, setResponses] = useState<SurveyResponseWithAnswers[]>([]);
  const [analytics, setAnalytics] = useState<SurveyAnalyticsResponse | null>(null);
  const [activeView, setActiveView] = useState<ResponseView>("summary");
  const [loading, setLoading] = useState(true);
  const [sheetBusy, setSheetBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedRespondent, setSelectedRespondent] = useState<SurveyResponseRecord["user"]>(null);

  const client = useMemo(() => createApiClient({ baseUrl: resolveApiBaseUrl() }), []);
  const { data: session, isLoading: sessionLoading } = useCurrentSession();
  const { toast } = useToast();
  const showInitialLoading = loading && !survey;

  const fetchSurveyAndResponses = async () => {
    if (!surveyId) return;
    try {
      const [surveyData, responsesData, analyticsData] = await Promise.all([
        client.getSurveyDetail(surveyId),
        client.listResponsesWithAnswers(surveyId),
        client.getSurveyAnalytics(surveyId),
      ]);
      setSurvey(surveyData);
      setResponses(responsesData);
      setAnalytics(analyticsData);
    } catch {
      setError("데이터를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (sessionLoading || !hasSurveyManagePermission(session?.permission)) {
      return;
    }
    fetchSurveyAndResponses();
  }, [surveyId, client, session, sessionLoading]);

  const handleSheet = async () => {
    if (!surveyId || sheetBusy) return;
    if (survey?.spreadsheetUrl) {
      window.open(survey.spreadsheetUrl, "_blank", "noopener,noreferrer");
      return;
    }
    setSheetBusy(true);
    try {
      const updated = await client.connectSurveySpreadsheet(surveyId);
      setSurvey((current) => current ? { ...current, ...updated } : current);
      if (updated.spreadsheetUrl) {
        window.open(updated.spreadsheetUrl, "_blank", "noopener,noreferrer");
      }
    } catch {
      toast({ type: "error", message: "Google Sheets를 연결하지 못했습니다. Google 계정 연결과 OAuth 권한을 확인해주세요." });
    } finally {
      setSheetBusy(false);
    }
  };

  // Dynamic Client-Side Filtering, Searching, and Sorting
  const filteredResponses = useMemo(() => {
    let result = [...responses];

    // 1. Search filter matching mock name or email
    if (searchQuery.trim().length > 0) {
      const q = searchQuery.toLowerCase();
      result = result.filter((r) => {
        return formatResponseName(r).toLowerCase().includes(q) || formatResponseEmail(r).toLowerCase().includes(q);
      });
    }

    // 2. Sorting (submittedAt time)
    result.sort((a, b) => {
      const dateA = a.submittedAt ? isoToMs(a.submittedAt) : 0;
      const dateB = b.submittedAt ? isoToMs(b.submittedAt) : 0;
      return sortOrder === "desc" ? dateB - dateA : dateA - dateB;
    });

    return result;
  }, [responses, searchQuery, sortOrder]);

  // Total pages
  const totalPages = Math.max(1, Math.ceil(filteredResponses.length / pageSize));
  const rangeStart = filteredResponses.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const rangeEnd = Math.min(filteredResponses.length, currentPage * pageSize);

  // Paginated List
  const paginatedResponses = useMemo(() => {
    const startIdx = (currentPage - 1) * pageSize;
    return filteredResponses.slice(startIdx, startIdx + pageSize);
  }, [filteredResponses, currentPage, pageSize]);

  // Adjust page number if filtered list shrinks
  useEffect(() => {
    if (currentPage > 1 && currentPage > totalPages) {
      setCurrentPage(Math.max(1, totalPages));
    }
  }, [filteredResponses, totalPages, currentPage]);

  // Generate page items exactly as `< 1 2 3 ... 29 >`
  return (
    <AuthGuard requirePermission={Permissions.MANAGE_SURVEY}>
      <AdminPageShell>
        <AdminPageMain className="gap-5">
          <Breadcrumbs breadcrumbs={[{ label: "설문조사 관리", to: "/admin/surveys" }, { label: "설문 응답" }]} />

          <AdminPageHeader
            title="설문 응답"
            actions={
              <>
              <Button variant="outline" onClick={() => navigate("/admin/surveys")}>
                <ChevronLeft className="size-4" />
                목록으로
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleSheet}
                disabled={sheetBusy || !survey}
              >
                <Sheet className="size-4" />
                <span>Google Sheets에서 보기 ↗</span>
              </Button>
              </>
            }
          />

          {survey && (
            <AdminCard className="flex min-h-16 flex-wrap items-center justify-between gap-3 px-5 py-3">
              <div className="flex min-w-0 items-center gap-2">
                <span className="truncate text-sm font-normal text-[#172033]" title={survey.titleKo}>{survey.titleKo}</span>
                <SurveyStatusBadge survey={survey} showDday={false} size="sm" />
              </div>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs font-normal text-[#344054]"><span>{format24hDateTime(survey.opensAt) ?? "상시"}</span><span>응답 {responses.length}건</span></div>
            </AdminCard>
          )}

          <SegmentedControl
            ariaLabel="설문 응답 보기"
            role="tablist"
            value={activeView}
            onChange={setActiveView}
            className="w-fit"
            options={[
              { value: "summary", label: "요약" },
              { value: "questions", label: "문항별" },
              { value: "individual", label: "개별 응답" },
            ]}
          />

          {!showInitialLoading && error ? <div className="rounded-lg border border-red-200 bg-white px-4 py-3 text-sm font-normal text-red-700">{error}</div> : null}
          {!showInitialLoading && !error && activeView === "summary" && analytics ? <SurveyResponseSummary analytics={analytics} responses={responses} /> : null}
          {!showInitialLoading && !error && activeView === "questions" && analytics && survey ? (
            <SurveyQuestionSummary analytics={analytics} questions={survey.sections.flatMap((section) => section.questions)} responses={responses} />
          ) : null}

          {/* Search and sort filters remain visible in the toolbar. */}
          {!showInitialLoading && !error && activeView === "individual" ? <AdminTableCard className="overflow-visible">
            <div className="border-b border-slate-100 p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <SegmentedControl
                ariaLabel="응답 정렬"
                options={[
                  { value: "desc" as const, label: "최신순" },
                  { value: "asc" as const, label: "오래된순" },
                ]}
                value={sortOrder}
                onChange={(value) => {
                  setSortOrder(value);
                  setCurrentPage(1);
                }}
              />
              <div className="min-w-0 flex-1">
                <PageSearchField
                  ariaLabel="응답 검색"
                  className="w-full lg:w-auto"
                  onChange={(value) => {
                    setSearchQuery(value);
                    setCurrentPage(1);
                  }}
                  onClear={() => {
                    setSearchQuery("");
                    setCurrentPage(1);
                  }}
                  placeholder="이름, 이메일 검색"
                  value={searchQuery}
                />
              </div>
            </div>
          </div>


          {/* Table */}
          <div className="flex min-w-0 flex-col overflow-visible">
            
            {filteredResponses.length === 0 && (
              <AdminEmptyState message="조건에 맞는 응답이 없습니다." />
            )}

            {filteredResponses.length > 0 && (
              <div className="bg-white">
                <AdminDataTable minWidth={1076}>
                  <colgroup>
                    <col style={{ width: 64 }} />
                    <col style={{ width: 180 }} />
                    <col style={{ width: 360 }} />
                    <col style={{ width: 220 }} />
                    <col style={{ width: 180 }} />
                    <col style={{ width: 72 }} />
                  </colgroup>
                    <AdminTableHeader>
                      <tr>
                        <AdminTableHead className="text-center">No.</AdminTableHead>
                        <AdminTableHead className="text-center">이름</AdminTableHead>
                        <AdminTableHead>이메일</AdminTableHead>
                        <AdminTableHead className="text-center">소속 / 학번</AdminTableHead>
                        <AdminTableHead className="text-center">제출일시</AdminTableHead>
                        <AdminTableHead className="text-center">작업</AdminTableHead>
                      </tr>
                    </AdminTableHeader>
                    <AdminTableBody>
                      {paginatedResponses.map((r, index) => {
                        const globalIndex = (currentPage - 1) * pageSize + index;
                        const rowNo = filteredResponses.length - globalIndex;

                        return (
                          <tr key={r.id} className="hover:bg-slate-50/30 transition-colors">
                            {/* No. (center-aligned) */}
                            <AdminTableCell className="text-center tabular-nums">
                              {rowNo}
                            </AdminTableCell>

                            {/* 이름 (center-aligned) */}
                            <AdminTableCell className="text-center">
                              {r.user?.nameKo ? (
                                <button
                                  type="button"
                                  className="admin-table-text-emphasis max-w-full truncate text-left underline-offset-4 hover:underline"
                                  onClick={() => setSelectedRespondent(r.user)}
                                >
                                  {r.user.nameKo}
                                </button>
                              ) : (
                                <span className="admin-table-text">—</span>
                              )}
                            </AdminTableCell>

                            {/* 이메일 (left-aligned) */}
                            <AdminTableCell truncate title={formatResponseEmail(r)}>
                              {formatResponseEmail(r)}
                            </AdminTableCell>

                            {/* 소속 / 학번 (center-aligned) */}
                            <AdminTableCell className="text-center">
                              {formatResponseDepartment(r)}
                            </AdminTableCell>

                            {/* 제출일시 (center-aligned, single line, 24h format, treated date & time equally) */}
                            <AdminTableCell className="text-center tabular-nums">
                              {r.submittedAt ? format24hDateTime(r.submittedAt) : "—"}
                            </AdminTableCell>

                            {/* 작업 (center-aligned) */}
                            <AdminTableCell className="text-center">
                                <IconButton
                                  size="sm"
                                  tone="table-action"
                                  onClick={() => navigate(`/admin/surveys/${surveyId}/responses/${r.id}`)}
                                  aria-label="응답 상세 확인"
                                  title="응답 상세 확인"
                                >
                                  <Eye className="size-4" strokeWidth={1.5} />
                                </IconButton>
                            </AdminTableCell>
                          </tr>
                        );
                      })}
                    </AdminTableBody>
                </AdminDataTable>
              </div>
            )}

            <div className="border-t border-slate-100 bg-slate-50/10 px-6 py-4 select-none bg-white">
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
                range={`총 ${filteredResponses.length}건 중 ${rangeStart}–${rangeEnd}`}
                totalPages={totalPages}
              />
            </div>

          </div>
          </AdminTableCard> : null}
        </AdminPageMain>
        <SurveyRespondentDrawer
          user={selectedRespondent}
          onClose={() => setSelectedRespondent(null)}
        />
      </AdminPageShell>
    </AuthGuard>
  );
}
