import { Link } from 'react-router-dom';

export function Logo() {
  return (
    <Link
      to="/"
      className="flex items-center gap-2 transition-opacity hover:opacity-90 md:gap-4"
    >
      <img
        src="/kaist_logo.png"
        alt="KAIST Logo"
        className="h-6 w-auto"
      />
      <div className="h-6 w-px bg-gray-400" />
      <span className="flex flex-col leading-none" aria-label="SOC Student Council">
        <span className="font-outfit text-xl font-black tracking-[-0.04em] text-kaist-darkgreen">
          SOC
        </span>
        <span className="mt-0.5 text-[7px] font-black uppercase tracking-[0.18em] text-kaist-grey">
          Student Council
        </span>
      </span>
    </Link>
  );
}
