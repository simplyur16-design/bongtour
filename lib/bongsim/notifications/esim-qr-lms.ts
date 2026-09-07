import {
  buildAndroidQuickInstallUrl,
  buildAppleQuickInstallUrl,
} from "@/lib/bongsim/esim-install-presentation";
import {
  simplyurNotifyRequiresKakaoPhone,
  simplyurNotifyShouldSendSolapiSms,
} from "@/lib/simplyur/notify/simplyur-qr-notify-policy";

export type EsimQrLmsTextInput = {
  orderNumber: string;
  orderPageUrl: string;
  /** LPA:1$… — 있으면 iPhone·Android 원클릭 URL 본문 삽입 */
  downloadLink?: string | null;
};

/** LPA가 있으면 알림톡 성공과 무관하게 원클릭 LMS를 반드시 보냄 */
// REGRESSION-FREEZE[bongsim-esim-qr-os-install-lms-always]: LPA prefix — manifest
export function esimQrNotifyMustSendOsQuickInstallLms(
  downloadLink: string | null | undefined,
): boolean {
  return (downloadLink ?? "").trim().startsWith("LPA:");
}

/**
 * 봉투어(웰컴페이·무상) 원클릭 LMS — Bong투어 본문.
 * 심플리유어는 `shouldSendSimplyurEsimIssuedLms` (별도 본문).
 */
export function shouldSendBongtourEsimOsQuickInstallLms(
  checkoutChannel: string | null | undefined,
  downloadLink: string | null | undefined,
): boolean {
  return (
    simplyurNotifyRequiresKakaoPhone(checkoutChannel) &&
    esimQrNotifyMustSendOsQuickInstallLms(downloadLink)
  );
}

/** 심플리유어 발급 eSIM — 전화번호 있으면 솔라피 LMS 필수. */
// REGRESSION-FREEZE[simplyur-esim-solapi-sms]: simplyur + phone → LMS — manifest
export function shouldSendSimplyurEsimIssuedLms(
  checkoutChannel: string | null | undefined,
  customerPhone: string | null | undefined,
): boolean {
  return simplyurNotifyShouldSendSolapiSms(checkoutChannel) && Boolean((customerPhone ?? "").trim());
}

/**
 * simplyur 발급 LMS — 설치 URL + My eSIM (Bong투어 카피 금지).
 * REGRESSION-FREEZE[simplyur-esim-solapi-sms]: simplyur LMS body — manifest
 */
export function buildSimplyurEsimQrDeliveredLmsText(input: EsimQrLmsTextInput): string {
  const orderNumber = input.orderNumber.trim() || "—";
  const orderPageUrl = input.orderPageUrl.trim();
  const lpa = (input.downloadLink ?? "").trim();
  const appleUrl = lpa ? buildAppleQuickInstallUrl(lpa) : null;
  const androidUrl = lpa ? buildAndroidQuickInstallUrl(lpa) : null;

  const lines: string[] = [
    "[simplyur] Your Korea eSIM is ready",
    "",
    `Order: ${orderNumber}`,
  ];

  if (appleUrl) {
    lines.push("", "iPhone install", appleUrl);
  }
  if (androidUrl) {
    lines.push("", "Android install", androidUrl);
  }
  if (orderPageUrl) {
    lines.push("", "My eSIM", orderPageUrl);
  }

  lines.push(
    "",
    "Install before you need data. The plan starts when the eSIM first connects in Korea.",
  );
  return lines.join("\n");
}

/**
 * eSIM QR LMS 본문 — 주문 페이지 + (가능 시) iPhone/Galaxy 바로 설치 URL.
 * REGRESSION-FREEZE[bongsim-esim-lms-quick-install]: LMS에 원클릭 설치 URL — manifest
 * REGRESSION-FREEZE[bongsim-esim-qr-os-install-lms-always]: LPA면 원클릭 LMS 필수 — manifest
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
    "",
    "① 아래 링크로 설치 (초보 OK)",
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

  lines.push(
    "",
    "② 꼭 지켜주세요",
    "- 해외: 국내유심 데이터로밍 OFF → 데이터는 eSIM만",
    "- QR·코드는 1회성 (삭제 후 재설치 어려움)",
    "- 상세 단계: bongtour.com/travel/esim/guide",
    "",
    "문의: 카카오 09:00-18:00 · bongtour.com",
  );
  return lines.join("\n");
}
