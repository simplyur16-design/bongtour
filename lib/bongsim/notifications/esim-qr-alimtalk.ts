import { SolapiMessageService } from "solapi";

export type EsimQrAlimtalkPayload = {
  customerPhone: string;
  orderNumber: string;
  /** 카카오 템플릿 변수 `installLink` — eSIM 설치/다운로드 URL */
  installLink: string;
  /** 카카오 템플릿 변수 `qrLink` — QR 이미지 URL (선택) */
  qrLink?: string;
};

export type EsimQrAlimtalkResult =
  | { ok: true }
  | { ok: false; shouldSendLmsFallback: true; detail: string };

/**
 * eSIM QR·설치 안내 카카오 알림톡.
 * 템플릿: `SOLAPI_TPL_ESIM_QR_DELIVERED` (변수: orderNumber, installLink, qrLink)
 * @see docs/ops/OPS-SOLAPI-ESIM-ALIMTALK.md
 */
export async function sendEsimQrDeliveredAlimTalk(
  orderId: string,
  payload: EsimQrAlimtalkPayload,
): Promise<EsimQrAlimtalkResult> {
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

  const variables: Record<string, string> = {
    orderNumber: payload.orderNumber.trim() || "—",
    installLink: payload.installLink.trim(),
    qrLink: (payload.qrLink ?? payload.installLink).trim(),
  };

  if (!variables.installLink) {
    return { ok: false, shouldSendLmsFallback: true, detail: "esim_qr_missing_install_link" };
  }

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
      },
    });
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[solapi-alimtalk] esim_qr_send_failed", JSON.stringify({ orderId, error: msg }));
    return { ok: false, shouldSendLmsFallback: true, detail: "esim_qr_send_error" };
  }
}
