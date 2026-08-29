import { Link } from "react-router-dom";
import { Instagram } from "lucide-react";

const OFFICIAL_INSTAGRAM_URL = "https://www.instagram.com/in.cs.tagram/";

export function Footer() {
  return (
    <footer className="mt-auto shrink-0 border-t border-slate-800 bg-[#171717] text-slate-200">
      <div className="mx-auto grid w-full max-w-7xl gap-7 px-6 py-8 text-sm md:grid-cols-[minmax(0,1fr)_auto] md:px-8">
        <div className="space-y-2">
          <Link to="/about" className="inline-flex rounded-sm text-base font-medium transition-colors hover:text-white">
            전산학부 집행위원회
          </Link>
          <p className="text-slate-400">KAIST SOC</p>
          <p className="text-xs text-slate-400">Copyright © KAIST SOC. All rights reserved.</p>
        </div>

        <div className="flex flex-col gap-4 md:items-end">
          <nav aria-label="푸터 링크" className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-300 md:justify-end">
            <Link to="/terms" className="transition-colors hover:text-white">이용약관</Link>
            <Link to="/privacy" className="transition-colors hover:text-white">개인정보처리방침</Link>
          </nav>
          <a
            href={OFFICIAL_INSTAGRAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Instagram"
            title="Instagram"
            className="inline-flex w-fit items-center gap-2 rounded-md text-sm text-slate-300 transition-colors hover:text-white"
          >
            <Instagram className="size-4" aria-hidden="true" />
            <span>Instagram</span>
          </a>
        </div>
      </div>
    </footer>
  );
}
