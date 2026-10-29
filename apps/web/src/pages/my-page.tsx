import { ErrorState } from "@/components/ui/data-state";
import { Footer } from "@/components/organisms/footer";
import {
  MyPageActivityPanel,
  MyPageLoadingState,
  MyPageProfilePanel,
  MyPageSidebar,
  MyPageUnavailableState,
} from "@/features/my-page/my-page-sections";
import { useMyPageController } from "@/features/my-page/use-my-page-controller";
import { PageShell } from "@/components/ui/page-layout";
import { MobileDetailHeader } from "@/components/ui/mobile-detail-header";

export function MyPage() {
  const {
    activeMenu,
    activeTab,
    activityQuery,
    canUseMyPage,
    currentPage,
    displayName,
    displayedActivityTab,
    filteredActivities,
    initialLoading,
    isAdmin,
    lang,
    loadError,
    loading,
    profileError,
    retryActivity,
    retryProfile,
    menuItems,
    session,
    scraps,
    setActiveMenu,
    setActivityQuery,
    setActiveTab,
    openActivityTab,
    setCurrentPage,
    totalPages,
    userInfo,
  } = useMyPageController();

  return (
    <PageShell className="mobile-state-page mobile-mypage text-slate-950">
      {!initialLoading && !canUseMyPage ? <MobileDetailHeader title="" backTo="/" lang={lang} /> : null}
      <main className="mx-auto flex min-w-0 w-full max-w-7xl flex-1 flex-col items-stretch gap-6 px-4 py-6 sm:px-6 md:flex-row md:items-start md:gap-8 md:px-8 md:py-8">
        {canUseMyPage ? (
          <>
            <MyPageSidebar
              activeMenu={activeMenu}
              lang={lang}
              menuItems={menuItems}
              onMenuChange={setActiveMenu}
            />
          </>
        ) : null}

        <section className="w-full min-w-0 flex-1">
          {canUseMyPage && !initialLoading ? <div className="mobile-mypage-heading md:hidden">
            <h1>{lang === "ko" ? "마이페이지" : "My page"}</h1>
            <div className="mobile-mypage-tabs" role="tablist" aria-label={lang === "ko" ? "마이페이지 메뉴" : "My page sections"}>
              {menuItems.map(item => <button key={item.id} type="button" role="tab" aria-selected={activeMenu === item.id} onClick={() => setActiveMenu(item.id)}>{item.label}</button>)}
            </div>
          </div> : null}
          {initialLoading ? (
            <MyPageLoadingState lang={lang} />
          ) : !canUseMyPage ? (
            <MyPageUnavailableState
              authenticated={session?.authenticated}
              lang={lang}
            />
          ) : (
            <div className="mypage-content flex flex-col gap-5 w-full">
              {activeMenu === "profile" && (profileError ? <ErrorState onRetry={retryProfile} /> :
                <MyPageProfilePanel
                  displayName={displayName}
                  isAdmin={isAdmin}
                  lang={lang}
                  userInfo={userInfo}
                  onActivitySelect={openActivityTab}
                />
              )}

              {activeMenu === "activity" && (
                <MyPageActivityPanel
                  key={session?.userId}
                  loading={loading}
                  error={loadError}
                  onRetry={retryActivity}
                  activeTab={activeTab}
                  activities={filteredActivities}
                  activityQuery={activityQuery}
                  contentTab={displayedActivityTab}
                  currentPage={currentPage}
                  scraps={scraps}
                  onPageChange={setCurrentPage}
                  onQueryChange={setActivityQuery}
                  onTabChange={setActiveTab}
                  lang={lang}
                  totalPages={totalPages}
                />
              )}

            </div>
          )}
        </section>
      </main>

      <Footer />
    </PageShell>
  );
}
