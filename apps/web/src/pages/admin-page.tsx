import { Link, NavLink, Outlet } from 'react-router-dom';

import { adminMenu } from '@/lib/mock-data';

export function AdminPage() {
  return (
    <div className="min-h-screen bg-[#F7FCFC] text-kaist-black">
      <div className="flex min-h-screen flex-col xl:flex-row">
        <aside className="w-full bg-kaist-darkgreen px-7 py-5 text-white xl:min-h-screen xl:w-[384px]">
          <div className="flex items-center">
            <div className="text-[30px] font-black tracking-tight">KAIST</div>
            <div className="mx-4 h-5 w-px bg-white/50" />
            <div className="text-[20px] font-semibold tracking-tight text-white/95">SoC Committee</div>
          </div>

          <div className="mt-16">
            <p className="text-[24px] font-bold">마이페이지</p>
          </div>

          <nav className="mt-12 space-y-9">
            {adminMenu.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center border-l-[5px] text-[24px] transition ${
                    isActive
                      ? 'border-white pl-5 font-bold text-white'
                      : 'border-transparent pl-0 font-medium text-white/90 hover:text-white'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </aside>

        <div className="flex-1">
          <header className="border-b border-kaist-black/20 bg-[#F7FCFC] px-10 py-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap items-center gap-8 text-[20px] font-extrabold text-kaist-black">
                <Link to="/board/공지" className="transition hover:text-kaist-darkgreen">
                  게시판
                </Link>
                <span className="text-kaist-black/50">|</span>
                <Link to="/events" className="transition hover:text-kaist-darkgreen">
                  행사 / 설문조사
                </Link>
                <span className="text-kaist-black/50">|</span>
                <Link to="/about" className="transition hover:text-kaist-darkgreen">
                  About
                </Link>
              </div>

              <div className="flex items-center gap-4 text-sm font-bold text-kaist-black">
                <span className="text-base">◎</span>
                <span className="text-base">◌</span>
                <Link to="/" className="transition hover:text-kaist-darkgreen">
                  로그인
                </Link>
              </div>
            </div>
          </header>

          <div className="px-10 py-12">
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
}
