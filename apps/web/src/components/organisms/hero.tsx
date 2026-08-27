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
  const hero = usePublicContentBlocksByType("HERO")[0];
  const quickLinks = usePublicContentBlocksByType("QUICK_LINK");
  const imageUrl = hero?.imageUrl ? resolveAssetUrl(hero.imageUrl) : "/hero_background_1.jpg";
  const fallbackTitle = useLocalizedSiteContent("home.hero.title");
  const heroText = hero ? resolveContentBlockText(hero, lang) : null;
  const title = heroText?.title || fallbackTitle;

  return (
    <section className="hero-image-placeholder home-public-hero relative w-full overflow-hidden">
      <img
        key={imageUrl}
        src={imageUrl}
        alt=""
        aria-hidden="true"
        loading="eager"
        onLoad={() => setImageLoaded(true)}
        className={`absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-700 ${
          imageLoaded ? "opacity-100" : ""
        }`}
      />
      <div className="home-hero-overlay absolute inset-0" />

      <div className="home-hero-content absolute inset-0 z-10 flex items-end">
        <div className="home-public-content w-full">
          <h1 className="home-hero-title whitespace-pre-line text-white">{title}</h1>
          {quickLinks.length > 0 ? (
            <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-3">
              {quickLinks.map((block) => {
                const text = resolveContentBlockText(block, lang);
                return block.linkUrl ? (
                  <a key={block.contentBlockId} href={block.linkUrl} className="home-hero-quick-link">
                    {text.title}
                    <ArrowUpRight aria-hidden="true" className="size-3.5" />
                  </a>
                ) : null;
              })}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
