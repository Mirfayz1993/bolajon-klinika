'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import uzLatin from '../../public/locales/uz-latin.json';
import uzCyrillic from '../../public/locales/uz-cyrillic.json';

type Locale = 'uz-latin' | 'uz-cyrillic';
type Translations = typeof uzLatin;

interface LanguageContextType {
  t: Translations;
  locale: Locale;
  setLocale: (locale: Locale) => void;
  toggleLocale: () => void;
}

const LanguageContext = createContext<LanguageContextType | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    if (typeof window === 'undefined') return 'uz-latin';
    const saved = window.localStorage.getItem('locale');
    return saved === 'uz-latin' || saved === 'uz-cyrillic' ? saved : 'uz-latin';
  });

  useEffect(() => {
    localStorage.setItem('locale', locale);
  }, [locale]);

  const setLocale = (next: Locale) => setLocaleState(next);
  const toggleLocale = () =>
    setLocaleState((prev) => (prev === 'uz-latin' ? 'uz-cyrillic' : 'uz-latin'));

  const t: Translations = locale === 'uz-latin' ? uzLatin : (uzCyrillic as Translations);

  return (
    <LanguageContext.Provider value={{ t, locale, setLocale, toggleLocale }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
}
