/**
 * Hotel bilingual display — user (visitor) language vs destination local language.
 * REGRESSION-FREEZE[simplyur-trip-inbox-ssot]: bilingual hotel + dest_lang — manifest
 */
import type { TripHotelSegmentPayload } from "@/lib/simplyur/trip-inbox/types";

export const TRIP_DEST_LANGS = ["ko", "ja", "zh", "en"] as const;
export type TripDestLang = (typeof TRIP_DEST_LANGS)[number];

const HANGUL = /[\uAC00-\uD7A3]/;
const KANA = /[\u3040-\u30FF]/
const HAN = /[\u4E00-\u9FFF]/
const LATIN = /[A-Za-z]/

function nonempty(v: string | null | undefined): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function hasLocalScript(s: string): boolean {
  return HANGUL.test(s) || KANA.test(s) || HAN.test(s);
}

/** Infer destination language from hotel address / name (Phase 1 heuristics). */
export function detectHotelDestLang(
  address: string | null | undefined,
  propertyName: string | null | undefined,
): TripDestLang {
  const blob = `${address ?? ""} ${propertyName ?? ""}`;
  if (
    /東京|大阪|京都|横浜|札幌|福岡|日本|Japan|Tokyo|Osaka|Kyoto|Akasaka|Minato|Shibuya|Shinjuku|JP\b|〒/i.test(
      blob,
    ) ||
    KANA.test(blob)
  ) {
    return "ja";
  }
  if (/北京|上海|广州|深圳|中国|China|Beijing|Shanghai/i.test(blob)) {
    return "zh";
  }
  if (
    /서울|부산|제주|한국|Korea|Seoul|Busan|Jeju|KR\b|인천|ICN/i.test(blob) ||
    HANGUL.test(blob)
  ) {
    return "ko";
  }
  // Simplyur Phase 1 market default
  return "ko";
}

function extractLatin(raw: string): string {
  const parts = raw
    .split(/\s*[|/｜]\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
  const latinPart = parts.find((p) => LATIN.test(p) && !hasLocalScript(p));
  if (latinPart) return latinPart;
  const m = raw.match(/[A-Za-z][A-Za-z0-9 .,'&\-]*/g);
  return m?.join(" ").replace(/\s+/g, " ").trim() || "";
}

function extractLocal(raw: string): string {
  const parts = raw
    .split(/\s*[|/｜]\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
  const localPart = parts.find((p) => hasLocalScript(p));
  if (localPart) return localPart;
  const m = raw.match(/[\uAC00-\uD7A3\u3040-\u30FF\u4E00-\u9FFF][\uAC00-\uD7A3\u3040-\u30FF\u4E00-\u9FFF0-9 .·\-ー]*/g);
  return m?.join(" ").replace(/\s+/g, " ").trim() || "";
}

/**
 * Fill property_name_user / property_name_dest / dest_lang from a single parsed name.
 * Does not call an MT API — splits scripts and lets the user correct.
 */
export function enrichHotelBilingual(payload: TripHotelSegmentPayload): TripHotelSegmentPayload {
  const destLang =
    payload.dest_lang && (TRIP_DEST_LANGS as readonly string[]).includes(payload.dest_lang)
      ? payload.dest_lang
      : detectHotelDestLang(payload.address, payload.property_name);

  let nameUser = payload.property_name_user?.trim() || null;
  let nameDest = payload.property_name_dest?.trim() || null;
  const raw = payload.property_name?.trim() || "";

  if (raw && !nameUser && !nameDest) {
    const local = hasLocalScript(raw);
    const latin = LATIN.test(raw);
    if (local && latin) {
      nameUser = extractLatin(raw) || null;
      nameDest = extractLocal(raw) || null;
    } else if (local) {
      nameDest = raw;
    } else {
      nameUser = raw;
    }
  }

  let addressUser = payload.address_user?.trim() || null;
  let addressDest = payload.address_dest?.trim() || null;
  const addr = payload.address?.trim() || "";
  if (addr && !addressUser && !addressDest) {
    const local = hasLocalScript(addr);
    const latin = LATIN.test(addr);
    if (local && latin) {
      addressUser = extractLatin(addr) || null;
      addressDest = extractLocal(addr) || addr;
    } else if (local) {
      addressDest = addr;
    } else {
      addressUser = addr;
    }
  }

  return {
    ...payload,
    property_name: nameUser || nameDest || payload.property_name,
    property_name_user: nameUser,
    property_name_dest: nameDest,
    address_user: addressUser,
    address_dest: addressDest,
    dest_lang: destLang,
  };
}

export function hotelNameForUser(p: TripHotelSegmentPayload): string | null {
  if (nonempty(p.property_name_user)) return p.property_name_user;
  if (nonempty(p.property_name) && !hasLocalScript(p.property_name)) return p.property_name;
  if (nonempty(p.property_name) && !nonempty(p.property_name_dest)) return p.property_name;
  return null;
}

export function hotelNameForDest(p: TripHotelSegmentPayload): string | null {
  if (nonempty(p.property_name_dest)) return p.property_name_dest;
  if (nonempty(p.property_name) && hasLocalScript(p.property_name)) return p.property_name;
  return null;
}

export function hotelAddressForUser(p: TripHotelSegmentPayload): string | null {
  if (nonempty(p.address_user)) return p.address_user;
  if (nonempty(p.address) && !hasLocalScript(p.address)) return p.address;
  return null;
}

export function hotelAddressForDest(p: TripHotelSegmentPayload): string | null {
  if (nonempty(p.address_dest)) return p.address_dest;
  if (nonempty(p.address) && hasLocalScript(p.address)) return p.address;
  return null;
}

/** Dest-language label key suffix for i18n: myTrip.destLang.ko etc. */
export function destLangMessageKey(lang: TripDestLang | null | undefined): string {
  const l = lang && (TRIP_DEST_LANGS as readonly string[]).includes(lang) ? lang : "ko";
  return `myTrip.destLang.${l}`;
}
