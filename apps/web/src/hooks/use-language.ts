import { useState, useEffect } from "react";
import { useCurrentSession } from "./use-current-session";

export type Language = "ko" | "en";

export function useLanguage() {
  const { data: session } = useCurrentSession();
  
  // Determine default language based on session & nameKo === nameEn
  const getDefaultLanguage = (): Language => {
    const saved = localStorage.getItem("lang");
    if (saved === "ko" || saved === "en") return saved;
    
    if (session?.authenticated && session.nameKo && session.nameEn) {
      if (session.nameKo === session.nameEn) {
        return "en";
      }
    }
    return "ko";
  };

  const [lang, setLangState] = useState<Language>(getDefaultLanguage);

  useEffect(() => {
    // When session loads, if there is no user-selected language, re-evaluate
    if (!localStorage.getItem("lang") && session?.authenticated && session.nameKo && session.nameEn) {
      setLangState(session.nameKo === session.nameEn ? "en" : "ko");
    }
  }, [session]);

  useEffect(() => {
    const handleLangChange = () => {
      const current = localStorage.getItem("lang") as Language;
      if (current === "ko" || current === "en") {
        setLangState(current);
      }
    };
    window.addEventListener("lang-change", handleLangChange);
    return () => window.removeEventListener("lang-change", handleLangChange);
  }, []);

  const setLanguage = (newLang: Language) => {
    localStorage.setItem("lang", newLang);
    setLangState(newLang);
    window.dispatchEvent(new Event("lang-change"));
  };

  return { lang, setLanguage };
}
