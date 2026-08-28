import { Link } from "react-router-dom";
import { Instagram } from "lucide-react";

import { useLanguage } from "@/hooks/use-language";

const OFFICIAL_INSTAGRAM_URL = "https://www.instagram.com/in.cs.tagram/";

export function Footer() {
  const { lang } = useLanguage();

  return (
    <footer className="home-site-footer mt-auto shrink-0 text-app-text-muted">
      <div className="home-footer-inner mx-auto w-full max-w-7xl px-4 md:px-8">
        <div className="home-footer-contact">
          <Link to="/about" className="rounded-sm transition-colors hover:text-brand-primary">
            {lang === "ko" ? "KAIST 전산학부 집행위원회" : "KAIST SoC Student Council"}
          </Link>
          <span aria-hidden="true" className="home-footer-separator">·</span>
          <span>{lang === "ko" ? "학생회실: N1 4층 4xx호" : "Student Council Office: N1 4F, Room 4xx"}</span>
          <span aria-hidden="true" className="home-footer-separator">·</span>
          <a className="rounded-sm transition-colors hover:text-brand-primary" href="mailto:contact@cs.kaist.ac.kr">
            contact@cs.kaist.ac.kr
          </a>
        </div>

        <div className="home-footer-meta">
          <Link to="/terms" className="rounded-sm transition-colors hover:text-brand-primary">
            {lang === "ko" ? "이용약관" : "Terms"}
          </Link>
          <span aria-hidden="true" className="home-footer-separator">|</span>
          <Link to="/privacy" className="rounded-sm transition-colors hover:text-brand-primary">
            {lang === "ko" ? "개인정보처리방침" : "Privacy"}
          </Link>
          <span className="home-footer-copyright">Copyright © KAIST SoC. All rights reserved.</span>
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
        </div>
      </div>
    </footer>
  );
}
