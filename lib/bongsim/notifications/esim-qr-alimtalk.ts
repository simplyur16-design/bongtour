import { SolapiMessageService } from "solapi";

export type EsimQrAlimtalkPayload = {
  customerPhone: string;
  orderNumber: string;
  /** 주문 완료 페이지 절대 URL */
  orderPageUrl: string;
};

/** 카카오 템플릿 `https://bongtour.com#{installPath}` — path+query(+hash)만 */
function orderPageInstallPath(orderPageUrl: string): string {
  const raw = orderPageUrl.trim();
  if (!raw) return "";
  try {
    const u = new URL(raw);
    const path = `${u.pathname}${u.search}${u.hash}`;
    return path || raw;
  } catch {
    return raw.startsWith("/") ? raw : `/${raw}`;
  }
}

export type EsimQrAlimtalkResult =
  | { ok: true }
  | { ok: false; shouldSendLmsFallback: true; detail: string };

/**
 * eSIM QR·설치 안내 카카오 알림톡.
 * 동적 QR 이미지는 불가 → 주문 페이지에서 QR 렌더 유도.
 * 템플릿: `SOLAPI_TPL_ESIM_QR_DELIVERED` (변수: orderNumber, installPath — 승인본 기준)
 * 승인 SSOT ID: `KA01TP260529080045939hjuDabvEjcg` (`scripts/verify-solapi-esim-qr-template.ts`)
 * @see docs/ops/OPS-SOLAPI-ESIM-ALIMTALK.md
 */
export async function sendEsimQrDeliveredAlimTalk(
  orderId: string,
  payload: EsimQrAlimtalkPayload,
): Promise<EsimQrAlimtalkResult> {
  // REGRESSION-FREEZE[bongsim-esim-qr-alimtalk-install-path]: variables orderNumber+installPath only — manifest
  const apiKey = process.env.SOLAPI_API_KEY?.trim();
  const apiSecret = process.env.SOLAPI_API_SECRET?.trim();
  const pfId = (process.env.SOLAPI_KAKAO_PFID?.trim() || process.env.SOLAPI_PFID?.trim()) ?? "";
  const senderRaw = process.env.SOLAPI_FROM_PHONE?.trim();
  const templateId = process.env.SOLAPI_TPL_ESIM_QR_DELIVERED?.trim();

  if (!apiKey || !apiSecret || !pfId || !senderRaw) {
    console.error(
      "[solapi-alimtalk] esim_qr_skipped_env",
      JSON.stringify({ orderId, hasKey: Boolean(apiKey), hasPfId: Boolean(pfId) }),
    );
    return { ok: false, shouldSendLmsFallback: true, detail: "esim_qr_missing_env" };
  }

  if (!templateId) {
    console.error("[solapi-alimtalk] esim_qr_missing_template", JSON.stringify({ orderId }));
    return { ok: false, shouldSendLmsFallback: true, detail: "esim_qr_missing_template_env" };
  }

  const to = payload.customerPhone.replace(/\D/g, "");
  if (to.length < 10) {
    return { ok: false, shouldSendLmsFallback: true, detail: "esim_qr_invalid_phone" };
  }

  const from = senderRaw.replace(/\D/g, "");
  if (!from) {
    return { ok: false, shouldSendLmsFallback: true, detail: "esim_qr_invalid_sender" };
  }

  const orderPageUrl = payload.orderPageUrl.trim();
  if (!orderPageUrl) {
    return { ok: false, shouldSendLmsFallback: true, detail: "esim_qr_missing_order_page_url" };
  }

  const installPath = orderPageInstallPath(orderPageUrl);
  if (!installPath) {
    return { ok: false, shouldSendLmsFallback: true, detail: "esim_qr_missing_install_path" };
  }

  const variables: Record<string, string> = {
    orderNumber: payload.orderNumber.trim() || "—",
    installPath,
  };

  try {
    const svc = new SolapiMessageService(apiKey, apiSecret);
    await svc.send({
      to,
      from,
      type: "ATA",
      kakaoOptions: {
        pfId,
        templateId,
        variables,
        /** 솔라피 자동 문자 방지 — LMS는 앱에서 원클릭 URL 포함해 병행 발송 (`sendEsimQrDeliveredLmsFallback`) */
        disableSms: true,
      },
    });
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[solapi-alimtalk] esim_qr_send_failed", JSON.stringify({ orderId, error: msg }));
    return { ok: false, shouldSendLmsFallback: true, detail: "esim_qr_send_error" };
  }
}
