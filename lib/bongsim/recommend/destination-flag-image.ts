import { resolveBongsimFlagImageUrlOrFallback } from "@/lib/bongsim-flag-image-url";
import { isRegionPackCode } from "@/lib/bongsim/recommend/region-pack-plan";

/** rg-* 권역 패키지 → 대표 ISO 국기 (NCloud·flagcdn) */
const REGION_PACK_FLAG_ISO: Record<string, string> = {
  "rg-eu-33": "eu",
  "rg-eu-42": "eu",
  "rg-eu-36": "eu",
  "rg-eu-27": "eu",
  "rg-us-ca": "us",
  "rg-na-3": "us",
  "rg-sea-3": "th",
  "rg-sea-8": "th",
  "rg-global-151": "un",
  "rg-as-13": "sg",
  "rg-cn-hk-mo": "cn",
  "rg-hk-mo": "hk",
  "rg-gu-mp": "gu",
  "rg-au-nz": "au",
  "rg-es-pt": "es",
  "rg-sa-11": "br",
  "rg-nafr-4": "eg",
  "rg-benelux-3": "be",
  "rg-nordic-5": "se",
  "rg-me-6": "ae",
  "rg-ca-5": "kz",
  "rg-caucasus-3": "ge",
  "rg-kr-jp": "kr",
  "rg-kr-cn-jp": "kr",
  "rg-fr-ch-it": "fr",
};

/** UI 국기 이미지용 ISO — 단일 국가 코드 또는 rg-* 권역 매핑 */
export function bongsimFlagIsoForDestination(code: string): string {
  const lower = code.trim().toLowerCase();
  if (lower === "eu") return "eu";
  const mapped = REGION_PACK_FLAG_ISO[lower];
  if (mapped) return mapped;
  if (lower.startsWith("rg-eu-")) return "eu";
  return lower;
}

export function resolveDestinationFlagImageUrl(code: string): string {
  return resolveBongsimFlagImageUrlOrFallback(bongsimFlagIsoForDestination(code));
}

/** 단일 국가만 국기 이미지 — 다국가(rg-*)는 RegionPackBadgeIcon */
export function destinationUsesFlagImage(code: string): boolean {
  return !isRegionPackCode(code);
}
