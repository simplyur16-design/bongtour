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
}): BongsimOrderPublicEsimInstallV1 {
  const qr = params.qr_code_img_url?.trim() || null;
  const manual = params.download_link?.trim() || null;
  const hasQr = Boolean(qr);
  const hasManual = Boolean(manual);
  const ready = params.orderStatus === "delivered" && (hasQr || hasManual);

  return {
    ready,
    qr_image_url: qr,
    manual_install_code: manual,
    apple_quick_install_url: manual ? buildAppleQuickInstallUrl(manual) : null,
  };
}
