import { Link } from "react-router-dom";
import { Instagram } from "lucide-react";

const OFFICIAL_INSTAGRAM_URL = "https://www.instagram.com/in.cs.tagram/";

export function Footer() {
  return (
    <footer className="mt-auto shrink-0 border-t border-slate-200 bg-slate-100 py-2.5 text-app-text-muted">
      <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-start gap-x-2 gap-y-1 px-4 text-left text-[length:var(--home-calendar-day-size)] font-normal md:px-8">
        <Link to="/about" className="rounded-sm transition-colors hover:text-brand-primary">
          전산학부 집행위원회
        </Link>
        <span aria-hidden="true" className="text-slate-300">|</span>
        <Link to="/terms" className="rounded-sm transition-colors hover:text-brand-primary">
          이용약관
        </Link>
        <span aria-hidden="true" className="text-slate-300">|</span>
        <Link to="/privacy" className="rounded-sm transition-colors hover:text-brand-primary">
          개인정보처리방침
        </Link>
        <span className="text-slate-500">Copyright © KAIST SOC. All rights reserved.</span>
        <a
          href={OFFICIAL_INSTAGRAM_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Instagram"
          title="Instagram"
          className="ml-2 inline-flex size-6 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-200 hover:text-brand-primary"
        >
          <Instagram className="size-3.5" aria-hidden="true" />
        </a>
      </div>
    </footer>
  );
}
