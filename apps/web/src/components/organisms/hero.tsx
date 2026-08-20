import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { useLocalizedSiteContent } from "@/features/site-content/site-content";

export function Hero() {
  const navigate = useNavigate();
  const [imageLoaded, setImageLoaded] = useState(false);
  const title = useLocalizedSiteContent("home.hero.title");
  const description = useLocalizedSiteContent("home.hero.description");
  const ctaLabel = useLocalizedSiteContent("home.hero.cta");

  return (
    <section className="hero-image-placeholder relative h-full w-full overflow-hidden select-none">
      <img
        src="/hero_background_1.jpg"
        alt=""
        aria-hidden="true"
        loading="eager"
        onLoad={() => setImageLoaded(true)}
        className={`absolute inset-0 h-full w-full object-cover opacity-[0.43] transition-[opacity,transform] duration-700 hover:scale-[1.01] ${
          imageLoaded ? "opacity-[0.43]" : "opacity-0"
        }`}
      />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(5,20,13,0.42),rgba(5,20,13,0.18))]" />

      {/* Top Logo Area layered absolute on top of the hero image */}
      <div className="absolute top-0 left-0 right-0 z-20 flex h-16 items-center px-8">
        <div className="flex items-center gap-3">
          <img
            src="/kaist_logo.png"
            alt="KAIST Logo"
            className="h-5 w-auto brightness-0 invert opacity-95"
          />
          <div className="h-4 w-px bg-white/30" />
          <span className="flex flex-col leading-none text-white" aria-label="SOC Student Council">
            <span className="text-xl font-black tracking-[-0.04em]">
              SOC
            </span>
            <span className="mt-0.5 text-[7px] font-black uppercase tracking-[0.18em] text-white/70">
              Student Council
            </span>
          </span>
        </div>
      </div>

      {/* Content - Vertically centered */}
      <div className="absolute inset-0 z-10 flex flex-col justify-center px-10 lg:px-14">
        {/* Accent Bar + Title Group */}
        <div className="flex items-stretch gap-3.5 mb-6">
          {/* Green Accent Bar - Thin, Premium Line */}
          <div className="w-[3px] bg-[#40c057] rounded-sm shrink-0" />

          {/* Title */}
          <h1
            className="whitespace-pre-line text-4xl font-extrabold leading-[1.15] text-white lg:text-[46px]"
            style={{ fontFamily: "'Roboto Slab', serif" }}
          >
            {title}
          </h1>
        </div>

        {/* Subtitle - Left aligned with the Accent Bar */}
        <p className="mt-2 whitespace-pre-line text-[14px] font-medium leading-[1.65] text-white/86 lg:text-[15px]">
          {description}
        </p>

        {/* Button - Left aligned with the Accent Bar */}
        <div>
          <button
            onClick={() => navigate("/about")}
            className="mt-8 flex items-center gap-2.5 rounded-full bg-[#05260f] px-5 py-2.5 text-xs font-bold text-white shadow-md transition-all hover:scale-[1.02] hover:bg-[#0c3c16] cursor-pointer lg:text-[13px]"
          >
            {/* White circle background with green play triangle */}
            <span className="w-5 h-5 rounded-full bg-white flex items-center justify-center text-[8px] text-[#2b8a3e] shrink-0 select-none shadow-2xs">
              ▶
            </span>
            <span>{ctaLabel}</span>
          </button>
        </div>
      </div>
    </section>
  );
}
