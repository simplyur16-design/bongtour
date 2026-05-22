import { formatKoreanTelInput } from "@/lib/korean-tel-format";

/** 국내 휴대폰 — 숫자만 10~11자리 (010…) */
export function normalizeBuyerPhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 11) return null;
  if (!digits.startsWith("01")) return null;
  return digits;
}

export function isValidBuyerPhoneInput(raw: string): boolean {
  return normalizeBuyerPhone(raw) != null;
}

/** 주문창·마이페이지 표시용 `010-0000-0000` */
export function formatBuyerPhoneDisplay(raw: string): string {
  const digits = normalizeBuyerPhone(raw);
  if (digits) return formatKoreanTelInput(digits);
  return formatKoreanTelInput(raw);
}
