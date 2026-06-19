import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import zhCN from './locales/zh-CN.json';
import en from './locales/en.json';
import ru from './locales/ru.json';

const STORAGE_KEY = 'zcas.locale';
const dictionaries = {
  'zh-CN': zhCN,
  en,
  ru,
};

const LocaleContext = createContext(null);

function normalizeLocale(input) {
  const value = String(input || '').toLowerCase();
  if (value.startsWith('zh')) return 'zh-CN';
  if (value.startsWith('ru')) return 'ru';
  return 'en';
}

function resolvePath(source, path) {
  return path.split('.').reduce((acc, key) => (acc && Object.prototype.hasOwnProperty.call(acc, key) ? acc[key] : undefined), source);
}

function interpolate(template, values) {
  if (typeof template !== 'string') return template;
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    const value = values?.[key];
    return value == null ? '' : String(value);
  });
}

export function getInitialLocale() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return normalizeLocale(saved);
  } catch (_) {}
  if (typeof navigator !== 'undefined' && navigator.language) {
    return normalizeLocale(navigator.language);
  }
  return 'zh-CN';
}

export function LocaleProvider({ children }) {
  const [locale, setLocaleState] = useState(getInitialLocale);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, locale);
    } catch (_) {}
  }, [locale]);

  const setLocale = (nextLocale) => setLocaleState(normalizeLocale(nextLocale));

  const value = useMemo(() => {
    const dict = dictionaries[locale] || dictionaries.en;
    const fallback = dictionaries.en;
    return {
      locale,
      setLocale,
      t: (key, values) => {
        const raw = resolvePath(dict, key) ?? resolvePath(fallback, key) ?? key;
        return interpolate(raw, values);
      },
    };
  }, [locale]);

  return React.createElement(LocaleContext.Provider, { value }, children);
}

export function useI18n() {
  const context = useContext(LocaleContext);
  if (!context) {
    return {
      locale: 'en',
      setLocale: () => {},
      t: (key, values) => interpolate(resolvePath(en, key) ?? key, values),
    };
  }
  return context;
}
