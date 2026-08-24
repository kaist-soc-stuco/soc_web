import { ArrowRight, ArrowUpRight } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

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
  const fallbackDescription = useLocalizedSiteContent("home.hero.description");
  const fallbackCta = useLocalizedSiteContent("home.hero.cta");
  const hero = usePublicContentBlocksByType("HERO")[0];
  const quickLinks = usePublicContentBlocksByType("QUICK_LINK");
  const imageUrl = hero?.imageUrl ? resolveAssetUrl(hero.imageUrl) : "/hero_background_1.jpg";
  const heroText = hero ? resolveContentBlockText(hero, lang) : null;
  const title = heroText?.title || fallbackTitle;
  const description = heroText?.body || fallbackDescription;
  const ctaUrl = hero?.linkUrl || "/about";

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
          <p className="home-hero-eyebrow">KAIST SCHOOL OF COMPUTING · STUDENT COUNCIL</p>
          <h1 className="home-hero-title whitespace-pre-line text-white">{title}</h1>
          {description ? (
            <p className="home-hero-description whitespace-pre-line">{description}</p>
          ) : null}
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link to={ctaUrl} className="home-hero-primary-link">
              {fallbackCta}
              <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
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
        </div>
      </div>
    </section>
  );
}
