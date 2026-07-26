import { bongsimPath } from "@/lib/bongsim/constants";
import type { BongsimOrderPublicEsimInstallV1 } from "@/lib/bongsim/contracts/order-public.v1";
import { isBongsimOrderEsimRevoked } from "@/lib/bongsim/fulfillment/active-topup-status";
import { absoluteUrl } from "@/lib/site-metadata";

const APPLE_ESIM_QR_PROVISIONING_BASE =
  "https://esimsetup.apple.com/esim_qrcode_provisioning?carddata=";

/** iPhone 「바로 설치」 — `carddata`에 LPA 전체를 URL 인코딩 */
export function buildAppleQuickInstallUrl(lpa: string): string | null {
  const code = lpa.trim();
  if (!code.startsWith("LPA:")) return null;
  return `${APPLE_ESIM_QR_PROVISIONING_BASE}${encodeURIComponent(code)}`;
}

export function buildBongsimOrderCompleteUrl(orderId: string): string {
  const id = orderId.trim();
  const base = absoluteUrl(bongsimPath(`/order/${id}/complete`));
  const readKey = process.env.BONGSIM_ORDER_READ_KEY?.trim();
  if (!readKey) return base;
  try {
    const u = new URL(base);
    u.searchParams.set("read_key", readKey);
    return u.toString();
  } catch {
    const sep = base.includes("?") ? "&" : "?";
    return `${base}${sep}read_key=${encodeURIComponent(readKey)}`;
  }
}

export function buildEsimInstallFromTopup(params: {
  orderStatus: string;
  qr_code_img_url: string | null;
  download_link: string | null;
  smdp: string | null;
  activate_code: string | null;
  topup_row_id?: string | null;
  unit_index?: number | null;
  unit_total?: number | null;
}): BongsimOrderPublicEsimInstallV1 {
  const revoked = isBongsimOrderEsimRevoked(params.orderStatus);
  if (revoked) {
    return {
      ready: false,
      revoked: true,
      unit_index: params.unit_index ?? null,
      unit_total: params.unit_total ?? null,
      topup_row_id: params.topup_row_id ?? null,
      qr_image_url: null,
      sm_dp_plus_address: null,
      activation_code: null,
      apple_quick_install_url: null,
    };
  }

  const qr = params.qr_code_img_url?.trim() || null;
  const downloadLink = params.download_link?.trim() || null;
  const smDpPlusAddress = params.smdp?.trim() || null;
  const activationCode = params.activate_code?.trim() || null;
  const hasQr = Boolean(qr);
  const hasManualFields = Boolean(smDpPlusAddress || activationCode);
  const hasDownloadLink = Boolean(downloadLink);
  const ready =
    params.orderStatus === "delivered" && (hasQr || hasManualFields || hasDownloadLink);

  return {
    ready,
    unit_index: params.unit_index ?? null,
    unit_total: params.unit_total ?? null,
    topup_row_id: params.topup_row_id ?? null,
    qr_image_url: qr,
    sm_dp_plus_address: smDpPlusAddress,
    activation_code: activationCode,
    apple_quick_install_url: downloadLink ? buildAppleQuickInstallUrl(downloadLink) : null,
  };
}

/** 알림톡·메일 주문번호 표기 — qty>1 이면 (k/N) */
export function formatEsimNotifyOrderLabel(
  orderNumber: string,
  unitIndex?: number | null,
  unitTotal?: number | null,
): string {
  const base = orderNumber.trim() || "—";
  if (unitTotal != null && unitTotal > 1 && unitIndex != null && unitIndex > 0) {
    return `${base} (${unitIndex}/${unitTotal})`;
  }
  return base;
}
