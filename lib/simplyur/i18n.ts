import type { SimplyurLocale } from "@/lib/simplyur/constants";
import type en from "@/lib/simplyur/messages/en.json";

export type SimplyurMessages = typeof en;

const CACHE = new Map<SimplyurLocale, SimplyurMessages>();

export async function getSimplyurMessages(locale: SimplyurLocale): Promise<SimplyurMessages> {
  const hit = CACHE.get(locale);
  if (hit) return hit;
  const mod = await import(`@/lib/simplyur/messages/${locale}.json`);
  const messages = mod.default as SimplyurMessages;
  CACHE.set(locale, messages);
  return messages;
}

export function t(messages: SimplyurMessages, path: string): string {
  const parts = path.split(".");
  let cur: unknown = messages;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object") return path;
    cur = (cur as Record<string, unknown>)[p];
  }
  return typeof cur === "string" ? cur : path;
}
