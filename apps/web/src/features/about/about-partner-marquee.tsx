import { useEffect, useRef, useState } from "react";
import { ABOUT_PARTNERS } from "./about-partners";

export function AboutPartnerMarquee({ lang }: { lang: string }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [isInView, setIsInView] = useState(false);
  const korean = lang === "ko";
  const label = korean ? "전산학부와 함께한 기업" : "Companies we’ve worked with";

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const observer = new IntersectionObserver(([entry]) => setIsInView(entry.isIntersecting));
    observer.observe(root);
    return () => observer.disconnect();
  }, []);

  return <div ref={rootRef} className="tree-partner-logos" data-running={isInView}>
    <div className="tree-partner-caption">
      <p>{label}</p>
    </div>
    <div className="tree-partner-window">
      <div className="tree-partner-track">
        {[false, true].map(duplicate => <ul key={String(duplicate)} className="tree-partner-group" aria-label={duplicate ? undefined : label} aria-hidden={duplicate || undefined}>
          {ABOUT_PARTNERS.map(partner => <li key={partner.nameEn}>
            <img src={partner.logo} alt={duplicate ? "" : korean ? partner.nameKo : partner.nameEn} className={`tree-partner-logo tree-partner-logo--${partner.treatment}`} width={180} height={56} loading="lazy" decoding="async" />
          </li>)}
        </ul>)}
      </div>
    </div>
  </div>;
}
