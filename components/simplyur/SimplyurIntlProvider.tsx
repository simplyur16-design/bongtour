"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { SimplyurLocale } from "@/lib/simplyur/constants";
import type { SimplyurMessages } from "@/lib/simplyur/i18n";
import { t } from "@/lib/simplyur/i18n";

type Ctx = { locale: SimplyurLocale; messages: SimplyurMessages };

const SimplyurIntlContext = createContext<Ctx | null>(null);

export function SimplyurIntlProvider({
  locale,
  messages,
  children,
}: Ctx & { children: ReactNode }) {
  return (
    <SimplyurIntlContext.Provider value={{ locale, messages }}>{children}</SimplyurIntlContext.Provider>
  );
}

export function useSimplyurIntl(): Ctx {
  const ctx = useContext(SimplyurIntlContext);
  if (!ctx) throw new Error("useSimplyurIntl outside provider");
  return ctx;
}

export function useSimplyurT() {
  const { messages } = useSimplyurIntl();
  return (path: string) => t(messages, path);
}
