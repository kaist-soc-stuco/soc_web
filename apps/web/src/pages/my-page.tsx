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

      <main className="mx-auto flex min-w-0 w-full max-w-7xl flex-1 flex-col items-stretch gap-6 px-4 py-6 sm:px-6 md:flex-row md:items-start md:gap-8 md:px-8 md:py-8">
        {canUseMyPage ? (
          <>
            <div className="w-full md:hidden">
              <label className="sr-only" htmlFor="my-page-menu">
                {lang === "ko" ? "마이페이지 메뉴 선택" : "Choose a My Page section"}
              </label>
              <select
                id="my-page-menu"
                value={activeMenu}
                onChange={(event) => {
                  const nextMenu = menuItems.find((item) => item.id === event.currentTarget.value)?.id;
                  if (!nextMenu) return;
                  setActiveMenu(nextMenu);
                  setCurrentPage(1);
                }}
                className="min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-kaist-darkgreen focus:ring-2 focus:ring-kaist-darkgreen/15"
              >
                {menuItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
            <MyPageSidebar
              activeMenu={activeMenu}
              lang={lang}
              menuItems={menuItems}
              onMenuChange={(menu) => {
                setActiveMenu(menu);
                setCurrentPage(1);
              }}
            />
          </>
        ) : null}

        <section className="w-full min-w-0 flex-1">
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
                <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50/50 px-4 py-3 text-xs font-bold text-amber-800">
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
