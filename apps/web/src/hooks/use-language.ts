import { useEffect, useState } from "react";

import {
  isLanguage,
  LANGUAGE_STORAGE_KEY,
  resolveInitialLanguage,
  type Language,
} from "@/lib/i18n";

export type { Language } from "@/lib/i18n";

const LANGUAGE_CHANGE_EVENT = "soc-language-change";

function getBrowserLanguage(): Language {
  if (typeof window === "undefined") return "ko";

  return resolveInitialLanguage({
    navigatorLanguages:
      window.navigator.languages.length > 0
        ? window.navigator.languages
        : [window.navigator.language],
    storedLanguage: window.localStorage.getItem(LANGUAGE_STORAGE_KEY),
  });
}

export function useLanguage() {
  const [lang, setLangState] = useState<Language>(getBrowserLanguage);

  useEffect(() => {
    const handleLanguageChange = () => {
      const current = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
      if (isLanguage(current)) {
        setLangState(current);
      }
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === LANGUAGE_STORAGE_KEY && isLanguage(event.newValue)) {
        setLangState(event.newValue);
      }
    };

    window.addEventListener(LANGUAGE_CHANGE_EVENT, handleLanguageChange);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener(LANGUAGE_CHANGE_EVENT, handleLanguageChange);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLanguage = (newLang: Language) => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, newLang);
    setLangState(newLang);
    window.dispatchEvent(new Event(LANGUAGE_CHANGE_EVENT));
  };

  return { lang, setLanguage };
}
