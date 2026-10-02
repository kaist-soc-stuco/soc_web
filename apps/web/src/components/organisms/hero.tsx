import { ArrowUpRight } from "lucide-react";

import {
  resolveContentBlockText,
  useLocalizedSiteContent,
  usePublicContentBlocksByType,
} from "@/features/site-content/site-content";
import { useLanguage } from "@/hooks/use-language";
import { resolveAssetUrl } from "@/lib/asset-url";

export function Hero() {
  const { lang } = useLanguage();
  const hero = usePublicContentBlocksByType("HERO")[0];
  const quickLinks = usePublicContentBlocksByType("QUICK_LINK");
  const imageUrl = hero?.imageUrl ? resolveAssetUrl(hero.imageUrl) : "/hero_background_1.jpg";
  const fallbackTitle = useLocalizedSiteContent("home.hero.title");
  const fallbackDescription = useLocalizedSiteContent("home.hero.description");
  const heroText = hero ? resolveContentBlockText(hero, lang) : null;
  const title = heroText?.title || fallbackTitle;
  const description = heroText?.body || fallbackDescription;

  return (
    <section
      data-home-hero
      aria-labelledby="home-hero-title"
      className="hero-image-placeholder home-public-hero relative w-full overflow-hidden"
    >
      <img
        key={imageUrl}
        src={imageUrl}
        alt=""
        aria-hidden="true"
        loading="eager"
        className="home-hero-background absolute inset-0 h-full w-full object-cover"
      />
      <div className="home-hero-overlay absolute inset-0" />

      <div className="home-hero-content absolute inset-0 z-10 flex items-end">
        <div className="home-public-content w-full">
          <h1 id="home-hero-title" className="home-hero-title home-hero-title-enter whitespace-pre-line text-white">
            {title}
          </h1>
          {description.trim() ? (
            <p className="home-hero-description whitespace-pre-line">{description}</p>
          ) : null}
          {quickLinks.length > 0 ? (
            <div className="home-hero-links-enter mt-7 flex flex-wrap items-center gap-x-5 gap-y-3">
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
