import React, { createContext, useContext, useEffect, useState } from 'react';
import { translations, type TranslationKey } from '../i18n/translations';
import type { Language } from '../types';

interface LanguageContextValue {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: TranslationKey) => string;
}

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

const STORAGE_KEY = 'mw_ecms_lang';

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Language>(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      return saved === 'ta' ? 'ta' : 'en';
    } catch {
      return 'en';
    }
  });

  const setLang = (next: Language) => {
    setLangState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Ignore storage errors in restricted iframes
    }
  };

  useEffect(() => {
    document.documentElement.lang = lang === 'ta' ? 'ta' : 'en';
  }, [lang]);

  const t = (key: TranslationKey): string => {
    return translations[lang][key] ?? translations.en[key];
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error('useLanguage must be used inside LanguageProvider');
  }
  return ctx;
}
