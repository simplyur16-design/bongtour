import { SolapiMessageService } from "solapi";

export type RefundDoneAlimtalkPayload = {
  customerPhone: string;
  orderNumber: string;
  /** 천 단위 콤마 (예: 2,200) */
  refundAmount: string;
};

export type RefundDoneAlimtalkResult = { ok: true } | { ok: false; detail: string };

/**
 * 환불 완료 카카오 알림톡.
 * 템플릿: `SOLAPI_TPL_REFUND_DONE` (변수: orderNumber, refundAmount)
 */
export async function sendRefundDoneAlimTalk(
  orderId: string,
  payload: RefundDoneAlimtalkPayload,
): Promise<RefundDoneAlimtalkResult> {
  const apiKey = process.env.SOLAPI_API_KEY?.trim();
  const apiSecret = process.env.SOLAPI_API_SECRET?.trim();
  const pfId = (process.env.SOLAPI_KAKAO_PFID?.trim() || process.env.SOLAPI_PFID?.trim()) ?? "";
  const senderRaw = process.env.SOLAPI_FROM_PHONE?.trim();
  const templateId = process.env.SOLAPI_TPL_REFUND_DONE?.trim();

  if (!apiKey || !apiSecret || !pfId || !senderRaw) {
    console.error(
      "[solapi-alimtalk] refund_done_skipped_env",
      JSON.stringify({ orderId, hasKey: Boolean(apiKey), hasPfId: Boolean(pfId) }),
    );
    return { ok: false, detail: "refund_done_missing_env" };
  }

  if (!templateId) {
    console.error("[solapi-alimtalk] refund_done_missing_template", JSON.stringify({ orderId }));
    return { ok: false, detail: "refund_done_missing_template_env" };
  }

  const to = payload.customerPhone.replace(/\D/g, "");
  if (to.length < 10) {
    return { ok: false, detail: "refund_done_invalid_phone" };
  }

  const from = senderRaw.replace(/\D/g, "");
  if (!from) {
    return { ok: false, detail: "refund_done_invalid_sender" };
  }

  const variables: Record<string, string> = {
    orderNumber: payload.orderNumber.trim() || "—",
    refundAmount: payload.refundAmount.trim() || "0",
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
      },
    });
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[solapi-alimtalk] refund_done_send_failed", JSON.stringify({ orderId, error: msg }));
    return { ok: false, detail: "refund_done_send_error" };
  }
}
