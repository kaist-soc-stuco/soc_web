import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { createApiClient } from "@soc/api-client";
import { resolveApiBaseUrl } from "@/lib/api-base-url";
import { useLanguage } from "@/hooks/use-language";
import { Header } from "@/components/organisms/header";
import { Footer } from "@/components/organisms/footer";
import { PageHero } from "@/components/organisms/page-hero";
import { 
  Calendar, 
  Clock, 
  Users, 
  CheckCircle, 
  BarChart3, 
  ArrowRight,
  Vote,
  FileText,
  FileCheck,
  AlertCircle
} from "lucide-react";
import { formatKoreanDateTime } from "@soc/shared";

interface SurveyRecordWithState {
  id: string;
  kind: string;
  resultVisibility: string;
  titleKo: string;
  titleEn: string | null;
  descriptionKo: string | null;
  descriptionEn: string | null;
  status: string;
  computedState: string;
  feePayersOnly: boolean;
  allowAnonymous: boolean;
  isKoreanOnly: boolean;
  opensAt: string | null;
  closesAt: string | null;
  responseCount?: number;
  maxResponses?: number | null;
}

export function EventsSurveysPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { lang } = useLanguage();
  const apiClient = useMemo(() => createApiClient({ baseUrl: resolveApiBaseUrl() }), []);

  const currentTab = searchParams.get("tab") || "event";

  const [items, setItems] = useState<SurveyRecordWithState[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchItems = () => {
    setLoading(true);
    apiClient
      .getPublicSurveys()
      .then((res) => {
        setItems(res as SurveyRecordWithState[]);
        setError(null);
      })
      .catch(() => {
        setError(lang === "ko" ? "목록을 불러오는 중 오류가 발생했습니다." : "Failed to load events and surveys.");
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchItems();
  }, [apiClient]);

  const handleTabChange = (tab: string) => {
    setSearchParams({ tab });
  };

  // Filter items based on tab
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (currentTab === "survey") {
        return item.kind === "SURVEY" || item.kind === "VOTE";
      }
      return item.kind === "APPLICATION";
    });
  }, [items, currentTab]);

  const getKindBadge = (kind: string) => {
    switch (kind) {
      case "VOTE":
        return {
          label: lang === "ko" ? "투표" : "Vote",
          color: "bg-purple-50 text-purple-700 border-purple-200",
          icon: Vote
        };
      case "APPLICATION":
        return {
          label: lang === "ko" ? "신청" : "Application",
          color: "bg-blue-50 text-blue-700 border-blue-200",
          icon: FileCheck
        };
      case "SURVEY":
      default:
        return {
          label: lang === "ko" ? "설문" : "Survey",
          color: "bg-teal-50 text-teal-700 border-teal-200",
          icon: FileText
        };
    }
  };

  const getStatusBadge = (item: SurveyRecordWithState) => {
    if (item.computedState === "before_open") {
      return {
        label: lang === "ko" ? "시작 전" : "Upcoming",
        color: "bg-amber-50 text-amber-700 border-amber-200"
      };
    }
    if (item.computedState === "open") {
      let dDayText = "";
      if (item.closesAt) {
        const now = new Date();
        const closeDate = new Date(item.closesAt);
        const d1 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const d2 = new Date(closeDate.getFullYear(), closeDate.getMonth(), closeDate.getDate());
        const diffMs = d2.getTime() - d1.getTime();
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays > 0) {
          dDayText = `D-${diffDays}`;
        } else if (diffDays === 0) {
          dDayText = lang === "ko" ? "오늘 마감" : "D-Day";
        } else {
          dDayText = lang === "ko" ? "마감" : "Closed";
        }
      }
      return {
        label: dDayText ? `${lang === "ko" ? "진행중" : "Ongoing"} (${dDayText})` : (lang === "ko" ? "진행중" : "Ongoing"),
        color: "bg-emerald-50 text-emerald-700 border-emerald-200"
      };
    }
    return {
      label: lang === "ko" ? "마감" : "Closed",
      color: "bg-gray-100 text-gray-600 border-gray-200"
    };
  };

  const tabs = [
    { id: "event", labelKo: "행사", labelEn: "Events" },
    { id: "survey", labelKo: "설문·투표", labelEn: "Surveys & Votes" },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-gray-50/50">
      <Header showLogo />

      <PageHero
        title={lang === "ko" ? "행사 / 설문·투표" : "Events / Surveys & Votes"}
        description={lang === "ko"
          ? "학생회가 진행하는 행사와 설문·투표를 한 곳에서 확인하고 참여하세요."
          : "Browse and join student council events, surveys, and votes in one place."}
      />

      {/* Tabs Navigation */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex gap-2 md:gap-8 overflow-x-auto py-2.5">
            {tabs.map((tab) => {
              const isActive = currentTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`flex items-center gap-2 py-2 px-4 rounded-xl text-sm font-bold transition-all shrink-0 cursor-pointer border-0 ${
                    isActive
                      ? "bg-kaist-darkgreen text-white shadow-md shadow-kaist-darkgreen/10"
                      : "bg-transparent text-kaist-grey hover:text-kaist-darkgreen hover:bg-gray-50"
                  }`}
                >
                  <span>{lang === "ko" ? tab.labelKo : tab.labelEn}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-8 md:py-10">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-10 h-10 border-4 border-kaist-darkgreen border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-semibold text-kaist-grey">
              {lang === "ko" ? "불러오는 중..." : "Loading..."}
            </p>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 text-red-700 p-6 rounded-3xl text-sm font-medium flex items-center gap-3">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{error}</span>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-gray-200 rounded-3xl bg-white space-y-4">
            <div className="text-gray-300 font-medium text-lg">
              {lang === "ko" ? "표시할 항목이 없습니다." : "No events or surveys to display."}
            </div>
            <p className="text-sm text-kaist-grey">
              {lang === "ko" ? "다른 탭을 확인해 보세요." : "Please check out the other tab."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {filteredItems.map((item) => {
              const kindInfo = getKindBadge(item.kind);
              const statusInfo = getStatusBadge(item);
              const Icon = kindInfo.icon;

              const title = lang === "ko" ? item.titleKo : (item.titleEn || item.titleKo);
              const desc = lang === "ko" ? item.descriptionKo : (item.descriptionEn || item.descriptionKo);

              const hasCapacity = item.maxResponses && item.maxResponses > 0;
              const currentResponses = item.responseCount ?? 0;
              const fillPercentage = hasCapacity ? Math.min(100, (currentResponses / (item.maxResponses || 1)) * 100) : 0;

              return (
                <div 
                  key={item.id}
                  className="bg-white border border-gray-200 rounded-3xl p-5 md:p-6 shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-5"
                >
                  <div className="space-y-3.5">
                    {/* Badge Row */}
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-semibold border ${kindInfo.color}`}>
                          <Icon className="w-3 h-3" />
                          {kindInfo.label}
                        </span>
                        {item.feePayersOnly && (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-xl text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                            {lang === "ko" ? "과비 납부자 전용" : "Paid Only"}
                          </span>
                        )}
                        {item.isKoreanOnly && (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-xl text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                            {lang === "ko" ? "한국어 전용" : "Korean Only"}
                          </span>
                        )}
                      </div>
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-xl text-[11px] font-semibold border ${statusInfo.color}`}>
                        {statusInfo.label}
                      </span>
                    </div>

                    {/* Title & Description */}
                    <div className="space-y-2">
                      <h3 className="text-xl md:text-[1.35rem] font-extrabold text-kaist-black line-clamp-1 leading-tight">
                        {title}
                      </h3>
                      {desc && (
                        <p className="text-sm text-kaist-grey/80 line-clamp-2 leading-relaxed font-normal">
                          {desc}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Progress & Metadata */}
                  <div className="space-y-4 pt-4 border-t border-gray-100">
                    {/* Response capacity bar if applicable */}
                    {hasCapacity && (
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs font-semibold text-kaist-grey/80">
                          <span>{lang === "ko" ? "신청 현황" : "Registration Status"}</span>
                          <span>{currentResponses} / {item.maxResponses} ({Math.round(fillPercentage)}%)</span>
                        </div>
                        <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                          <div 
                            className="bg-kaist-darkgreen/80 h-full rounded-full transition-all duration-300"
                            style={{ width: `${fillPercentage}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Dates */}
                    <div className="flex flex-col gap-1.5 text-xs text-kaist-grey/75 font-medium">
                      {item.opensAt && (
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-kaist-greygreen/80" />
                          <span>
                            {lang === "ko" ? "시작:" : "Start:"} {formatKoreanDateTime(item.opensAt)}
                          </span>
                        </div>
                      )}
                      {item.closesAt && (
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-kaist-greygreen/80" />
                          <span>
                            {lang === "ko" ? "마감:" : "End:"} {formatKoreanDateTime(item.closesAt)}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Action buttons */}
                    <div className="pt-2">
                      {item.computedState === "open" ? (
                        <button
                          onClick={() => navigate(`/survey/${item.id}`)}
                          className="w-full flex items-center justify-center gap-2 bg-kaist-darkgreen/90 hover:bg-kaist-darkgreen text-white/95 font-semibold text-sm py-2.5 rounded-xl transition-all shadow-sm shadow-kaist-darkgreen/10 border-0 cursor-pointer"
                        >
                          <span>{lang === "ko" ? "참여하기" : "Participate"}</span>
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      ) : item.computedState === "closed" && item.resultVisibility === "PUBLIC" ? (
                        <button
                          onClick={() => navigate(`/survey/${item.id}/results`)}
                          className="w-full flex items-center justify-center gap-2 bg-white hover:bg-slate-50 text-kaist-darkgreen/80 font-semibold text-sm py-2.5 rounded-xl transition-all border border-kaist-darkgreen/20 cursor-pointer"
                        >
                          <BarChart3 className="w-4 h-4" />
                          <span>{lang === "ko" ? "결과 보기" : "View Results"}</span>
                        </button>
                      ) : (
                        <button
                          disabled
                          className="w-full flex items-center justify-center gap-2 bg-gray-100 text-gray-400 font-semibold text-sm py-2.5 rounded-xl border border-gray-200 cursor-not-allowed"
                        >
                          {item.computedState === "before_open" ? (
                            <span>{lang === "ko" ? "개시 예정" : "Upcoming"}</span>
                          ) : (
                            <span>{lang === "ko" ? "마감됨" : "Closed"}</span>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
