import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";

import { useLanguage } from "@/hooks/use-language";

export const ABOUT_SECTION_IDS = ["intro", "work", "people", "partnership"] as const;
export type AboutSectionId = (typeof ABOUT_SECTION_IDS)[number];

const LEGACY_ABOUT_SECTIONS: Record<string, AboutSectionId> = {
  history: "intro",
  org: "people",
  pledges: "work",
  members: "people",
};

function isAboutSectionId(value: string | null | undefined): value is AboutSectionId {
  return Boolean(value && ABOUT_SECTION_IDS.includes(value as AboutSectionId));
}

function resolveAboutSectionId(value: string | null | undefined): AboutSectionId | null {
  if (!value) return null;
  if (isAboutSectionId(value)) return value;
  return LEGACY_ABOUT_SECTIONS[value] ?? null;
}

function replaceSectionHash(sectionId: AboutSectionId) {
  const url = new URL(window.location.href);
  url.searchParams.delete("tab");
  url.hash = sectionId;
  window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function useAboutPageController() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const legacyTab = searchParams.get("tab");
  const { lang } = useLanguage();
  const requestedSection = useMemo(() => {
    const hashSection = location.hash.replace(/^#/, "");
    const resolvedHash = resolveAboutSectionId(hashSection);
    if (resolvedHash) return resolvedHash;
    return resolveAboutSectionId(legacyTab) ?? "intro";
  }, [legacyTab, location.hash]);

  const [activeSection, setActiveSection] = useState<AboutSectionId>(requestedSection ?? "intro");
  const suppressScrollSpyUntilRef = useRef(
    requestedSection ? performance.now() + 2500 : 0,
  );

  const scrollToSection = useCallback((sectionId: AboutSectionId, behavior: ScrollBehavior = "smooth") => {
    const target = document.getElementById(sectionId);
    if (!target) return;
    // Native smooth-scroll duration grows with travel distance. Keep the
    // scroll spy quiet until long jumps have settled so it cannot replace the
    // requested hash with an intermediate section on the way down.
    suppressScrollSpyUntilRef.current = performance.now() + (behavior === "smooth" ? 1800 : 120);
    setActiveSection(sectionId);
    replaceSectionHash(sectionId);
    target.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : behavior, block: "start" });
  }, []);

  useEffect(() => {
    if (!requestedSection) return;

    if (legacyTab) {
      navigate(`/about#${requestedSection}`, { replace: true });
    } else if (!resolveAboutSectionId(location.hash.replace(/^#/, ""))) {
      replaceSectionHash(requestedSection);
    }

    let cancelled = false;
    let userInterrupted = false;
    let animationFrame = 0;
    const correctionDeadline = performance.now() + 2200;
    const target = document.getElementById(requestedSection);
    const content = document.querySelector<HTMLElement>("[data-about-content]");
    if (!target) return;

    const stopCorrections = () => {
      userInterrupted = true;
      suppressScrollSpyUntilRef.current = 0;
    };
    const align = () => {
      if (cancelled || userInterrupted || performance.now() > correctionDeadline) return;
      cancelAnimationFrame(animationFrame);
      animationFrame = requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (cancelled || userInterrupted) return;
          suppressScrollSpyUntilRef.current = Math.max(
            suppressScrollSpyUntilRef.current,
            correctionDeadline + 100,
          );
          setActiveSection(requestedSection);
          replaceSectionHash(requestedSection);
          target.scrollIntoView({ behavior: "auto", block: "start" });
        });
      });
    };

    align();
    void document.fonts?.ready.then(align);
    const resizeObserver = content ? new ResizeObserver(align) : null;
    if (content && resizeObserver) resizeObserver.observe(content);
    window.addEventListener("load", align, { once: true });
    window.addEventListener("wheel", stopCorrections, { passive: true });
    window.addEventListener("touchstart", stopCorrections, { passive: true });
    window.addEventListener("pointerdown", stopCorrections, { passive: true });
    window.addEventListener("keydown", stopCorrections);
    const timeout = window.setTimeout(() => resizeObserver?.disconnect(), 2300);

    return () => {
      cancelled = true;
      cancelAnimationFrame(animationFrame);
      window.clearTimeout(timeout);
      resizeObserver?.disconnect();
      window.removeEventListener("load", align);
      window.removeEventListener("wheel", stopCorrections);
      window.removeEventListener("touchstart", stopCorrections);
      window.removeEventListener("pointerdown", stopCorrections);
      window.removeEventListener("keydown", stopCorrections);
    };
  }, [legacyTab, location.hash, navigate, requestedSection]);

  useEffect(() => {
    let animationFrame = 0;
    const updateActiveSection = () => {
      animationFrame = 0;
      if (performance.now() < suppressScrollSpyUntilRef.current) return;

      const rootStyle = getComputedStyle(document.documentElement);
      const headerHeightToken = rootStyle.getPropertyValue("--ui-header-height").trim();
      const rootFontSize = Number.parseFloat(rootStyle.fontSize) || 16;
      const headerHeight = headerHeightToken.endsWith("rem")
        ? Number.parseFloat(headerHeightToken) * rootFontSize
        : Number.parseFloat(headerHeightToken) || 68;
      const anchorLine = headerHeight + 76;
      let nextSection: AboutSectionId = ABOUT_SECTION_IDS[0];
      for (const sectionId of ABOUT_SECTION_IDS) {
        const section = document.getElementById(sectionId);
        if (section && section.getBoundingClientRect().top <= anchorLine) nextSection = sectionId;
      }
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) {
        nextSection = ABOUT_SECTION_IDS[ABOUT_SECTION_IDS.length - 1];
      }

      setActiveSection((current) => {
        if (current === nextSection) return current;
        replaceSectionHash(nextSection);
        return nextSection;
      });
    };
    const onScroll = () => {
      if (!animationFrame) animationFrame = requestAnimationFrame(updateActiveSection);
    };
    updateActiveSection();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(animationFrame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return {
    activeSection,
    lang,
    scrollToSection,
  };
}
