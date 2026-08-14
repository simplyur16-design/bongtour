/**
 * Confirmation-layout fingerprint + label keys.
 * REGRESSION-FREEZE[simplyur-trip-inbox-forms]: form fingerprint — manifest
 */
const LABEL_KEYS: Array<{ key: string; re: RegExp }> = [
  { key: "checkin", re: /check[- ]?in|체크인|チェックイン|入住/i },
  { key: "checkout", re: /check[- ]?out|체크아웃|チェックアウト|退房/i },
  { key: "booking", re: /booking\s*(id|number|ref)|confirmation|예약\s*(번호|ID|코드)|확인\s*코드|PNR/i },
  { key: "property", re: /hotel|property|listing|숙소|호텔명|시설명/i },
  { key: "address", re: /address|주소|住所/i },
  { key: "flight", re: /flight\s*(no|number)?|편명|항공편/i },
  { key: "ticket", re: /e-?ticket|ticket\s*number|항공권/i },
  { key: "passenger", re: /passenger|traveler|승객|탑승객/i },
  { key: "pickup", re: /pick[- ]?up|인수/i },
  { key: "dropoff", re: /drop[- ]?off|반납/i },
  { key: "pin", re: /pin\s*code/i },
];

export function collectFormLabelKeys(text: string): string[] {
  const keys: string[] = [];
  for (const { key, re } of LABEL_KEYS) {
    if (re.test(text)) keys.push(key);
  }
  return keys;
}

export function brandTokenFromText(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes("airbnb")) return "airbnb";
  if (lower.includes("booking.com")) return "booking_com";
  if (lower.includes("agoda")) return "agoda";
  if (lower.includes("rakuten")) return "rakuten";
  if (lower.includes("trip.com") || text.includes("트립닷컴")) return "trip_com";
  if (lower.includes("united")) return "united";
  if (lower.includes("expedia")) return "expedia";
  if (lower.includes("hotels.com")) return "hotels_com";
  if (lower.includes("klook")) return "klook";
  if (lower.includes("vrbo")) return "vrbo";
  const domain = text.match(/@([\w.-]+\.[a-z]{2,})/i)?.[1]?.toLowerCase();
  if (domain) return domain.replace(/^mail\./, "");
  const first = text
    .split(/\n/)
    .map((l) => l.trim())
    .find((l) => l.length > 3);
  if (first) return first.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40) || "unknown";
  return "unknown";
}

export function fingerprintTripForm(text: string): string {
  const labels = collectFormLabelKeys(text).sort().join("|");
  const brand = brandTokenFromText(text);
  return `${brand}::${labels}`;
}

export function formIdFromFingerprint(fingerprint: string): string {
  let h = 2166136261;
  for (let i = 0; i < fingerprint.length; i++) {
    h ^= fingerprint.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `form_${(h >>> 0).toString(16)}`;
}
