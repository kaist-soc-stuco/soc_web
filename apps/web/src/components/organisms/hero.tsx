import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { useLanguage } from "@/hooks/use-language";

export function Hero() {
  const navigate = useNavigate();
  const { lang } = useLanguage();
  const [imageLoaded, setImageLoaded] = useState(false);

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
          <img
            src="/logo.png"
            alt="TREE Logo"
            className="h-6 w-auto bg-transparent brightness-0 invert opacity-95"
          />
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
            className="text-4xl lg:text-[46px] font-extrabold leading-[1.15] text-white"
            style={{ fontFamily: "'Roboto Slab', serif" }}
          >
            KAIST
            <br />
            School of Computing
          </h1>
        </div>

        {/* Subtitle - Left aligned with the Accent Bar */}
        <p className="mt-2 whitespace-pre-line text-[14px] font-medium leading-[1.65] text-white/86 lg:text-[15px]">
          {lang === "ko" ? (
            <>
              학생들의 목소리를 대변하고,
              <br />더 나은 학업 및 문화 환경을 만들어갑니다.
            </>
          ) : (
            <>
              Representing student voices
              <br />and building a better academic community.
            </>
          )}
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
            <span>{lang === "ko" ? "집행위원회 소개 보기" : "Meet the Council"}</span>
          </button>
        </div>
      </div>
    </section>
  );
}
