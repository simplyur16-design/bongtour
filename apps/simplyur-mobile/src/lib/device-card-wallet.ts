/**
 * Device-only card reminder (last4 / brand / expiry). Never PAN/CVV, never our server.
 * REGRESSION-FREEZE[simplyur-device-card-wallet]: phone SecureStore only — manifest
 */

export const DEVICE_SAVED_CARD_BRANDS = [
  "visa",
  "mastercard",
  "amex",
  "unionpay",
  "jcb",
  "unknown",
] as const;
export type DeviceSavedCardBrand = (typeof DEVICE_SAVED_CARD_BRANDS)[number];

export type DeviceSavedCard = {
  id: string;
  brand: DeviceSavedCardBrand;
  last4: string;
  expMonth: number | null;
  expYear: number | null;
  nickname: string;
  savedAt: number;
};

const PAN_LIKE = /\d[\d\s-]{11,18}\d/;
const FORBIDDEN_KEYS = /pan|card_number|cardnumber|cvv|cvc|cid|security_code/i;

function asBrand(raw: unknown): DeviceSavedCardBrand {
  const s = String(raw ?? "")
    .trim()
    .toLowerCase();
  return (DEVICE_SAVED_CARD_BRANDS as readonly string[]).includes(s)
    ? (s as DeviceSavedCardBrand)
    : "unknown";
}

function last4Only(raw: unknown): string | null {
  const digits = String(raw ?? "").replace(/\D/g, "");
  if (digits.length !== 4) return null;
  return digits;
}

function monthOrNull(raw: unknown): number | null {
  const n = typeof raw === "number" ? raw : Number.parseInt(String(raw ?? ""), 10);
  if (!Number.isInteger(n) || n < 1 || n > 12) return null;
  return n;
}

function yearOrNull(raw: unknown): number | null {
  const n = typeof raw === "number" ? raw : Number.parseInt(String(raw ?? ""), 10);
  if (!Number.isInteger(n)) return null;
  if (n >= 0 && n <= 99) return 2000 + n;
  if (n >= 2024 && n <= 2100) return n;
  return null;
}

/** Reject full PAN / CVV blobs so they never land in SecureStore. */
export function looksLikeForbiddenCardSecret(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === "string") {
    const compact = value.replace(/[\s-]/g, "");
    if (/^\d{12,19}$/.test(compact)) return true;
    if (PAN_LIKE.test(value)) return true;
    return false;
  }
  if (typeof value !== "object") return false;
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (FORBIDDEN_KEYS.test(k)) return true;
    if (looksLikeForbiddenCardSecret(v)) return true;
  }
  return false;
}

export function sanitizeDeviceSavedCard(input: unknown): DeviceSavedCard | null {
  if (!input || typeof input !== "object") return null;
  if (looksLikeForbiddenCardSecret(input)) return null;
  const rec = input as Record<string, unknown>;
  const last4 = last4Only(rec.last4);
  if (!last4) return null;
  const nickname = String(rec.nickname ?? "")
    .trim()
    .slice(0, 40);
  const idRaw = String(rec.id ?? "").trim();
  const savedAt =
    typeof rec.savedAt === "number" && Number.isFinite(rec.savedAt) ? rec.savedAt : Date.now();
  return {
    id: idRaw || `card_${savedAt.toString(36)}_${last4}`,
    brand: asBrand(rec.brand),
    last4,
    expMonth: monthOrNull(rec.expMonth),
    expYear: yearOrNull(rec.expYear),
    nickname,
    savedAt,
  };
}

export function parseDeviceSavedCardList(raw: string): DeviceSavedCard[] {
  if (!raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as { cards?: unknown };
    if (!Array.isArray(parsed.cards)) return [];
    const out: DeviceSavedCard[] = [];
    const seen = new Set<string>();
    for (const item of parsed.cards) {
      const card = sanitizeDeviceSavedCard(item);
      if (!card) continue;
      const key = `${card.brand}|${card.last4}|${card.expMonth ?? ""}|${card.expYear ?? ""}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(card);
    }
    return out.slice(0, 8);
  } catch {
    return [];
  }
}

export function serializeDeviceSavedCardList(cards: DeviceSavedCard[]): string {
  const clean = cards
    .map((c) => sanitizeDeviceSavedCard(c))
    .filter((c): c is DeviceSavedCard => Boolean(c))
    .slice(0, 8);
  return JSON.stringify({ cards: clean, updatedAt: Date.now() });
}

export function formatDeviceSavedCardLabel(card: DeviceSavedCard): string {
  const brand = card.brand === "unknown" ? "Card" : card.brand.replace(/^./, (c) => c.toUpperCase());
  const nick = card.nickname ? `${card.nickname} · ` : "";
  const exp =
    card.expMonth && card.expYear
      ? `  ${String(card.expMonth).padStart(2, "0")}/${String(card.expYear).slice(-2)}`
      : "";
  return `${nick}${brand} •••• ${card.last4}${exp}`;
}
