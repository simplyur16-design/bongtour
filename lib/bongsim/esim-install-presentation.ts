import { bongsimPath } from "@/lib/bongsim/constants";
import type { BongsimOrderPublicEsimInstallV1 } from "@/lib/bongsim/contracts/order-public.v1";
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
}): BongsimOrderPublicEsimInstallV1 {
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
    qr_image_url: qr,
    sm_dp_plus_address: smDpPlusAddress,
    activation_code: activationCode,
    apple_quick_install_url: downloadLink ? buildAppleQuickInstallUrl(downloadLink) : null,
  };
}
