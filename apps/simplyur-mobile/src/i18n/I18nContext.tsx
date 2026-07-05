import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import {
  DEFAULT_LOCALE,
  LOCALE_LABELS,
  SIMPLYUR_LOCALES,
  type SimplyurLocale,
} from '@/src/constants/simplyur';
import en from '@/src/i18n/messages/en.json';
import ja from '@/src/i18n/messages/ja.json';
import zh from '@/src/i18n/messages/zh.json';
import zhTW from '@/src/i18n/messages/zh-TW.json';
import vi from '@/src/i18n/messages/vi.json';

export type Messages = typeof en;

const BUNDLE: Record<SimplyurLocale, Messages> = {
  en,
  ja,
  zh,
  'zh-TW': zhTW,
  vi,
};

type Ctx = {
  locale: SimplyurLocale;
  messages: Messages;
  setLocale: (l: SimplyurLocale) => void;
  t: (path: string) => string;
};

const I18nContext = createContext<Ctx | null>(null);

function lookup(messages: Messages, path: string): string {
  const parts = path.split('.');
  let cur: unknown = messages;
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') return path;
    cur = (cur as Record<string, unknown>)[p];
  }
  return typeof cur === 'string' ? cur : path;
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<SimplyurLocale>(DEFAULT_LOCALE);
  const messages = BUNDLE[locale];
  const value = useMemo(
    () => ({
      locale,
      messages,
      setLocale,
      t: (path: string) => lookup(messages, path),
    }),
    [locale, messages],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n outside provider');
  return ctx;
}

export { SIMPLYUR_LOCALES, LOCALE_LABELS };
