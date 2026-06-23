import React, { createContext, useContext, useState, useCallback } from 'react';
import { t as translate, setLanguage, getLanguage } from './locales.js';

const LanguageContext = createContext();

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(getLanguage);

  const switchLanguage = useCallback((newLang) => {
    setLanguage(newLang);
    setLangState(newLang);
  }, []);

  const tFn = useCallback((key, ...args) => translate(key, ...args), [lang]);

  return (
    <LanguageContext.Provider value={{ lang, switchLanguage, t: tFn }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
}

export default LanguageContext;
