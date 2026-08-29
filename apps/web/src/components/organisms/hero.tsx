import { useEffect, useState } from "react";

import {
  useLocalizedSiteContent,
  usePublicContentBlocksByType,
} from "@/features/site-content/site-content";
import { resolveAssetUrl } from "@/lib/asset-url";

export function Hero() {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [heroIndex, setHeroIndex] = useState(0);
  const fallbackTitle = useLocalizedSiteContent("home.hero.title");
  const heroes = usePublicContentBlocksByType("HERO");
  const hero = heroes[heroIndex] ?? heroes[0];
  const imageUrl = hero?.imageUrl ? resolveAssetUrl(hero.imageUrl) : "/hero_background_1.jpg";

  useEffect(() => {
    if (heroIndex < heroes.length) return;
    setHeroIndex(0);
  }, [heroIndex, heroes.length]);

  useEffect(() => {
    if (heroes.length <= 1) return;
    const intervalId = window.setInterval(() => {
      setHeroIndex((current) => (current + 1) % heroes.length);
    }, 6000);
    return () => window.clearInterval(intervalId);
  }, [heroes.length]);

  useEffect(() => {
    setImageLoaded(false);
  }, [imageUrl]);

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
    </section>
  );
}
