import type { CurrentUserResponse, MyScrapItem } from "@soc/contracts";
import { isoToMs, msToDate, nowMs } from "@soc/shared";
import { Bookmark, Clock3, User, type LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";

import { EmptyState } from "@/components/ui/data-state";
import { Pagination } from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import { PageSearchField } from "@/components/ui/page-layout";

import type {
  ActivityItem,
  ActivityTab,
  MyPageMenu,
} from "./use-my-page-controller";
import { Button } from "@/components/ui/button";

const formatRelative = (value: string | null | undefined, lang: string) => {
  if (!value) return "-";
  const time = isoToMs(value);
  if (Number.isNaN(time)) return "-";

  const diffDays = Math.floor((nowMs() - time) / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return lang === "ko" ? "오늘" : "Today";
  if (diffDays === 1) return lang === "ko" ? "어제" : "Yesterday";
  return lang === "ko" ? `${diffDays}일 전` : `${diffDays} days ago`;
};

const formatProfileDateTime = (value: string | null | undefined) => {
  if (!value) return "-";
  const time = isoToMs(value);
  if (Number.isNaN(time)) return "-";
  const date = msToDate(time);
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

type UserInfo = CurrentUserResponse["user"] | undefined;

interface SidebarProps {
  activeMenu: MyPageMenu;
  lang: string;
  menuItems: ReadonlyArray<{
    icon: LucideIcon;
    id: MyPageMenu;
    label: string;
  }>;
  onMenuChange: (menu: MyPageMenu) => void;
}

export function MyPageSidebar({
  activeMenu,
  lang,
  menuItems,
  onMenuChange,
}: SidebarProps) {
  return (
    <aside className="hidden w-56 shrink-0 border border-slate-200 bg-white rounded-2xl p-4 shadow-[0_5px_20px_rgba(0,0,0,0.015)] md:block sticky top-6">
      <div className="flex items-center gap-2 px-2 pb-3 border-b border-slate-100 select-none">
        <User className="h-4.5 w-4.5 text-kaist-darkgreen" />
        <span className="text-[length:var(--ui-text-section-size)] font-bold text-slate-900">
          {lang === "ko" ? "마이페이지" : "My Page"}
        </span>
      </div>

      <nav className="mt-4 flex flex-col gap-1 select-none">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeMenu === item.id;
          return (
            <Button variant="ghost"
              key={item.id}
              onClick={() => onMenuChange(item.id)}
              className={`w-full flex items-center justify-start gap-2.5 rounded-lg px-3.5 py-2.5 text-[length:var(--ui-text-body-sm-size)] font-semibold border-0 transition-colors cursor-pointer text-left ${
                isActive
                  ? "bg-emerald-50/70 text-kaist-darkgreen shadow-sm shadow-emerald-500/5"
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{item.label}</span>
            </Button>
          );
        })}
      </nav>

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
              className={`inline-flex items-center px-2 py-0.5 rounded text-[length:var(--ui-text-micro-size)] font-bold border shrink-0 select-none ${badgeBg}`}
            >
              {item.label}
            </span>
            <span className="min-w-0 pr-2">
              <span className="block truncate text-[length:var(--ui-text-body-sm-size)] font-semibold text-slate-800 group-hover:text-kaist-darkgreen transition-colors">
                {item.title}
              </span>
              {item.context && (
                <span className="mt-0.5 block truncate text-[length:var(--ui-text-caption-size)] font-medium text-slate-400">
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
  const profileRows = [
    [lang === "ko" ? "이름" : "Name", displayName],
    [lang === "ko" ? "학번" : "Student ID", userInfo?.studentNumber ?? "-"],
    [lang === "ko" ? "이메일" : "Email", userInfo?.email ?? "-"],
    [lang === "ko" ? "KAIST UID" : "KAIST UID", userInfo?.kaistUid ?? "-"],
    [lang === "ko" ? "주전공" : "Primary major", userInfo?.primaryMajor ?? "-"],
    [lang === "ko" ? "복수전공" : "Double major", userInfo?.doubleMajor ?? "-"],
    [lang === "ko" ? "부전공" : "Minor", userInfo?.minor ?? "-"],
    [lang === "ko" ? "성별" : "Gender", userInfo?.gender ?? "-"],
    [
      lang === "ko" ? "전화번호" : "Phone",
      userInfo?.phoneNumber ?? userInfo?.userMobile ?? "-",
    ],
    [lang === "ko" ? "상태" : "Status", userInfo?.academicStatus ?? "-"],
    [
      lang === "ko" ? "개인정보 동의" : "Privacy consent",
      formatProfileDateTime(userInfo?.privacyConsentAt),
    ],
    [
      lang === "ko" ? "회비 납부" : "Student fee",
      userInfo?.feeStatus === "PAID"
        ? lang === "ko"
          ? "납부 완료"
          : "Paid"
        : userInfo?.feeStatus === "PARTIAL"
          ? lang === "ko"
            ? "부분 납부"
            : "Partially paid"
          : userInfo?.feeStatus === "UNPAID"
            ? lang === "ko"
              ? "미납"
              : "Unpaid"
            : "-",
    ],
    [
      lang === "ko" ? "최근 로그인" : "Last login",
      formatProfileDateTime(userInfo?.lastLoginAt),
    ],
    [lang === "ko" ? "가입일" : "Created", formatProfileDateTime(userInfo?.createdAt)],
    [lang === "ko" ? "정보 갱신" : "Updated", formatProfileDateTime(userInfo?.updatedAt)],
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
  ] as const;

  return (
    <div className="flex flex-col gap-4 animate-in fade-in duration-300">
      <div className="mb-1.5 select-none">
        <h1 className="text-lg font-bold text-slate-900 tracking-tight">
          {lang === "ko" ? "내 정보" : "Profile"}
        </h1>
      </div>

      <div className="grid grid-cols-1 gap-x-8 rounded-xl border border-slate-200 bg-white p-4 shadow-[0_10px_35px_rgba(15,23,42,0.05)] sm:grid-cols-2 sm:p-5 select-none">
        {profileRows.map(([label, value]) => (
          <div
            key={label}
            className="grid min-w-0 grid-cols-[6.5rem_minmax(0,1fr)] items-center gap-3 border-b border-slate-100 py-2.5 text-[length:var(--ui-text-body-sm-size)] last:border-b-0 sm:[&:nth-last-child(2)]:border-b-0"
          >
            <span className="font-normal text-xs text-slate-400">{label}</span>
            <span className="min-w-0 break-words font-normal text-sm text-slate-800">
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
  activityQuery: string;
  contentTab: ActivityTab;
  currentPage: number;
  scraps: MyScrapItem[];
  lang: string;
  onPageChange: (page: number) => void;
  onQueryChange: (query: string) => void;
  onTabChange: (tab: ActivityTab) => void;
  totalPages: number;
}

export function MyPageActivityPanel({
  activeTab,
  activities,
  activityQuery,
  contentTab,
  currentPage,
  lang,
  onPageChange,
  onQueryChange,
  onTabChange,
  scraps,
  totalPages,
}: ActivityPanelProps) {
  const query = activityQuery.trim().toLocaleLowerCase();
  const visibleScraps = scraps.filter((item) => {
    if (!query) return true;
    return `${item.titleKo} ${item.boardNameKo}`.toLocaleLowerCase().includes(query);
  });

  const tabs = [
    { id: "all", label: lang === "ko" ? "전체" : "All" },
    { id: "survey", label: lang === "ko" ? "설문" : "Surveys" },
    { id: "post", label: lang === "ko" ? "작성한 글" : "Posts" },
    { id: "comment", label: lang === "ko" ? "작성한 댓글" : "Comments" },
    { id: "scraps", label: lang === "ko" ? "스크랩" : "Scraps" },
  ] as const satisfies ReadonlyArray<{ id: ActivityTab; label: string }>;

  const renderCollection = () => {
    if (contentTab === "scraps") {
      if (visibleScraps.length === 0) {
        return (
          <EmptyState
            message={lang === "ko" ? "스크랩한 콘텐츠가 없습니다." : "No saved content."}
            minHeightClassName="min-h-[200px]"
          />
        );
      }
      return (
        <div className="divide-y divide-slate-100">
          {visibleScraps.map((item) => {
            const isEvent = Boolean(item.eventStartDate || item.eventEndDate);
            return (
              <Link
                key={item.articleId}
                to={item.boardCode === "_EVENT" ? `/events/${item.articleId}` : `/board/${item.boardCode}/${item.articleId}`}
                className="group flex items-center gap-3 rounded-lg px-3 py-3 transition-colors hover:bg-slate-50"
              >
                <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[length:var(--ui-text-caption-size)] font-semibold tracking-tight text-slate-700">
                  <Bookmark className="h-3 w-3" aria-hidden="true" />
                  {isEvent ? (lang === "ko" ? "행사" : "Event") : item.boardNameKo}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-normal text-slate-800 group-hover:text-kaist-darkgreen">
                    {item.titleKo}
                  </span>
                  <span className="mt-1 block truncate text-[length:var(--ui-text-caption-size)] font-normal text-slate-400">
                    {item.boardNameKo} · {formatRelative(item.scrapUpdatedAt, lang)}
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      );
    }

    if (activities.length === 0) {
      return (
        <EmptyState
          message={lang === "ko" ? "내역이 없습니다." : "No activity found."}
          minHeightClassName="min-h-[200px]"
        />
      );
    }
    return <ActivityRows items={activities} lang={lang} />;
  };

  return (
    <div className="flex flex-col gap-4 animate-in fade-in duration-300">
      <div className="mb-1.5 select-none">
        <h1 className="text-lg font-bold text-slate-900 tracking-tight">
          {lang === "ko" ? "활동 내역" : "Activity"}
        </h1>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-[0_10px_35px_rgba(15,23,42,0.05)] flex flex-col">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto select-none">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <Button variant="ghost"
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`relative flex h-8 shrink-0 items-center justify-center border-0 bg-transparent px-2.5 pb-2 text-[length:var(--ui-text-body-sm-size)] font-normal cursor-pointer transition-colors ${
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
              </Button>
            );
          })}
          </div>
          <PageSearchField
            ariaLabel={lang === "ko" ? "활동 내역 검색" : "Search activity"}
            className="w-full flex-none sm:w-64"
            onChange={onQueryChange}
            onClear={() => onQueryChange("")}
            placeholder={lang === "ko" ? "활동 내역 검색" : "Search activity"}
            value={activityQuery}
          />
        </div>

        <div className="min-h-[200px] flex-1 divide-y divide-slate-100">{renderCollection()}</div>

        {totalPages > 1 && (
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
