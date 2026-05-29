import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { createApiClient } from "@soc/api-client";
import type { SurveyRecord } from "@soc/contracts";
import { resolveApiBaseUrl } from "@/lib/api";
import { AuthGuard } from "@/components/guards/auth-guard";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";
import { Pagination } from "@/components/ui/pagination";
import { SurveyStatusBadge } from "@/components/ui/survey-status-badge";
import { useCurrentSession } from "@/hooks/use-current-session";
import { hasSurveyManagePermission, Permissions } from "@/lib/permissions";
import { 
  Copy, 
  Edit2, 
  BarChart3, 
  ClipboardList,
  Trash2, 
  Link2, 
  Loader2,
  Search,
  MoreVertical,
  Calendar,
  ChevronDown
} from "lucide-react";

// Atom dropdown option structure
interface DropdownOption {
  value: string;
  label: string;
}

// Custom select/dropdown component to standardize filters (Atom-Molecule based)
interface CustomDropdownProps {
  label: string;
  value: string;
  options: DropdownOption[];
  onChange: (val: string) => void;
  icon?: React.ReactNode;
  className?: string;
}

function CustomDropdown({
  label,
  value,
  options,
  onChange,
  icon,
  className = ""
}: CustomDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption = options.find((opt) => opt.value === value) || options[0];

  return (
    <div className={`flex flex-col gap-2.5 relative ${className}`}>
      {/* Label with standardized spacing */}
      <span className="text-[12px] font-bold text-slate-400 select-none tracking-tight">
        {label}
      </span>
      
      {/* Dropdown Toggle Button with standardized blocky R-value */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-[13px] font-semibold text-slate-800 hover:bg-slate-50 transition-all cursor-pointer shadow-sm focus:outline-none"
      >
        <div className="flex items-center gap-2 truncate">
          {icon}
          <span className="truncate">{selectedOption?.label}</span>
        </div>
        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {/* Standardized Dropdown Options List with faint shadow and matching R-value */}
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.06)] py-1.5 z-50 animate-in fade-in slide-in-from-top-1 duration-150 select-none">
            {options.map((opt) => {
              const isSelected = opt.value === value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    onChange(opt.value);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left px-3.5 py-2 text-[13px] font-semibold transition-colors cursor-pointer border-0 bg-transparent flex items-center justify-between ${
                    isSelected
                      ? "text-kaist-darkgreen bg-[#e6f4ea]/40 font-bold"
                      : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <span>{opt.label}</span>
                  {isSelected && (
                    <span className="w-1.5 h-1.5 rounded-full bg-kaist-darkgreen" />
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// Convert timestamp to 24-hour format
function format24hDateTime(dateIso: string | null) {
  if (!dateIso) return null;
  const d = new Date(dateIso);
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
  const d = new Date(dateIso);
  if (isNaN(d.getTime())) return "—";

  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
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

// Standardized single kind badge (removed anonymity badge)
function renderTypeBadge(s: SurveyRecord) {
  let kindBadge = { label: "설문", color: "bg-teal-50 text-teal-700 border-teal-200" };
  if (s.kind === "VOTE") {
    kindBadge = { label: "투표", color: "bg-purple-50 text-purple-700 border-purple-200" };
  } else if (s.kind === "APPLICATION") {
    kindBadge = { label: "신청", color: "bg-blue-50 text-blue-700 border-blue-200" };
  }

  return (
    <div className="flex items-center justify-center select-none w-full">
      <span className={`inline-flex items-center justify-center rounded-md text-[11.5px] font-extrabold border w-[46px] h-[21px] text-center leading-none ${kindBadge.color}`}>
        {kindBadge.label}
      </span>
    </div>
  );
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
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [periodFilter, setPeriodFilter] = useState("all");
  const [sortBy, setSortBy] = useState("updatedAt");
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [isPageSizeDropdownOpen, setIsPageSizeDropdownOpen] = useState(false);
  const [activeRowDropdown, setActiveRowDropdown] = useState<{
    id: string;
    top: number;
    left: number;
    placement: "up" | "down";
  } | null>(null);

  const client = useMemo(() => createApiClient({ baseUrl: resolveApiBaseUrl() }), []);
  const { data: session, isLoading: sessionLoading } = useCurrentSession();
  const { confirm: requestConfirm, ConfirmDialog } = useConfirmDialog();

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

  const handleDelete = async (id: string, title: string) => {
    const confirmed = await requestConfirm({
      confirmLabel: "삭제",
      description: "삭제한 설문조사는 복구할 수 없습니다.",
      title: `"${title}" 설문조사를 삭제하시겠습니까?`,
      tone: "danger",
    });
    if (!confirmed) return;

    setDeleting(id);
    try {
      await client.deleteSurvey(id);
      setSurveys((prev) => prev.filter((s) => s.id !== id));
    } catch {
      alert("삭제에 실패했습니다.");
    } finally {
      setDeleting(null);
    }
  };

  const handleDuplicate = async (id: string, title: string) => {
    const confirmed = await requestConfirm({
      confirmLabel: "복제",
      description: "기존 설문 설정과 문항을 복사한 새 설문조사를 만듭니다.",
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
    const menuWidth = 144;
    const menuHeight = 124;
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

  const handleResetFilters = () => {
    setSearchQuery("");
    setStatusFilter("all");
    setTypeFilter("all");
    setPeriodFilter("all");
    setSortBy("updatedAt");
    setPageSize(10);
    setCurrentPage(1);
  };

  // Perform Dynamic Client-Side Filtering & Sorting
  const filteredSurveys = useMemo(() => {
    let result = [...surveys];

    // 1. Search Query (Title or Description)
    if (searchQuery.trim().length > 0) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (s) =>
          s.titleKo.toLowerCase().includes(q) ||
          (s.titleEn && s.titleEn.toLowerCase().includes(q)) ||
          (s.descriptionKo && s.descriptionKo.toLowerCase().includes(q)) ||
          (s.descriptionEn && s.descriptionEn.toLowerCase().includes(q))
      );
    }

    // 2. Status Filter
    if (statusFilter !== "all") {
      result = result.filter((s) => {
        if (statusFilter === "draft") return s.status === "draft";
        if (statusFilter === "closed") {
          return s.status === "closed" || (s.closesAt && new Date(s.closesAt) < new Date());
        }
        if (statusFilter === "open") {
          const isBeforeOpen = s.opensAt && new Date(s.opensAt) > new Date();
          const isClosed = s.closesAt && new Date(s.closesAt) < new Date();
          return s.status !== "draft" && !isBeforeOpen && !isClosed;
        }
        return true;
      });
    }

    // 3. Type Filter
    if (typeFilter !== "all") {
      result = result.filter((s) => s.kind === typeFilter);
    }

    // 4. Period Filter (Based on createdAt)
    if (periodFilter !== "all") {
      const now = new Date();
      result = result.filter((s) => {
        const dateToCheck = new Date(s.createdAt);
        const diffMs = now.getTime() - dateToCheck.getTime();
        const diffDays = diffMs / (1000 * 60 * 60 * 24);

        if (periodFilter === "7days") return diffDays <= 7;
        if (periodFilter === "30days") return diffDays <= 30;
        if (periodFilter === "1year") return diffDays <= 365;
        return true;
      });
    }

    // 5. Sorting
    result.sort((a, b) => {
      if (sortBy === "updatedAt") {
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      }
      if (sortBy === "createdAt") {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      if (sortBy === "responseCount") {
        return (b.responseCount ?? 0) - (a.responseCount ?? 0);
      }
      return 0;
    });

    return result;
  }, [surveys, searchQuery, statusFilter, typeFilter, periodFilter, sortBy]);

  // Total pages
  const totalPages = Math.max(1, Math.ceil(filteredSurveys.length / pageSize));

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
      <div className="min-h-screen bg-slate-50/50 text-kaist-black">
        {ConfirmDialog}
        <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 md:px-8">
          
          {/* Compact Header */}
          <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-5 select-none md:flex-row md:items-center">
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-800">설문조사 관리</h1>
              <p className="mt-1 text-[13px] font-semibold text-slate-400 leading-relaxed">
                집행위원회 행사 및 각종 안건 수렴을 위한 설문조사 개설/관리 도구입니다.
              </p>
            </div>
            <button
              onClick={() => navigate("/admin/surveys/new")}
              className="px-4.5 py-2.5 bg-kaist-darkgreen text-white font-extrabold text-sm rounded-xl hover:bg-[#0f5c29] transition-all flex items-center gap-2 cursor-pointer shadow-sm border-0 shrink-0"
            >
              <span>+ 새 설문조사</span>
            </button>
          </div>

          {/* Filter Card (Removed "Reset Filters" button, redistributed columns evenly to 12) */}
          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_8px_30px_rgba(0,0,0,0.015)] select-none">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
              {/* Search */}
              <div className="md:col-span-3 flex flex-col gap-2.5">
                <span className="text-xs font-bold text-slate-400 tracking-tight">검색</span>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="제목, 설명 검색"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="pl-9 pr-3 py-2.5 w-full rounded-xl border border-slate-200 bg-white text-[13px] font-semibold text-slate-800 focus:outline-none focus:border-kaist-darkgreen focus:ring-2 focus:ring-kaist-darkgreen/10 transition-colors placeholder:text-slate-400"
                  />
                </div>
              </div>

              {/* Status */}
              <CustomDropdown
                label="상태"
                value={statusFilter}
                options={[
                  { value: "all", label: "전체" },
                  { value: "open", label: "진행중" },
                  { value: "closed", label: "마감" },
                  { value: "draft", label: "임시저장" }
                ]}
                onChange={setStatusFilter}
                className="md:col-span-2"
              />

              {/* Type */}
              <CustomDropdown
                label="유형"
                value={typeFilter}
                options={[
                  { value: "all", label: "전체" },
                  { value: "SURVEY", label: "설문" },
                  { value: "VOTE", label: "투표" },
                  { value: "APPLICATION", label: "신청" }
                ]}
                onChange={setTypeFilter}
                className="md:col-span-2"
              />

              {/* Period */}
              <CustomDropdown
                label="기간"
                value={periodFilter}
                options={[
                  { value: "all", label: "전체 기간" },
                  { value: "7days", label: "최근 7일" },
                  { value: "30days", label: "최근 30일" },
                  { value: "1year", label: "최근 1년" }
                ]}
                onChange={setPeriodFilter}
                icon={<Calendar className="h-4 w-4 text-slate-400 shrink-0" />}
                className="md:col-span-2"
              />

              {/* Sort */}
              <CustomDropdown
                label="정렬"
                value={sortBy}
                options={[
                  { value: "updatedAt", label: "최근 수정일" },
                  { value: "createdAt", label: "최근 생성일" },
                  { value: "responseCount", label: "응답자 수" }
                ]}
                onChange={setSortBy}
                className="md:col-span-3"
              />
            </div>
          </div>

          {/* Table Container Card */}
          <div className="rounded-2xl border border-slate-100 bg-white shadow-[0_8px_30px_rgba(0,0,0,0.015)] flex flex-col overflow-visible">
            
            {/* Table Header controls inside the card */}
            <div className="flex items-center justify-between px-6 pt-5 pb-3 select-none bg-white">
              <h2 className="text-base font-extrabold text-slate-800 tracking-tight">설문 목록</h2>
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
                    <div className="absolute top-full right-0 mt-1.5 w-28 bg-white border border-slate-200 rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.06)] py-1.5 z-50 animate-in fade-in slide-in-from-top-1 duration-150 select-none">
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
            </div>

            {loading && (
              <div className="flex flex-col items-center justify-center py-20 gap-3 select-none">
                <Loader2 className="w-8 h-8 text-kaist-darkgreen animate-spin" />
                <p className="text-xs font-bold text-slate-400">설문 목록을 불러오는 중입니다...</p>
              </div>
            )}
            
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-2xl text-sm font-semibold mb-6 select-none mx-6 mt-4">
                {error}
              </div>
            )}

            {!loading && !error && filteredSurveys.length === 0 && (
              <div className="text-center py-20 text-slate-400 font-bold border border-dashed border-slate-100 rounded-2xl bg-slate-50/30 select-none mx-6 mb-6">
                검색 및 필터 조건에 부합하는 설문조사가 없습니다.
              </div>
            )}

            {!loading && filteredSurveys.length > 0 && (
              <div className="bg-white border-t border-slate-100">
                <div className="overflow-x-auto overflow-y-visible">
                  <table className="w-full text-sm divide-y divide-slate-100 border-collapse">
                    <thead className="bg-slate-50/50 text-slate-500 text-[13px] font-extrabold border-b border-slate-100 select-none">
                      <tr>
                        {/* Title column left-aligned */}
                        <th className="px-5 py-4 text-left min-w-[240px]">제목</th>
                        
                        {/* All other columns are center-aligned with increased header text size */}
                        <th className="px-4 py-4 text-center w-28">상태</th>
                        <th className="px-4 py-4 text-center w-24">유형</th>
                        <th className="px-4 py-4 text-center w-24">응답자 수</th>
                        <th className="px-4 py-4 text-center w-52">기간</th>
                        <th className="px-4 py-4 text-center w-36">최근 수정</th>
                        <th className="px-4 py-4 text-center w-32">작업</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                      {paginatedSurveys.map((s) => (
                        <tr key={s.id} className="hover:bg-slate-50/30 transition-colors">
                          {/* Title (left-aligned) */}
                          <td className="px-5 py-4 text-left">
                            <div className="flex flex-col gap-1">
                              <span 
                                className="text-sm font-extrabold text-slate-800 hover:text-kaist-darkgreen transition-colors cursor-pointer"
                                onClick={() => navigate(`/admin/surveys/${s.id}/edit`)}
                              >
                                {s.titleKo}
                              </span>
                              {s.descriptionKo && (
                                <span className="text-[11.5px] font-semibold text-slate-400 leading-normal line-clamp-1">
                                  {s.descriptionKo}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Status Badge (center-aligned, single line) */}
                          <td className="px-4 py-4 text-center">
                            <SurveyStatusBadge survey={s} />
                          </td>

                          {/* Type Badge (center-aligned, single kind badge) */}
                          <td className="px-4 py-4 text-center">
                            {renderTypeBadge(s)}
                          </td>

                          {/* Response Count (center-aligned) */}
                          <td className="px-4 py-4 text-center text-[13.5px] font-extrabold text-slate-800">
                            {s.status === "draft" ? "—" : `${s.responseCount ?? 0}명`}
                          </td>

                          {/* Duration Column (center-aligned, double line, tight spacing, dates and times treated with equal contrast, 24h format) */}
                          <td className="px-4 py-4 text-center leading-normal">
                            {(() => {
                              const start = format24hDateTime(s.opensAt);
                              const end = format24hDateTime(s.closesAt);
                              
                              if (!start && !end) return <span className="text-slate-400 text-xs font-bold">—</span>;

                              return (
                                <div className="flex flex-col items-center justify-center text-xs tracking-tight gap-0.5 leading-none">
                                  {start ? (
                                    <div className="flex items-center gap-1 select-none">
                                      <span className="text-slate-600 font-semibold">{start.dateStr} {start.timeStr}</span>
                                    </div>
                                  ) : (
                                    <span className="text-slate-400 font-semibold">—</span>
                                  )}
                                  {end ? (
                                    <div className="flex items-center gap-1 select-none">
                                      <span className="text-slate-600 font-semibold select-none mr-0.5">~</span>
                                      <span className="text-slate-600 font-semibold">{end.dateStr} {end.timeStr}</span>
                                    </div>
                                  ) : (
                                    <span className="text-slate-400 font-semibold">—</span>
                                  )}
                                </div>
                              );
                            })()}
                          </td>

                          {/* Last Modified Column (center-aligned, light/low-prominence relative time) */}
                          <td className="px-4 py-4 text-center text-xs leading-none">
                            <span className="text-slate-400 font-semibold text-[11.5px] select-none whitespace-nowrap">
                              {formatRelativeTime(s.updatedAt)}
                            </span>
                          </td>

                          {/* Actions (center-aligned) */}
                          <td className="px-4 py-4 text-center relative">
                            <div className="flex items-center justify-center gap-1.5 text-slate-400 select-none">
                              {/* Edit */}
                              <button
                                onClick={() => navigate(`/admin/surveys/${s.id}/edit`)}
                                title="편집"
                                className="p-1.5 hover:bg-emerald-50 text-emerald-600 hover:text-emerald-700 rounded-lg transition-colors cursor-pointer border-0 bg-transparent shrink-0"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              
                              {/* Response List */}
                              <button
                                onClick={() => navigate(`/admin/surveys/${s.id}/responses`)}
                                title="응답 목록"
                                className="p-1.5 hover:bg-teal-50 text-teal-600 hover:text-teal-700 rounded-lg transition-colors cursor-pointer border-0 bg-transparent shrink-0"
                              >
                                <ClipboardList className="w-4 h-4" />
                              </button>

                              {/* Results Summary */}
                              <button
                                onClick={() => navigate(`/survey/${s.id}/results`)}
                                title="결과 보기"
                                className="p-1.5 hover:bg-sky-50 text-sky-600 hover:text-sky-700 rounded-lg transition-colors cursor-pointer border-0 bg-transparent shrink-0"
                              >
                                <BarChart3 className="w-4 h-4" />
                              </button>

                              {/* More Dropdown containing Duplicate, Copy Link, and Delete */}
                              <div className="relative isolate">
                                <button
                                  onClick={(event) => openRowDropdown(s.id, event.currentTarget)}
                                  title="더보기"
                                  className={`p-1.5 rounded-lg transition-colors cursor-pointer border-0 bg-transparent shrink-0 ${
                                    activeRowDropdown?.id === s.id
                                      ? "bg-slate-100 text-slate-800"
                                      : "hover:bg-slate-50 text-slate-400 hover:text-slate-700"
                                  }`}
                                >
                                  <MoreVertical className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeRowDropdown && createPortal(
              <>
                <div className="fixed inset-0 z-[80]" onClick={() => setActiveRowDropdown(null)} />
                <div
                  className={`fixed w-36 bg-white border border-slate-200 rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.06)] py-1.5 z-[90] select-none ${
                    activeRowDropdown.placement === "up"
                      ? "animate-in fade-in slide-in-from-bottom-1 duration-150"
                      : "animate-in fade-in slide-in-from-top-1 duration-150"
                  }`}
                  style={{ top: activeRowDropdown.top, left: activeRowDropdown.left }}
                >
                  <button
                    onClick={() => {
                      setActiveRowDropdown(null);
                      const target = surveys.find((survey) => survey.id === activeRowDropdown.id);
                      if (target) handleDuplicate(target.id, target.titleKo);
                    }}
                    disabled={duplicating === activeRowDropdown.id}
                    className="w-full text-left px-3.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-2 transition-colors cursor-pointer border-0 bg-transparent"
                  >
                    <Copy className="w-3.5 h-3.5 text-slate-400" />
                    <span>설문 복제</span>
                  </button>

                  <button
                    onClick={() => {
                      setActiveRowDropdown(null);
                      copyLink(activeRowDropdown.id);
                    }}
                    className="w-full text-left px-3.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-2 transition-colors cursor-pointer border-0 bg-transparent"
                  >
                    <Link2 className="w-3.5 h-3.5 text-slate-400" />
                    <span>링크 복사</span>
                  </button>

                  <div className="border-t border-slate-100 my-1" />

                  <button
                    onClick={() => {
                      const target = surveys.find((survey) => survey.id === activeRowDropdown.id);
                      setActiveRowDropdown(null);
                      if (target) handleDelete(target.id, target.titleKo);
                    }}
                    disabled={deleting === activeRowDropdown.id}
                    className="w-full text-left px-3.5 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 flex items-center gap-2 transition-colors cursor-pointer border-0 bg-transparent disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>설문 삭제</span>
                  </button>
                </div>
              </>,
              document.body,
            )}

            {/* Premium Pagination Footer block (inside the card container, separated by a top border, styled exactly like the bulletin board) */}
            <div className="border-t border-slate-100 bg-slate-50/10 px-6 py-4 flex items-center justify-center gap-2 select-none">
              <Pagination
                currentPage={currentPage}
                onPageChange={setCurrentPage}
                totalPages={totalPages}
              />
            </div>

          </div>
        </main>
      </div>
    </AuthGuard>
  );
}
