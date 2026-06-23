import { Header } from "@/components/organisms/header";
import { Footer } from "@/components/organisms/footer";
import {
  MyPageActivityPanel,
  MyPageLoadingState,
  MyPageOverviewPanel,
  MyPageProfilePanel,
  MyPageSidebar,
  MyPageUnavailableState,
} from "@/features/my-page/my-page-sections";
import { useMyPageController } from "@/features/my-page/use-my-page-controller";

export function MyPage() {
  const {
    activeMenu,
    activeTab,
    allActivities,
    canUseMyPage,
    currentPage,
    displayName,
    filteredActivities,
    handleLogout,
    initialLoading,
    isAdmin,
    isContentRefreshing,
    loadError,
    menuItems,
    session,
    setActiveMenu,
    setActiveTab,
    setCurrentPage,
    showAllActivities,
    stats,
    totalPages,
    userInfo,
  } = useMyPageController();

  return (
    <div className="min-h-screen bg-[#fafafa] text-slate-950 flex flex-col">
      <Header showLogo />

      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8 md:px-8 flex gap-8 items-start">
        <MyPageSidebar
          activeMenu={activeMenu}
          menuItems={menuItems}
          onLogout={() => void handleLogout()}
          onMenuChange={setActiveMenu}
        />

        <section className="flex-1 min-w-0">
          {initialLoading ? (
            <MyPageLoadingState />
          ) : !canUseMyPage ? (
            <MyPageUnavailableState authenticated={session?.authenticated} />
          ) : (
            <div className="flex flex-col gap-5 w-full">
              {loadError && (
                <div className="rounded-xl border border-amber-200 bg-amber-50/50 px-4 py-3 text-xs font-bold text-amber-800">
                  {loadError}
                </div>
              )}

              {activeMenu === "overview" && (
                <MyPageOverviewPanel
                  activities={allActivities}
                  displayName={displayName}
                  isAdmin={isAdmin}
                  onShowAllActivities={showAllActivities}
                  stats={stats}
                  userInfo={userInfo}
                />
              )}

              {activeMenu === "profile" && (
                <MyPageProfilePanel
                  displayName={displayName}
                  isAdmin={isAdmin}
                  userInfo={userInfo}
                />
              )}

              {activeMenu === "activity" && (
                <MyPageActivityPanel
                  activeTab={activeTab}
                  activities={filteredActivities}
                  currentPage={currentPage}
                  onPageChange={setCurrentPage}
                  onTabChange={(tab) => {
                    setActiveTab(tab);
                    setCurrentPage(1);
                  }}
                  loading={isContentRefreshing}
                  totalPages={totalPages}
                />
              )}
            </div>
          )}
        </section>
      </main>

      <Footer />
    </div>
  );
}
