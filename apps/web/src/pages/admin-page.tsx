import { NavLink, Outlet } from 'react-router-dom';

import { Header } from '@/components/organisms/header';
import { adminMenu } from '@/lib/static-site-content';

export function AdminPage() {
  return (
    <div className="min-h-screen bg-[#F7FCFC] text-kaist-black">
      <Header showLogo />

      <div className="flex min-h-[calc(100vh-72px)] flex-col xl:flex-row">
        <aside className="w-full bg-kaist-darkgreen text-white xl:w-[320px] xl:flex-shrink-0">
          <div className="px-6 py-7 xl:py-9">
            <p className="text-[22px] font-extrabold tracking-tight">마이페이지</p>

            <nav className="mt-8 flex flex-wrap gap-x-7 gap-y-4 xl:mt-10 xl:block xl:space-y-7">
              {adminMenu.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center border-l-[4px] text-[16px] tracking-tight transition xl:text-[20px] ${
                      isActive
                        ? 'border-kaist-white pl-4 font-extrabold text-kaist-white'
                        : 'border-transparent pl-0 font-medium text-kaist-white/90 hover:text-kaist-white'
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <div className="mx-auto w-full px-[12vw] py-8 xl:px-10 xl:py-9">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
