import { Instagram } from "lucide-react";

import { useLanguage } from "@/hooks/use-language";
import { useLocalizedSiteContent } from "@/features/site-content/site-content";

const OFFICIAL_INSTAGRAM_URL = "https://www.instagram.com/in.cs.tagram/";

export function Footer() {
  const { lang } = useLanguage();
  const description = useLocalizedSiteContent("footer.description");
  const contactLabel = useLocalizedSiteContent("footer.contact");

  return (
    <footer className="mt-auto border-t border-[#004B2B] bg-[#004B2B] py-5 text-white/80">
      <div className="mx-auto flex w-full max-w-7xl flex-col items-center justify-between gap-4 px-4 md:flex-row md:px-8">
        <div className="space-y-2 text-center md:text-left">
          <h2 className="text-sm font-bold tracking-tight text-white md:text-base">
            {description}
          </h2>
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs font-medium text-white/70 md:justify-start">
            <a href="/about?tab=members" className="transition-colors hover:text-white">
              {lang === "ko" ? "구성원" : "Members"}
            </a>
            <span aria-hidden="true">·</span>
            <a href="/privacy" className="transition-colors hover:text-white">
              {lang === "ko" ? "개인정보처리방침" : "Privacy Policy"}
            </a>
            <span aria-hidden="true">·</span>
            <a
              href="mailto:cs_suhak@kaist.ac.kr"
              className="transition-colors hover:text-white"
            >
              {contactLabel}
            </a>
          </div>
          <p className="text-xs font-medium tracking-wide text-white/55">
            &copy; 2026 SOC. All rights reserved.
          </p>
        </div>

        <a
          href={OFFICIAL_INSTAGRAM_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-11 items-center gap-2 rounded-lg border border-white/20 px-3 text-sm font-semibold text-white/80 transition-colors hover:border-white/40 hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          aria-label={
            lang === "ko"
              ? "SOC 공식 Instagram 새 창에서 열기"
              : "Open the official SOC Instagram in a new tab"
          }
        >
          <Instagram aria-hidden="true" className="h-4 w-4" />
          <span>@in.cs.tagram</span>
        </a>
      </div>
    </footer>
  );
}
