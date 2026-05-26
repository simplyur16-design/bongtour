/** 고객·관리자 환불 API 오류 → 화면 문구 */
export function refundErrorMessage(payload: {
  error?: string;
  message?: string;
}): string {
  const err = (payload.error ?? "").trim();
  const msg = (payload.message ?? "").trim();

  if (err === "welcomepay_env_incomplete") {
    return "결제 취소(PG) 설정이 서버에 없습니다. 운영 환경에 WELCOMEPAY_MID, WELCOMEPAY_SIGN_KEY를 등록해 주세요.";
  }
  if (err === "login_required") return "로그인한 뒤, 주문 시 사용한 이메일 계정으로 취소해 주세요.";
  if (err === "forbidden") return "주문 이메일과 로그인 이메일이 일치해야 취소할 수 있어요.";
  if (err === "esim_activated_no_refund") {
    return msg || "eSIM이 이미 발급되어 자동 취소할 수 없습니다. 고객센터로 문의해 주세요.";
  }
  if (err === "refund_in_progress") {
    return msg || "환불이 처리 중입니다. 잠시 후 새로고침해 주세요.";
  }
  if (err === "supplier_refund_failed") {
    return msg || "공급사 취소에 실패했습니다. 잠시 후 다시 시도하거나 고객센터로 문의해 주세요.";
  }
  if (err === "pg_cancel_failed") {
    if (/SIGNATURE|서명|signkey|sign\s*key/i.test(msg)) {
      return "PG 취소 서명이 맞지 않습니다. WELCOMEPAY_SIGN_KEY(웹결제 signKey)를 가맹점 관리자에서 다시 확인해 주세요.";
    }
    if (msg) return msg;
    return "카드사 취소 요청이 거절되었습니다. 잠시 후 다시 시도하거나 고객센터로 문의해 주세요.";
  }
  if (err === "missing_payment_reference") {
    return "승인 거래번호(TID)를 찾을 수 없어 PG 취소를 할 수 없습니다. 고객센터로 문의해 주세요.";
  }
  if (err === "db_unconfigured") return "주문 서버(DB)가 연결되지 않았습니다.";
  if (msg) return msg;
  if (err) return err;
  return "취소에 실패했어요.";
}
