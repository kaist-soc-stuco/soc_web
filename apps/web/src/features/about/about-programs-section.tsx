import { useEffect, useRef, useState } from "react";
import { useLocalizedSiteContent } from "@/features/site-content/site-content";
import { ABOUT_PROGRAM_GROUPS } from "./about-programs";

export function AboutProgramsSection({ lang }: { lang: string }) {
  const korean = lang === "ko";
  const title = useLocalizedSiteContent("about.work.title");
  const [active, setActive] = useState(() => ABOUT_PROGRAM_GROUPS.find(group => window.location.hash === `#program-${group.id}`)?.id ?? ABOUT_PROGRAM_GROUPS[0].id);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    const updateFromHash = () => {
      const group = ABOUT_PROGRAM_GROUPS.find(item => window.location.hash === `#program-${item.id}`);
      if (group) setActive(group.id);
    };
    window.addEventListener("hashchange", updateFromHash);
    return () => window.removeEventListener("hashchange", updateFromHash);
  }, []);

  return <section id="programs" className="tree-section tree-programs" aria-labelledby="tree-programs-title">
    <div className="tree-container">
      <header className="tree-section-heading" data-tree-reveal>
        <h2 id="tree-programs-title">{title}</h2>
      </header>
      <div className="tree-program-layout">
        <div className="tree-program-index" role="tablist" aria-orientation="horizontal" aria-label={korean ? "주요 사업 분야" : "Program areas"}>
          {ABOUT_PROGRAM_GROUPS.map((group, index) => <button key={group.id} type="button" role="tab" id={`program-tab-${group.id}`} aria-selected={active === group.id} aria-controls={`program-${group.id}`} tabIndex={active === group.id ? 0 : -1}
            ref={element => { tabRefs.current[index] = element; }}
            onClick={() => setActive(group.id)}
            onKeyDown={event => {
              const previous = "ArrowLeft";
              const next = "ArrowRight";
              if (![previous, next, "Home", "End"].includes(event.key)) return;
              event.preventDefault();
              const target = event.key === "Home" ? 0 : event.key === "End" ? ABOUT_PROGRAM_GROUPS.length - 1 : (index + (event.key === next ? 1 : -1) + ABOUT_PROGRAM_GROUPS.length) % ABOUT_PROGRAM_GROUPS.length;
              setActive(ABOUT_PROGRAM_GROUPS[target].id);
              tabRefs.current[target]?.focus();
            }}>
            <span>{korean ? group.titleKo : group.titleEn}</span>
          </button>)}
        </div>
        <div className="tree-program-groups">
          {ABOUT_PROGRAM_GROUPS.map(group => <section key={group.id} id={`program-${group.id}`} role="tabpanel" aria-hidden={active !== group.id} inert={active !== group.id} tabIndex={active === group.id ? 0 : -1} className="tree-program-group" aria-labelledby={`program-tab-${group.id}`}>
            <header><h3>{korean ? group.titleKo : group.titleEn}</h3><p>{korean ? group.descriptionKo : group.descriptionEn}</p></header>
            <div className="tree-program-pair">
              {group.programs.map(program => <article key={program.titleEn}>
                <figure className="tree-program-media">
                  <img src={program.image} alt={korean ? program.imageAltKo : program.imageAltEn} width={1600} height={900} loading="lazy" decoding="async" style={{ objectPosition: program.imagePosition }} />
                </figure>
                <div className="tree-program-copy">
                  <h4>{korean ? program.titleKo : program.titleEn}</h4>
                  {(korean ? program.bodyKo : program.bodyEn).split("\n").map(paragraph => <p key={paragraph}>{paragraph}</p>)}
                </div>
              </article>)}
            </div>
          </section>)}
        </div>
      </div>
    </div>
  </section>;
}
