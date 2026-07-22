import type { CurrentUserResponse } from "@soc/contracts";
import { isoToMs, nowMs } from "@soc/shared";
import { Clock3, LogOut, User } from "lucide-react";
import { Link } from "react-router-dom";

import { EmptyState } from "@/components/ui/data-state";
import { Pagination } from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";

import type {
  ActivityItem,
  ActivityTab,
  MyPageMenu,
  MyPageStat,
} from "./use-my-page-controller";

const formatRelative = (value: string | null | undefined, lang: string) => {
  if (!value) return "-";
  const time = isoToMs(value);
  if (Number.isNaN(time)) return "-";

  const diffDays = Math.floor((nowMs() - time) / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return lang === "ko" ? "오늘" : "Today";
  if (diffDays === 1) return lang === "ko" ? "어제" : "Yesterday";
  return lang === "ko" ? `${diffDays}일 전` : `${diffDays} days ago`;
};

type UserInfo = CurrentUserResponse["user"] | undefined;

interface SidebarProps {
  activeMenu: MyPageMenu;
  lang: string;
  menuItems: ReadonlyArray<{
    icon: typeof User;
    id: MyPageMenu;
    label: string;
  }>;
  onLogout: () => void;
  onMenuChange: (menu: MyPageMenu) => void;
}

export function MyPageSidebar({
  activeMenu,
  lang,
  menuItems,
  onLogout,
  onMenuChange,
}: SidebarProps) {
  return (
    <aside className="hidden w-56 shrink-0 border border-slate-200 bg-white rounded-2xl p-4 shadow-[0_5px_20px_rgba(0,0,0,0.015)] md:block sticky top-6">
      <div className="flex items-center gap-2 px-2 pb-3 border-b border-slate-100 select-none">
        <User className="h-4.5 w-4.5 text-kaist-darkgreen" />
        <span className="text-[15px] font-bold text-slate-900">
          {lang === "ko" ? "마이페이지" : "My Page"}
        </span>
      </div>

      <nav className="mt-4 flex flex-col gap-1 select-none">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeMenu === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onMenuChange(item.id)}
              className={`w-full flex items-center gap-2.5 rounded-lg px-3.5 py-2.5 text-[13px] font-semibold border-0 transition-colors cursor-pointer text-left ${
                isActive
                  ? "bg-emerald-50/70 text-kaist-darkgreen shadow-sm shadow-emerald-500/5"
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="mt-4 border-t border-slate-100 pt-3 select-none">
        <button
          type="button"
          onClick={onLogout}
          className="w-full flex items-center gap-2.5 rounded-lg px-3.5 py-2.5 text-[13px] font-semibold text-slate-500 hover:bg-slate-50 hover:text-slate-800 border-0 bg-transparent cursor-pointer text-left"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          <span>{lang === "ko" ? "로그아웃" : "Logout"}</span>
        </button>
      </div>
    </aside>
  );
}

export function MyPageLoadingState({ lang }: { lang: string }) {
  return (
    <div
      className="flex flex-col gap-5"
      aria-busy="true"
      aria-label={lang === "ko" ? "마이페이지 불러오는 중" : "Loading My Page"}
    >
      <div className="mb-1">
        <Skeleton className="h-6 w-20" />
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-[0_10px_35px_rgba(15,23,42,0.05)]">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-36" />
          <Skeleton className="h-5 w-14 rounded-full" />
        </div>
        <div className="mt-5 grid grid-cols-1 gap-x-8 gap-y-3 border-t border-slate-100 pt-4 sm:grid-cols-2">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="flex items-center gap-3">
              <Skeleton className="h-3 w-14" />
              <Skeleton className="h-4 w-40" />
            </div>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-[0_5px_15px_rgba(0,0,0,0.015)]"
          >
            <Skeleton className="h-9 w-9 rounded-lg" />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-5 w-10" />
            </div>
          </div>
        ))}
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-[0_10px_35px_rgba(15,23,42,0.05)]">
        <div className="mb-4 border-b border-slate-100 pb-3.5">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-4 w-16" />
          </div>
          <Skeleton className="mt-2 h-3 w-full max-w-md" />
        </div>
        <ActivityRowsSkeleton />
      </section>
    </div>
  );
}

interface UnavailableStateProps {
  authenticated?: boolean;
  lang: string;
}

export function MyPageUnavailableState({ authenticated, lang }: UnavailableStateProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm max-w-xl mx-auto">
      <p className="text-xs font-semibold text-slate-500 leading-relaxed">
        {authenticated
          ? lang === "ko"
            ? "마이페이지는 개인정보 저장 동의가 완료된 계정에서 이용할 수 있습니다."
            : "My Page is available after you consent to saving your account information."
          : lang === "ko"
            ? "로그인이 필요합니다."
            : "You need to sign in."}
      </p>
      <Link
        to="/login"
        className="mt-5 inline-flex items-center rounded-lg border border-kaist-darkgreen px-4 py-2 text-xs font-bold text-kaist-darkgreen hover:bg-kaist-darkgreen/5 select-none"
      >
        {lang === "ko" ? "로그인 페이지로 이동" : "Go to sign in"}
      </Link>
    </div>
  );
}

function ActivityRows({ items, lang }: { items: ActivityItem[]; lang: string }) {
  return (
    <div className="divide-y divide-slate-100">
      {items.map((item, index) => {
        const isSurvey = item.type === "survey";
        const badgeBg = isSurvey
          ? "bg-[#e6f4ea] text-[#137333] border-[#e6f4ea]/50"
          : "bg-slate-50 text-slate-600 border-slate-200/50";

        return (
          <Link
            key={`${item.type}-${item.href}-${index}`}
            to={item.href}
            className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-4 py-3.5 transition-colors group hover:bg-slate-50/50 px-3 -mx-3 rounded-lg"
          >
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border shrink-0 select-none ${badgeBg}`}
            >
              {item.label}
            </span>
            <span className="min-w-0 pr-2">
              <span className="block truncate text-[13px] font-semibold text-slate-800 group-hover:text-kaist-darkgreen transition-colors">
                {item.title}
              </span>
              {item.context && (
                <span className="mt-0.5 block truncate text-[11px] font-medium text-slate-400">
                  {item.context}
                </span>
              )}
            </span>
            <span className="whitespace-nowrap text-xs font-medium text-slate-400 mr-1.5">
              {formatRelative(item.date, lang)}
            </span>
            <svg
              className="w-3.5 h-3.5 text-slate-400 transition-transform group-hover:translate-x-0.5 shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth="2.5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 5l7 7-7 7"
              />
            </svg>
          </Link>
        );
      })}
    </div>
  );
}

function ActivityRowsSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="divide-y divide-slate-100" aria-hidden="true">
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-4 px-3 py-3.5"
        >
          <Skeleton className="h-5 w-10 rounded" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-3 w-14" />
          <Skeleton className="h-3.5 w-3.5 rounded" />
        </div>
      ))}
    </div>
  );
}

interface OverviewPanelProps {
  activities: ActivityItem[];
  displayName: string;
  isAdmin: boolean;
  lang: string;
  onShowAllActivities: () => void;
  stats: MyPageStat[];
  userInfo: UserInfo;
}

export function MyPageOverviewPanel({
  activities,
  displayName,
  isAdmin,
  lang,
  onShowAllActivities,
  stats,
  userInfo,
}: OverviewPanelProps) {
  return (
    <div className="flex flex-col gap-5 animate-in fade-in duration-300">
      <div className="mb-1 select-none">
        <h1 className="text-lg font-bold text-slate-900 tracking-tight">
          {lang === "ko" ? "개요" : "Overview"}
        </h1>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-[0_10px_35px_rgba(15,23,42,0.05)] flex flex-col gap-4">
        <div className="flex items-center gap-2.5 flex-wrap">
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
            {displayName}
          </h2>
          {isAdmin && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#e6f4ea] text-kaist-darkgreen border border-emerald-100 select-none">
              {lang === "ko" ? "관리자" : "Administrator"}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2.5 border-t border-slate-100 pt-4">
          <div className="flex items-center gap-3 text-xs">
            <span className="w-16 text-slate-400 font-semibold select-none">
              {lang === "ko" ? "소속" : "Affiliation"}
            </span>
            <span className="text-[13px] font-semibold text-slate-800">
              {(lang === "ko"
                ? userInfo?.departmentKo || userInfo?.departmentEn
                : userInfo?.departmentEn || userInfo?.departmentKo) ?? "-"}
              {userInfo?.academicStatus && ` · ${userInfo.academicStatus}`}
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="w-16 text-slate-400 font-semibold select-none">
              {lang === "ko" ? "학번" : "Student ID"}
            </span>
            <span className="text-[13px] font-semibold text-slate-800">
              {userInfo?.studentNumber ?? "-"}
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="w-16 text-slate-400 font-semibold select-none">
              {lang === "ko" ? "이메일" : "Email"}
            </span>
            <span className="text-[13px] font-semibold text-slate-800">
              {userInfo?.email ?? "-"}
            </span>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_5px_15px_rgba(0,0,0,0.015)] flex items-center gap-3 transition-all hover:translate-y-[-1px] hover:shadow-[0_8px_20px_rgba(0,0,0,0.02)]"
            >
              <div className={`p-2 rounded-lg border shrink-0 ${stat.color}`}>
                <Icon className="h-4.5 w-4.5" />
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-slate-400">
                  {stat.label}
                </span>
                <span className="text-xl font-bold text-slate-900 mt-0.5 leading-none">
                  {stat.value}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-[0_10px_35px_rgba(15,23,42,0.05)] flex flex-col">
        <div className="flex flex-col border-b border-slate-100 pb-3.5 mb-4 select-none gap-1">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">
              {lang === "ko" ? "최근 활동" : "Recent activity"}
            </h2>
            <button
              onClick={onShowAllActivities}
              className="text-[13px] font-bold text-kaist-darkgreen hover:opacity-85 border-0 bg-transparent cursor-pointer flex items-center gap-0.5 transition-opacity"
            >
              <span>{lang === "ko" ? "전체 보기" : "View all"}</span>
              <svg
                className="w-3 h-3 text-kaist-darkgreen"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth="2.5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>
          </div>
          <p className="text-xs font-medium text-slate-400">
            {lang === "ko"
              ? "최근 30일 동안 제출된 설문, 작성된 게시글 및 댓글의 전체 기록을 확인합니다."
              : "Review surveys, posts, and comments from the past 30 days."}
          </p>
        </div>

        {activities.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 px-4 text-center select-none">
            <div className="p-3 rounded-full bg-slate-50 border border-slate-100 text-slate-400 mb-3">
              <Clock3 className="h-6 w-6 stroke-[1.75]" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">
              {lang === "ko" ? "최근 활동 내역이 없습니다" : "No recent activity"}
            </h3>
            <p className="text-xs font-medium text-slate-400 mt-1 max-w-xs leading-normal">
              {lang === "ko"
                ? "설문 참여, 커뮤니티 게시글 및 댓글 작성을 통해 SOC 활동을 시작해 보세요."
                : "Join a survey or contribute a post or comment to get started."}
            </p>
          </div>
        ) : (
          <ActivityRows items={activities.slice(0, 10)} lang={lang} />
        )}
      </section>
    </div>
  );
}

interface ProfilePanelProps {
  displayName: string;
  isAdmin: boolean;
  lang: string;
  userInfo: UserInfo;
}

export function MyPageProfilePanel({
  displayName,
  isAdmin,
  lang,
  userInfo,
}: ProfilePanelProps) {
  return (
    <div className="flex flex-col gap-4 animate-in fade-in duration-300">
      <div className="mb-1.5 select-none">
        <h1 className="text-lg font-bold text-slate-900 tracking-tight">
          {lang === "ko" ? "내 정보" : "Profile"}
        </h1>
        <p className="text-xs font-medium text-slate-400 mt-1">
          {lang === "ko"
            ? "KAIST 포털 계정과 연동된 기본 정보입니다."
            : "Basic information linked to your KAIST portal account."}
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-[0_10px_35px_rgba(15,23,42,0.05)] divide-y divide-slate-100 select-none">
        {[
          [lang === "ko" ? "이름" : "Name", displayName],
          [lang === "ko" ? "학번" : "Student ID", userInfo?.studentNumber ?? "-"],
          [lang === "ko" ? "이메일" : "Email", userInfo?.email ?? "-"],
          [
            lang === "ko" ? "소속" : "Affiliation",
            `${
              (lang === "ko"
                ? userInfo?.departmentKo || userInfo?.departmentEn
                : userInfo?.departmentEn || userInfo?.departmentKo) ?? "-"
            }${
              userInfo?.academicStatus ? ` (${userInfo.academicStatus})` : ""
            }`,
          ],
          [lang === "ko" ? "상태" : "Status", userInfo?.academicStatus ?? "-"],
          [
            lang === "ko" ? "권한" : "Role",
            isAdmin
              ? lang === "ko"
                ? "관리자"
                : "Administrator"
              : lang === "ko"
                ? "일반 사용자"
                : "Member",
          ],
        ].map(([label, value]) => (
          <div
            key={label}
            className="grid grid-cols-[120px_1fr] py-4 text-[13px] items-center"
          >
            <span className="font-semibold text-slate-400">{label}</span>
            <span className="font-bold text-slate-800 text-[14px]">
              {value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

interface ActivityPanelProps {
  activeTab: ActivityTab;
  activities: ActivityItem[];
  currentPage: number;
  lang: string;
  loading: boolean;
  onPageChange: (page: number) => void;
  onTabChange: (tab: ActivityTab) => void;
  totalPages: number;
}

export function MyPageActivityPanel({
  activeTab,
  activities,
  currentPage,
  lang,
  loading,
  onPageChange,
  onTabChange,
  totalPages,
}: ActivityPanelProps) {
  return (
    <div className="flex flex-col gap-4 animate-in fade-in duration-300">
      <div className="mb-1.5 select-none">
        <h1 className="text-lg font-bold text-slate-900 tracking-tight">
          {lang === "ko" ? "활동 내역" : "Activity"}
        </h1>
        <p className="text-xs font-medium text-slate-400 mt-1">
          {lang === "ko"
            ? "게시글, 댓글, 설문 참여 기록을 확인할 수 있습니다."
            : "Review your posts, comments, and survey participation."}
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-[0_10px_35px_rgba(15,23,42,0.05)] flex flex-col">
        <div className="flex gap-6 border-b border-slate-100 pb-2 mb-4 overflow-x-auto items-stretch select-none">
          {([
            { id: "all", label: lang === "ko" ? "전체" : "All" },
            { id: "survey", label: lang === "ko" ? "설문" : "Surveys" },
            { id: "post", label: lang === "ko" ? "작성한 글" : "Posts" },
            { id: "comment", label: lang === "ko" ? "작성한 댓글" : "Comments" },
          ] as const satisfies ReadonlyArray<{
            id: ActivityTab;
            label: string;
          }>).map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`relative flex items-center justify-center text-[13px] font-semibold pb-2 border-0 bg-transparent cursor-pointer transition-colors ${
                  isActive
                    ? "text-kaist-darkgreen"
                    : "text-slate-400 hover:text-kaist-darkgreen"
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`absolute bottom-0 left-0 right-0 h-[2px] bg-kaist-darkgreen transition-transform duration-200 origin-center ${
                    isActive ? "scale-x-100" : "scale-x-0"
                  }`}
                />
              </button>
            );
          })}
        </div>

        {loading ? (
          <ActivityRowsSkeleton />
        ) : activities.length === 0 ? (
          <EmptyState
            message={lang === "ko" ? "내역이 없습니다." : "No activity found."}
            minHeightClassName="min-h-[200px]"
          />
        ) : (
          <div className="divide-y divide-slate-100 flex-1">
            <ActivityRows items={activities} lang={lang} />
          </div>
        )}

        {!loading && totalPages > 1 && (
          <div className="border-t border-slate-100 pt-4 mt-4 flex justify-center select-none">
            <Pagination
              currentPage={currentPage}
              lang={lang}
              onPageChange={onPageChange}
              size="sm"
              totalPages={totalPages}
            />
          </div>
        )}
      </div>
    </div>
  );
}
