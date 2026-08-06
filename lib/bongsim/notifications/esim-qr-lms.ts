import {
  buildAndroidQuickInstallUrl,
  buildAppleQuickInstallUrl,
} from "@/lib/bongsim/esim-install-presentation";

export type EsimQrLmsTextInput = {
  orderNumber: string;
  orderPageUrl: string;
  /** LPA:1$… — 있으면 iPhone·Android 원클릭 URL 본문 삽입 */
  downloadLink?: string | null;
};

/**
 * eSIM QR LMS 본문 — 주문 페이지 + (가능 시) iPhone/Galaxy 바로 설치 URL.
 * REGRESSION-FREEZE[bongsim-esim-lms-quick-install]: LMS에 원클릭 설치 URL — manifest
 */
export function buildEsimQrDeliveredLmsText(input: EsimQrLmsTextInput): string {
  const orderNumber = input.orderNumber.trim() || "—";
  const orderPageUrl = input.orderPageUrl.trim();
  const lpa = (input.downloadLink ?? "").trim();
  const appleUrl = lpa ? buildAppleQuickInstallUrl(lpa) : null;
  const androidUrl = lpa ? buildAndroidQuickInstallUrl(lpa) : null;

  const lines: string[] = [
    "[Bong투어] eSIM 설치 안내",
    "",
    `주문번호: ${orderNumber}`,
  ];

  if (appleUrl) {
    lines.push("", "iPhone 바로 설치", appleUrl);
  }
  if (androidUrl) {
    lines.push("", "Galaxy·Android 바로 설치", androidUrl);
  }

  if (orderPageUrl) {
    lines.push("", "QR·설치코드 페이지", orderPageUrl);
  }

  lines.push("", "문의: bongtour.com");
  return lines.join("\n");
}
