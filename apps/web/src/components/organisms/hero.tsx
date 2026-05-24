import { useNavigate } from 'react-router-dom';

export function Hero() {
  const navigate = useNavigate();

  return (
    <section className="relative h-full w-full overflow-hidden bg-slate-950 select-none">
      {/* Background Image - goes all the way to the top! */}
      <div 
        className="absolute inset-0 bg-cover bg-center opacity-40 transition-transform duration-500 hover:scale-101"
        style={{
          backgroundImage: `url('/hero_background_1.jpg')`,
        }}
      />

      {/* Top Logo Area layered absolute on top of the hero image */}
      <div className="absolute top-0 left-0 right-0 h-14 flex items-center px-8 z-20">
        <div className="flex items-center gap-3">
          <img 
            src="/kaist_logo.png" 
            alt="KAIST Logo" 
            className="h-5 w-auto brightness-0 invert"
          />
          <div className="h-4 w-px bg-white/30" />
          <img 
            src="/logo.png" 
            alt="TREE Logo" 
            className="h-6 w-auto bg-transparent brightness-0 invert"
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
              className="text-4xl lg:text-[46px] font-black leading-[1.15] tracking-tight text-white"
              style={{ fontFamily: "'Roboto Slab', serif" }}
            >
              KAIST School<br />
              Of Computing
            </h1>
          </div>

          {/* Subtitle - Left aligned with the Accent Bar */}
          <p className="text-[14px] lg:text-base text-white/90 leading-[1.6] font-medium tracking-tight whitespace-pre-line mt-2">
            학생들의 목소리를 대변하고,<br />
            더 나은 학업 및 문화 환경을 만들어갑니다.
          </p>

          {/* Button - Left aligned with the Accent Bar */}
          <div>
            <button 
              onClick={() => navigate('/about')}
              className="mt-8 flex items-center gap-2.5 px-5 py-2.5 rounded-full bg-[#05260f] text-white text-xs lg:text-sm font-black hover:bg-[#0c3c16] transition-all shadow-md cursor-pointer hover:scale-102"
            >
              {/* White circle background with green play triangle */}
              <span className="w-5 h-5 rounded-full bg-white flex items-center justify-center text-[8px] text-[#2b8a3e] shrink-0 select-none shadow-2xs">
                ▶
              </span>
              <span className="font-extrabold tracking-tight">집행위원회 소개 보기</span>
            </button>
          </div>
        </div>
      </section>
  );
}
