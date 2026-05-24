import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { createApiClient } from "@soc/api-client";
import type { SurveyResponseRecord } from "@soc/contracts";
import { resolveApiBaseUrl } from "@/lib/api";
import { AuthGuard } from "@/components/guards/auth-guard";
import { useCurrentSession } from "@/hooks/use-current-session";
import { hasSurveyManagePermission, Permissions } from "@/lib/permissions";
import { 
  ClipboardList, 
  ChevronLeft, 
  ChevronRight,
  Loader2,
  Calendar,
  Users,
  Search,
  Filter,
  ChevronDown,
  Download,
} from "lucide-react";

function formatResponseName(response: SurveyResponseRecord) {
  return response.user?.nameKo ?? (response.externalPhone ? "외부 응답자" : "—");
}

function formatResponseEmail(response: SurveyResponseRecord) {
  return response.user?.email ?? response.externalPhone ?? "—";
}

function formatResponseDepartment(response: SurveyResponseRecord) {
  if (!response.user) return response.externalPhone ?? "—";
  const parts = [response.user.departmentKo, response.user.stdNo].filter(Boolean);
  return parts.length > 0 ? parts.join(" / ") : "—";
}

// Convert timestamp to 24-hour single line format
function format24hDateTime(dateIso: string | null) {
  if (!dateIso) return null;
  const d = new Date(dateIso);
  if (isNaN(d.getTime())) return null;

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hour = String(d.getHours()).padStart(2, "0");
  const minute = String(d.getMinutes()).padStart(2, "0");

  return `${year}.${month}.${day} ${hour}:${minute}`;
}

// Single-line consolidated status badge for survey cards
function renderSurveyStatusBadge(survey: any) {
  if (!survey) return null;
  if (!survey.isPublished && survey.status === "draft") {
    return (
      <span className="inline-flex items-center justify-center rounded-md bg-slate-50 px-2 py-0.5 text-[10.5px] font-extrabold text-slate-500 border border-slate-200 whitespace-nowrap">
        임시저장
      </span>
    );
  }
  if (survey.closesAt && new Date(survey.closesAt) < new Date()) {
    return (
      <span className="inline-flex items-center justify-center rounded-md bg-rose-50 px-2 py-0.5 text-[10.5px] font-extrabold text-rose-700 border border-rose-200 whitespace-nowrap">
        마감
      </span>
    );
  }
  return (
    <span className="inline-flex items-center justify-center rounded-md bg-emerald-50 px-2 py-0.5 text-[10.5px] font-extrabold text-emerald-700 border border-emerald-200 whitespace-nowrap">
      진행중
    </span>
  );
}

export function SurveyResponseListPage() {
  const navigate = useNavigate();
  const { id: surveyId } = useParams<{ id: string }>();
  const [survey, setSurvey] = useState<any>(null);
  const [responses, setResponses] = useState<SurveyResponseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState("desc"); // desc: 최신순, asc: 오래된순
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [isPageSizeDropdownOpen, setIsPageSizeDropdownOpen] = useState(false);

  const client = useMemo(() => createApiClient({ baseUrl: resolveApiBaseUrl() }), []);
  const { data: session, isLoading: sessionLoading } = useCurrentSession();
  const [exporting, setExporting] = useState(false);

  const fetchSurveyAndResponses = async () => {
    if (!surveyId) return;
    try {
      const surveyData = await client.getSurveyDetail(surveyId);
      setSurvey(surveyData);
      const responsesData = await client.listResponses(surveyId);
      setResponses(responsesData);
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

  const handleExportCSV = async () => {
    if (!surveyId) return;
    setExporting(true);
    try {
      const detail = await client.getSurveyDetail(surveyId);
      const allQuestions = detail.sections.flatMap((s) => s.questions);
      const data = await client.listResponsesWithAnswers(surveyId);

      const csvCell = (val: any) => {
        if (val === null || val === undefined) return '""';
        const str = String(val);
        return `"${str.replace(/"/g, '""')}"`;
      };

      const headers = [
        "No.",
        "이름",
        "이메일",
        "소속 / 학번",
        "제출 시각",
        "상태",
        ...allQuestions.map((q) => q.titleKo),
      ];

      const rows = data.map((r, idx) => {
        const answerCols = allQuestions.map((q) => {
          const ans = r.answers.find((a) => a.questionId === q.id);
          if (!ans || !ans.content) return "";
          const content = ans.content as Record<string, any>;
          if (q.questionType === "multiple_choice") {
            return (content.values as string[])?.join(" | ") || "";
          }
          if ("text" in content) return String(content.text);
          if ("value" in content) return String(content.value);
          if ("date" in content) return String(content.date);
          if ("time" in content) return String(content.time);
          if ("datetime" in content) return String(content.datetime);
          return JSON.stringify(content);
        });

        return [
          String(data.length - idx),
          formatResponseName(r),
          formatResponseEmail(r),
          formatResponseDepartment(r),
          r.submittedAt ? format24hDateTime(r.submittedAt) : "—",
          r.status,
          ...answerCols,
        ];
      });

      const csvContent = [
        headers.map(csvCell).join(","),
        ...rows.map((row) => row.map(csvCell).join(",")),
      ].join("\n");

      const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `survey_responses_${surveyId}.csv`);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error(err);
      alert("CSV 내보내기에 실패했습니다.");
    } finally {
      setExporting(false);
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
      const dateA = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
      const dateB = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
      return sortOrder === "desc" ? dateB - dateA : dateA - dateB;
    });

    return result;
  }, [responses, searchQuery, sortOrder]);

  // Total pages
  const totalPages = Math.max(1, Math.ceil(filteredResponses.length / pageSize));

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
  const getPaginationItems = () => {
    const items: (number | string)[] = [];
    const total = totalPages || 1;
    
    if (total <= 7) {
      for (let i = 1; i <= total; i++) {
        items.push(i);
      }
    } else {
      if (currentPage <= 4) {
        for (let i = 1; i <= 5; i++) {
          items.push(i);
        }
        items.push("...");
        items.push(total);
      } else if (currentPage >= total - 3) {
        items.push(1);
        items.push("...");
        for (let i = total - 4; i <= total; i++) {
          items.push(i);
        }
      } else {
        items.push(1);
        items.push("...");
        items.push(currentPage - 1);
        items.push(currentPage);
        items.push(currentPage + 1);
        items.push("...");
        items.push(total);
      }
    }
    return items;
  };

  return (
    <AuthGuard requirePermission={Permissions.MANAGE_SURVEY}>
      <div className="min-h-screen bg-slate-50/50 text-kaist-black">
        <main className="mx-auto flex w-full max-w-7xl flex-col gap-5.5 px-4 py-8 md:px-8">
          
          {/* Breadcrumb matching exact path */}
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400 select-none">
            <span>설문조사 관리</span>
            <span className="text-[10px]">&gt;</span>
            <span className="text-slate-600 font-extrabold">응답 목록</span>
          </div>

          {/* Compact Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between pb-1 gap-4 select-none">
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-800">응답 목록</h1>
              <p className="mt-1 text-[13px] font-semibold text-slate-400 leading-relaxed">
                설문조사에 제출된 응답을 확인하고 관리할 수 있습니다.
              </p>
            </div>
            
            <div className="flex items-center gap-2.5">
              <button
                onClick={() => navigate("/admin/surveys")}
                className="px-4 py-2.5 border border-slate-200 bg-white text-slate-700 hover:text-slate-900 font-bold text-sm rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer border-1"
              >
                <ChevronLeft className="w-4 h-4 text-slate-500" />
                <span>설문 목록으로</span>
              </button>
              
              <button
                onClick={handleExportCSV}
                disabled={exporting}
                className="px-4.5 py-2.5 bg-kaist-darkgreen text-white font-extrabold text-sm rounded-xl hover:bg-[#0f5c29] transition-all flex items-center gap-2 cursor-pointer shadow-sm border-0 disabled:opacity-50"
              >
                {exporting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>내보내는 중...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>엑셀 다운로드</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Survey Info Card */}
          {survey && (
            <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-[0_8px_30px_rgba(0,0,0,0.01)] flex flex-col md:flex-row md:items-center justify-between gap-6 select-none">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full divide-y md:divide-y-0 md:divide-x divide-slate-100">
                {/* 1. Title & Status */}
                <div className="flex items-center gap-4.5 pt-0 md:pt-0 pb-4 md:pb-0 md:pr-4">
                  <div className="w-10 h-10 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-500 shrink-0">
                    <ClipboardList className="w-5 h-5 text-slate-400" />
                  </div>
                  <div className="flex flex-col gap-1 truncate">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-tight">설문조사</span>
                    <div className="flex items-center gap-2 truncate">
                      <h4 className="text-sm font-extrabold text-slate-800 truncate" title={survey.titleKo}>
                        {survey.titleKo}
                      </h4>
                      {renderSurveyStatusBadge(survey)}
                    </div>
                  </div>
                </div>

                {/* 2. Duration */}
                <div className="flex items-center gap-4.5 pt-4 md:pt-0 pb-4 md:pb-0 md:px-6">
                  <div className="w-10 h-10 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-500 shrink-0">
                    <Calendar className="w-5 h-5 text-slate-400" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-tight">기간</span>
                    <span className="text-xs font-bold text-slate-700 leading-tight">
                      {(() => {
                        const start = format24hDateTime(survey.opensAt);
                        const end = format24hDateTime(survey.closesAt);
                        if (!start && !end) return "전체 기간";
                        return `${start || "—"} ~ ${end || "—"}`;
                      })()}
                    </span>
                  </div>
                </div>

                {/* 3. Response count */}
                <div className="flex items-center gap-4.5 pt-4 md:pt-0 pb-0 md:pb-0 md:pl-6">
                  <div className="w-10 h-10 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-500 shrink-0">
                    <Users className="w-5 h-5 text-slate-400" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-tight">응답 수</span>
                    <span className="text-sm font-extrabold text-slate-800 leading-tight">
                      {responses.length}명
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Search & Popover Filter Panel */}
          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_8px_30px_rgba(0,0,0,0.015)] select-none">
            <div className="flex items-center justify-between gap-4">
              {/* Left Search Bar (wide flex layout) */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="이름, 이메일 검색"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="pl-9 pr-3 py-2.5 w-full rounded-xl border border-slate-200 bg-white text-[13px] font-semibold text-slate-800 focus:outline-none focus:border-kaist-darkgreen focus:ring-2 focus:ring-kaist-darkgreen/10 transition-colors placeholder:text-slate-400"
                />
              </div>

              {/* Right Filter Popover dropdown */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsFilterDropdownOpen(!isFilterDropdownOpen)}
                  className={`flex items-center gap-1.5 px-4 py-2.5 border rounded-xl text-[13px] font-bold transition-all shadow-sm cursor-pointer select-none ${
                    isFilterDropdownOpen
                      ? "border-kaist-darkgreen bg-[#e6f4ea]/40 text-kaist-darkgreen"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <Filter className="h-4 w-4 shrink-0" />
                  <span>필터</span>
                  <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${isFilterDropdownOpen ? "rotate-180" : ""}`} />
                </button>

                {isFilterDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsFilterDropdownOpen(false)} />
                    <div className="absolute right-0 mt-2.5 w-72 bg-white border border-slate-200 rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.08)] p-4.5 z-50 animate-in fade-in slide-in-from-top-1 duration-250 flex flex-col gap-4 select-none">
                      {/* 1. Sort Order */}
                      <div className="flex flex-col gap-2">
                        <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider">정렬 기준</span>
                        <div className="bg-slate-100 p-0.5 rounded-lg flex items-stretch select-none">
                          {[
                            { value: "desc", label: "최신순" },
                            { value: "asc", label: "오래된순" }
                          ].map((opt) => {
                            const isActive = sortOrder === opt.value;
                            return (
                              <button
                                key={opt.value}
                                type="button"
                                onClick={() => {
                                  setSortOrder(opt.value);
                                  setCurrentPage(1);
                                }}
                                className={`flex-1 py-1.5 px-1.5 text-[11px] font-bold rounded-md transition-all cursor-pointer text-center whitespace-nowrap border-0 ${
                                  isActive
                                    ? "bg-white text-kaist-darkgreen shadow-xs"
                                    : "bg-transparent text-slate-500 hover:text-slate-800"
                                }`}
                              >
                                {opt.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Table Container Card */}
          <div className="rounded-2xl border border-slate-100 bg-white shadow-[0_8px_30px_rgba(0,0,0,0.015)] flex flex-col overflow-hidden">
            
            {loading && (
              <div className="flex flex-col items-center justify-center py-20 gap-3 select-none bg-white">
                <Loader2 className="w-8 h-8 text-kaist-darkgreen animate-spin" />
                <p className="text-xs font-bold text-slate-400">응답 목록을 불러오는 중입니다...</p>
              </div>
            )}
            
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-2xl text-sm font-semibold mb-6 select-none mx-6 mt-4">
                {error}
              </div>
            )}

            {!loading && !error && filteredResponses.length === 0 && (
              <div className="text-center py-20 text-slate-400 font-bold border border-dashed border-slate-100 rounded-2xl bg-slate-50/30 select-none mx-6 my-6">
                조건에 부합하는 응답 결과가 없습니다.
              </div>
            )}

            {!loading && filteredResponses.length > 0 && (
              <div className="bg-white">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm divide-y divide-slate-100 border-collapse">
                    <thead className="bg-slate-50/50 text-slate-500 text-[13px] font-extrabold border-b border-slate-100 select-none">
                      <tr>
                        <th className="px-4 py-4 text-center w-20">No.</th>
                        <th className="px-4 py-4 text-center w-28">이름</th>
                        <th className="px-5 py-4 text-left">이메일</th>
                        <th className="px-4 py-4 text-center w-48">소속 / 학번</th>
                        <th className="px-4 py-4 text-center w-48">제출일시</th>
                        <th className="px-4 py-4 text-center w-28">작업</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                      {paginatedResponses.map((r, index) => {
                        const globalIndex = (currentPage - 1) * pageSize + index;
                        const rowNo = filteredResponses.length - globalIndex;

                        return (
                          <tr key={r.id} className="hover:bg-slate-50/30 transition-colors">
                            {/* No. (center-aligned) */}
                            <td className="px-4 py-4 text-center text-xs font-bold text-slate-400 select-none">
                              {rowNo}
                            </td>

                            {/* 이름 (center-aligned) */}
                            <td className="px-4 py-4 text-center text-sm font-extrabold text-slate-800">
                              {formatResponseName(r)}
                            </td>

                            {/* 이메일 (left-aligned) */}
                            <td className="px-5 py-4 text-left text-xs font-semibold text-slate-600 truncate max-w-[220px]" title={formatResponseEmail(r)}>
                              {formatResponseEmail(r)}
                            </td>

                            {/* 소속 / 학번 (center-aligned) */}
                            <td className="px-4 py-4 text-center text-xs font-semibold text-slate-500">
                              {formatResponseDepartment(r)}
                            </td>

                            {/* 제출일시 (center-aligned, single line, 24h format, treated date & time equally) */}
                            <td className="px-4 py-4 text-center text-xs font-semibold text-slate-600 select-none">
                              {r.submittedAt ? format24hDateTime(r.submittedAt) : "—"}
                            </td>

                            {/* 작업 (center-aligned) */}
                            <td className="px-4 py-4 text-center relative">
                              <div className="flex items-center justify-center gap-1.5 text-slate-400 select-none">
                                {/* Details magnifying glass icon */}
                                <button
                                  onClick={() => navigate(`/admin/surveys/${surveyId}/responses/${r.id}`)}
                                  title="응답 상세 확인"
                                  className="p-1.5 hover:bg-slate-50 hover:text-kaist-darkgreen rounded-lg transition-colors cursor-pointer border-0 bg-transparent shrink-0"
                                >
                                  <Search className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Premium Pagination Footer block (inside the card container, separated by a top border, styled exactly like the bulletin board) */}
            <div className="border-t border-slate-100 bg-slate-50/10 px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-4 select-none bg-white">
              {/* Total count details */}
              <div className="text-[13px] font-bold text-slate-500">
                <span>총 <strong className="text-kaist-darkgreen font-black">{filteredResponses.length}</strong>개의 응답이 등록되어 있습니다.</span>
              </div>

              {/* Right side: standard dropdown + high-fidelity chevrons & number buttons */}
              <div className="flex items-center gap-4 flex-wrap">
                {/* Custom Page Size Dropdown placed inside the bottom footer bar */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsPageSizeDropdownOpen(!isPageSizeDropdownOpen)}
                    className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-[12px] font-semibold text-slate-700 hover:bg-slate-50 transition-all cursor-pointer shadow-sm focus:outline-none"
                  >
                    <span>{pageSize}개씩 보기</span>
                    <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${isPageSizeDropdownOpen ? "rotate-180" : ""}`} />
                  </button>

                  {isPageSizeDropdownOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setIsPageSizeDropdownOpen(false)} />
                      <div className="absolute bottom-full right-0 mb-1.5 w-28 bg-white border border-slate-200 rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.06)] py-1.5 z-50 animate-in fade-in slide-in-from-bottom-1 duration-150 select-none">
                        {[10, 20, 50].map((size) => {
                          const isSelected = size === pageSize;
                          return (
                            <button
                              key={size}
                              type="button"
                              onClick={() => {
                                setPageSize(size);
                                setCurrentPage(1);
                                setIsPageSizeDropdownOpen(false);
                              }}
                              className={`w-full text-left px-3.5 py-2 text-[12px] font-semibold transition-colors cursor-pointer border-0 bg-transparent flex items-center justify-between ${
                                isSelected
                                  ? "text-kaist-darkgreen bg-[#e6f4ea]/40 font-bold"
                                  : "text-slate-700 hover:bg-slate-50"
                              }`}
                            >
                              <span>{size}개씩 보기</span>
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className={`w-9 h-9 rounded-xl border flex items-center justify-center transition-all ${
                      currentPage === 1
                        ? "bg-white border-slate-100 text-slate-300 cursor-not-allowed"
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 cursor-pointer shadow-sm animate-all"
                    }`}
                  >
                    <ChevronLeft className="h-4 w-4 stroke-[2.5px]" />
                  </button>

                  <div className="flex items-center gap-1.5">
                    {getPaginationItems().map((item, idx) => {
                      if (item === "...") {
                        return (
                          <span key={`dots-${idx}`} className="text-slate-400 text-xs px-1.5 select-none w-9 h-9 flex items-center justify-center">
                            ...
                          </span>
                        );
                      }
                      const page = item as number;
                      const isActive = currentPage === page;
                      return (
                        <button
                          key={page}
                          onClick={() => setCurrentPage(page)}
                          className={`w-9 h-9 rounded-xl text-[13px] font-extrabold tracking-tight transition-all flex items-center justify-center cursor-pointer ${
                            isActive
                              ? "bg-kaist-darkgreen text-white shadow-sm border-0"
                              : "text-slate-500 hover:text-slate-800 bg-transparent border-0"
                          }`}
                        >
                          {page}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className={`w-9 h-9 rounded-xl border flex items-center justify-center transition-all ${
                      currentPage === totalPages
                        ? "bg-white border-slate-100 text-slate-300 cursor-not-allowed"
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 cursor-pointer shadow-sm animate-all"
                    }`}
                  >
                    <ChevronRight className="h-4 w-4 stroke-[2.5px]" />
                  </button>
                </div>
              </div>
            </div>

          </div>
        </main>
      </div>
    </AuthGuard>
  );
}
