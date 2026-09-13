import { Link } from "react-router-dom";
import { Facebook, Instagram, MessageCircle } from "lucide-react";

import { useLanguage } from "@/hooks/use-language";

const OFFICIAL_INSTAGRAM_URL = "https://www.instagram.com/in.cs.tagram/";
const OFFICIAL_KAKAOTALK_URL = "http://pf.kakao.com/_xlQJrG";
const OFFICIAL_FACEBOOK_URL = "https://www.facebook.com/cskaist/";

export function Footer() {
  const { lang } = useLanguage();

  return (
    <footer className="home-site-footer mt-auto shrink-0 text-app-text-muted">
      <div className="home-footer-inner mx-auto w-full max-w-7xl px-4 md:px-8">
        <div className="home-footer-brand">
          <Link to="/about#intro" className="rounded-sm transition-colors hover:text-brand-primary">
            {lang === "ko" ? "KAIST 전산학부 집행위원회" : "KAIST SoC Executive Committee"}
          </Link>
          <div className="home-footer-contact">
            <span className="home-footer-address">
              {lang === "ko"
                ? "(34141) 대전광역시 유성구 대학로 291 KAIST N1(김병호·김삼열 IT융합빌딩) 318호"
                : "(34141) KAIST N1 (Kim Byung-Ho · Kim Sam-Yeol IT Convergence Building), 291 Daehak-ro, Yuseong-gu, Daejeon, Room 318"}
            </span>
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
            className="home-footer-social"
          >
            <Instagram aria-hidden="true" />
          </a>
          <a
            href={OFFICIAL_KAKAOTALK_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="카카오톡 채널"
            className="home-footer-social"
          >
            <MessageCircle aria-hidden="true" />
          </a>
          <a
            href={OFFICIAL_FACEBOOK_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Facebook"
            className="home-footer-social"
          >
            <Facebook aria-hidden="true" />
          </a>
        </nav>
      </div>
    </footer>
  );
}
