import guideData from "@/lib/bongsim/esim-guide-site/esim-guide.data.json";

export const ESIM_GUIDE_SITE_DATA = guideData;

export const ESIM_GUIDE_SITE_PUBLIC_BASE = "/travel/esim/guide/site";

type LocaleCode = keyof typeof guideData.locales;
type GuideLocale = (typeof guideData.locales)[LocaleCode];
type ScreenAsset = (typeof guideData.assets.screens)[keyof typeof guideData.assets.screens];
type DiagramAsset = (typeof guideData.assets.diagrams)[keyof typeof guideData.assets.diagrams];

export type EsimGuideLink = { label: string; url?: string; page?: "guide" | "auth" };
export type EsimGuideBlock =
  | { type: "text"; text: string; links?: EsimGuideLink[] }
  | { type: "note"; text: string; links?: EsimGuideLink[] }
  | { type: "heading"; text: string }
  | { type: "list"; items: string[] }
  | { type: "table"; columns: string[]; rows: string[][] }
  | { type: "lineRoles" }
  | { type: "stepRef"; platform: "iphone" | "galaxy"; number: number; label: string; text: string };
export type EsimGuideDetail = { phase: string; imageKey: string; imageAlt: string; text: string; tip?: string };
export type EsimGuideStep = {
  number: number;
  title?: string;
  phase: string;
  imageKey: string;
  imageAlt: string;
  text: string;
  tip?: string;
  details?: EsimGuideDetail[];
};

export function asBlocks(blocks: unknown): EsimGuideBlock[] {
  return blocks as EsimGuideBlock[];
}

export function asSteps(steps: unknown): EsimGuideStep[] {
  return steps as EsimGuideStep[];
}

/** 요청 locale이 없으면 defaultLocale 문구로 대체한다. */
export function esimGuideLocale(locale?: string): { locale: string; content: GuideLocale } {
  const locales = guideData.locales as Record<string, GuideLocale>;
  const requested = locale && locales[locale] ? locale : guideData.defaultLocale;
  const content = locales[requested] ?? locales[guideData.defaultLocale]!;
  return { locale: requested, content };
}

function localizedPath(asset: ScreenAsset | DiagramAsset, locale: string): string {
  const record = asset as Record<string, string | number>;
  const path = record[locale] ?? record[guideData.defaultLocale];
  if (typeof path !== "string") throw new Error("esim guide asset path missing");
  return `${ESIM_GUIDE_SITE_PUBLIC_BASE}/${path}`;
}

export function esimGuideScreen(key: string, locale: string): { src: string; width: number; height: number } {
  const asset = guideData.assets.screens[key as keyof typeof guideData.assets.screens];
  if (!asset) throw new Error(`esim guide screen missing: ${key}`);
  return { src: localizedPath(asset, locale), width: asset.width, height: asset.height };
}

export function esimGuideDiagram(key: string, locale: string): string {
  const asset = guideData.assets.diagrams[key as keyof typeof guideData.assets.diagrams];
  if (!asset) throw new Error(`esim guide diagram missing: ${key}`);
  return localizedPath(asset, locale);
}
