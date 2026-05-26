import { normalizeBuyerPhone, isValidBuyerPhoneInput } from "@/lib/bongsim/phone/normalize-buyer-phone";

export type BongsimGiftOrderConsents = {
  is_gift: boolean;
  recipient_email?: string;
  recipient_phone?: string;
  recipient_name?: string | null;
};

export type EsimDeliveryContact = {
  email: string;
  phone: string | null;
  is_gift: boolean;
};

function normEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function parseGiftFromOrderConsents(consents: unknown): BongsimGiftOrderConsents {
  if (!consents || typeof consents !== "object" || Array.isArray(consents)) {
    return { is_gift: false };
  }
  const g = (consents as Record<string, unknown>).gift;
  if (!g || typeof g !== "object" || Array.isArray(g)) return { is_gift: false };
  const o = g as Record<string, unknown>;
  if (o.is_gift !== true) return { is_gift: false };
  return {
    is_gift: true,
    recipient_email:
      typeof o.recipient_email === "string" && o.recipient_email.trim()
        ? normEmail(o.recipient_email)
        : undefined,
    recipient_phone:
      typeof o.recipient_phone === "string" && o.recipient_phone.trim()
        ? normalizeBuyerPhone(o.recipient_phone) ?? undefined
        : undefined,
    recipient_name:
      typeof o.recipient_name === "string" && o.recipient_name.trim()
        ? o.recipient_name.trim()
        : null,
  };
}

export function parseGiftFromCheckoutBody(consents: unknown): BongsimGiftOrderConsents {
  if (!consents || typeof consents !== "object" || Array.isArray(consents)) {
    return { is_gift: false };
  }
  return parseGiftFromOrderConsents(consents);
}

/** 체크아웃 confirm 요청의 `consents.gift` 검증 */
export function validateGiftConsents(gift: BongsimGiftOrderConsents): Record<string, string> {
  const details: Record<string, string> = {};
  if (!gift.is_gift) return details;

  const em = (gift.recipient_email ?? "").trim();
  const phRaw = (gift.recipient_phone ?? "").trim();

  if (!em && !phRaw) {
    details.gift_recipient_contact = "required_one";
    return details;
  }

  if (em && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
    details.gift_recipient_email = "invalid_email";
  }

  if (phRaw && !isValidBuyerPhoneInput(phRaw)) {
    details.gift_recipient_phone = "invalid_phone";
  }

  return details;
}

export function buildGiftConsentsJson(gift: BongsimGiftOrderConsents): Record<string, unknown> | undefined {
  if (!gift.is_gift) return undefined;
  const emailRaw = (gift.recipient_email ?? "").trim();
  const phoneNorm = normalizeBuyerPhone(gift.recipient_phone ?? "");
  return {
    is_gift: true,
    recipient_email: emailRaw ? normEmail(emailRaw) : null,
    recipient_phone: phoneNorm ?? null,
    recipient_name: gift.recipient_name ?? null,
  };
}

/** eSIM QR·알림톡·메일 수신자 (선물 주문이면 받는 분) */
export function resolveEsimDeliveryContact(row: {
  buyer_email: string;
  buyer_tel: string | null;
  consents: unknown;
}): EsimDeliveryContact {
  const gift = parseGiftFromOrderConsents(row.consents);
  if (gift.is_gift) {
    const email = gift.recipient_email ?? "";
    const phone = gift.recipient_phone ?? null;
    if (email || phone) {
      return {
        email,
        phone,
        is_gift: true,
      };
    }
  }
  const phone = normalizeBuyerPhone(row.buyer_tel ?? "") ?? null;
  return {
    email: normEmail(row.buyer_email),
    phone,
    is_gift: false,
  };
}
