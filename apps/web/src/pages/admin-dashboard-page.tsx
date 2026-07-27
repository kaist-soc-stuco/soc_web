import { Link } from 'react-router-dom';

import { adminMenu } from '@/lib/static-site-content';

export function AdminDashboardPage() {
  return (
    <section className="grid gap-6 xl:grid-cols-2">
      {adminMenu.map((item) => (
        <Link
          key={item.to}
          to={item.to}
          className="border border-kaist-grey/20 bg-white px-6 py-7 transition hover:border-kaist-darkgreen"
        >
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-kaist-darkgreen">Admin</p>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-kaist-black">{item.label}</h2>
          <p className="mt-3 text-sm font-medium leading-6 text-kaist-grey">해당 관리 화면으로 이동합니다.</p>
        </Link>
      ))}
    </section>
  );
}
