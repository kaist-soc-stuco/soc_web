import { NavLink, Outlet } from 'react-router-dom';

import { Header } from '@/components/organisms/header';
import { adminMenu } from '@/lib/mock-data';

export function AdminPage() {
  return (
    <div className="min-h-screen bg-[#F7FCFC] text-kaist-black">
      <Header showLogo />

      <div className="flex min-h-[calc(100vh-72px)] flex-col xl:flex-row">
        <aside className="w-full bg-kaist-darkgreen text-white xl:w-[384px] xl:flex-shrink-0">
          <div className="px-7 py-8 xl:py-12">
            <p className="text-[24px] font-extrabold tracking-tight">마이페이지</p>

            <nav className="mt-10 flex flex-wrap gap-x-8 gap-y-4 xl:mt-12 xl:block xl:space-y-9">
              {adminMenu.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center border-l-[5px] text-[18px] tracking-tight transition xl:text-[24px] ${
                      isActive
                        ? 'border-kaist-white pl-5 font-extrabold text-kaist-white'
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
          <div className="mx-auto w-full px-[12vw] py-10 xl:px-12 xl:py-12">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
