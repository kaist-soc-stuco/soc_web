import { Header } from "@/components/organisms/header";
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
    menuItems,
    session,
    scraps,
    setActiveMenu,
    setActivityQuery,
    setActiveTab,
    setCurrentPage,
    totalPages,
    userInfo,
  } = useMyPageController();

  return (
    <PageShell className="text-slate-950">
      <Header />

      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8 md:px-8 flex gap-8 items-start">
        {canUseMyPage ? (
          <MyPageSidebar
            activeMenu={activeMenu}
            lang={lang}
            menuItems={menuItems}
            onMenuChange={(menu) => {
              setActiveMenu(menu);
              setCurrentPage(1);
            }}
          />
        ) : null}

        <section className="flex-1 min-w-0">
          {initialLoading ? (
            <MyPageLoadingState lang={lang} />
          ) : !canUseMyPage ? (
            <MyPageUnavailableState
              authenticated={session?.authenticated}
              lang={lang}
            />
          ) : (
            <div className="flex flex-col gap-5 w-full">
              {loadError && (
                <div className="rounded-xl border border-amber-200 bg-amber-50/50 px-4 py-3 text-xs font-bold text-amber-800">
                  {loadError}
                </div>
              )}

              {activeMenu === "profile" && (
                <MyPageProfilePanel
                  displayName={displayName}
                  isAdmin={isAdmin}
                  lang={lang}
                  userInfo={userInfo}
                />
              )}

              {activeMenu === "activity" && (
                <MyPageActivityPanel
                  activeTab={activeTab}
                  activities={filteredActivities}
                  activityQuery={activityQuery}
                  contentTab={displayedActivityTab}
                  currentPage={currentPage}
                  scraps={scraps}
                  onPageChange={setCurrentPage}
                  onQueryChange={(query) => {
                    setActivityQuery(query);
                    setCurrentPage(1);
                  }}
                  onTabChange={(tab) => {
                    setActiveTab(tab);
                    setCurrentPage(1);
                  }}
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
