import { Link } from "react-router-dom";
import { Instagram } from "lucide-react";

import { useLanguage } from "@/hooks/use-language";

const OFFICIAL_INSTAGRAM_URL = "https://www.instagram.com/in.cs.tagram/";

export function Footer() {
  const { lang } = useLanguage();

  return (
    <footer className="home-site-footer mt-auto shrink-0 text-app-text-muted">
      <div className="home-footer-inner mx-auto w-full max-w-7xl px-4 md:px-8">
        <div className="home-footer-brand">
          <Link to="/about" className="rounded-sm transition-colors hover:text-brand-primary">
            {lang === "ko" ? "KAIST 전산학부 학생회 포털" : "KAIST SoC Student Council Portal"}
          </Link>
          <div className="home-footer-contact">
            <span>{lang === "ko" ? "학생회실: N1 4층 4xx호" : "Student Council Office: N1 4F, Room 4xx"}</span>
            <span aria-hidden="true" className="home-footer-separator">·</span>
            <a className="rounded-sm transition-colors hover:text-brand-primary" href="mailto:kaist.helloworld@gmail.com">
              kaist.helloworld@gmail.com
            </a>
          </div>
          <span className="home-footer-copyright">Copyright © KAIST SoC Student Council. All rights reserved.</span>
        </div>

        <nav className="home-footer-meta select-none" aria-label={lang === "ko" ? "법적 고지" : "Legal information"}>
          <Link to="/terms" className="rounded-sm transition-colors hover:text-brand-primary">
            {lang === "ko" ? "이용약관" : "Terms"}
          </Link>
          <span aria-hidden="true" className="home-footer-separator">|</span>
          <Link to="/privacy" className="rounded-sm font-semibold transition-colors hover:text-brand-primary">
            {lang === "ko" ? "개인정보처리방침" : "Privacy"}
          </Link>
          <a
            href={OFFICIAL_INSTAGRAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Instagram"
            title="Instagram"
            className="home-footer-instagram"
          >
            <Instagram aria-hidden="true" />
          </a>
        </nav>
      </div>
    </footer>
  );
}
