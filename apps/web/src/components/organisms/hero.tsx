import { ArrowUpRight } from "lucide-react";
import { useState } from "react";

import {
  resolveContentBlockText,
  useLocalizedSiteContent,
  usePublicContentBlocksByType,
} from "@/features/site-content/site-content";
import { useLanguage } from "@/hooks/use-language";
import { resolveAssetUrl } from "@/lib/asset-url";

export function Hero() {
  const [imageLoaded, setImageLoaded] = useState(false);
  const { lang } = useLanguage();
  const fallbackTitle = useLocalizedSiteContent("home.hero.title");
  const hero = usePublicContentBlocksByType("HERO")[0];
  const quickLinks = usePublicContentBlocksByType("QUICK_LINK");
  const imageUrl = hero?.imageUrl ? resolveAssetUrl(hero.imageUrl) : "/hero_background_1.jpg";

  return (
    <section className="hero-image-placeholder relative h-full w-full overflow-hidden">
      <img
        key={imageUrl}
        src={imageUrl}
        alt=""
        aria-hidden="true"
        loading="eager"
        onLoad={() => setImageLoaded(true)}
        className={`absolute inset-0 h-full w-full object-cover opacity-0 transition-[opacity,transform] duration-700 hover:scale-[1.01] ${
          imageLoaded ? "opacity-40" : ""
        }`}
      />
      <div className="home-hero-overlay absolute inset-0" />

      {/* Content - Vertically centered */}
      <div className="absolute inset-0 z-10 flex flex-col justify-center px-10 lg:px-14">
        {/* Accent Bar + Title Group */}
        <div className="mb-6 flex items-stretch gap-3.5">
          {/* Green Accent Bar - Thin, Premium Line */}
          <div className="home-hero-accent" />

          {/* Title */}
          <h1
            className="home-hero-title whitespace-pre-line text-white"
          >
            {fallbackTitle}
          </h1>
        </div>
      </div>
      {quickLinks.length > 0 ? (
        <nav aria-label={lang === "en" ? "Quick links" : "빠른 링크"} className="absolute bottom-7 left-10 right-10 z-10 flex flex-wrap gap-2 lg:left-14 lg:right-14">
          {quickLinks.map((block) => {
            const text = resolveContentBlockText(block, lang);
            return block.linkUrl ? (
              <a key={block.contentBlockId} href={block.linkUrl} className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-xs font-medium text-white backdrop-blur-sm transition-all hover:bg-white/20">
                {text.title}
                <ArrowUpRight aria-hidden="true" className="size-3" />
              </a>
            ) : null;
          })}
        </nav>
      ) : null}
    </section>
  );
}
