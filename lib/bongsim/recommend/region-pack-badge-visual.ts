import { bongsimFlagIsoForDestination } from "@/lib/bongsim/recommend/destination-flag-image";
import { regionPackCarouselFlags } from "@/lib/bongsim/recommend/region-pack-carousel-flags";

/** 다국가 eSIM 타일 — EU/UN 고정 · 그 외 캐러셀(2국+) · 단일 국기 폴백 */
export type RegionPackTileVisual =
  | { type: "flag"; iso: string }
  | { type: "carousel"; isos: string[] }
  | { type: "emoji"; emoji: string };

/** rg-* → EU/UN 고정 · 유럽 제외 캐러셀 · 단일 국기 폴백 */
export function regionPackTileVisual(
  code: string,
  emojiFallback = "🌐",
): RegionPackTileVisual {
  const lc = code.trim().toLowerCase();

  if (lc.startsWith("rg-eu-")) {
    return { type: "flag", iso: "eu" };
  }
  if (lc === "rg-global-151") {
    return { type: "flag", iso: "un" };
  }

  const carouselIsos = regionPackCarouselFlags(lc);
  if (carouselIsos.length >= 2) {
    return { type: "carousel", isos: carouselIsos };
  }
  if (carouselIsos.length === 1) {
    return { type: "flag", iso: carouselIsos[0]! };
  }

  const fallbackIso = bongsimFlagIsoForDestination(lc);
  if (lc.startsWith("rg-") && fallbackIso !== lc) {
    return { type: "flag", iso: fallbackIso };
  }

  return { type: "emoji", emoji: emojiFallback };
}
