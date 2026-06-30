/** 체크아웃 confirm API 오류 → 주문창 표시 문구 */
export function checkoutConfirmErrorMessage(payload: {
  error?: string;
  details?: Record<string, string>;
}): string {
  const err = (payload.error ?? "").trim();
  const d = payload.details ?? {};

  if (err === "validation") {
    if (d.buyer_phone === "required" || d.buyer_phone === "invalid_phone") {
      return "휴대폰 번호를 010-0000-0000 형식으로 입력해 주세요. (필수)";
    }
    if (d.buyer_email === "required" || d.buyer_email === "invalid_email") {
      return "이메일을 확인해 주세요.";
    }
    if (d.gift_recipient_contact === "required_one") {
      return "받는 분 휴대폰 또는 이메일 중 하나는 입력해 주세요.";
    }
    if (d.gift_recipient_email) return "받는 분 이메일을 확인해 주세요.";
    if (d.gift_recipient_phone) return "받는 분 휴대폰 번호를 010-0000-0000 형식으로 입력해 주세요.";
    if (d.option_api_id === "required") return "상품을 다시 선택해 주세요.";
    if (d.fulfillment_mode === "usim_not_available_online") {
      return "물리 USIM 활성화는 매장에서만 가능합니다. 온라인 주문은 eSIM으로 진행해 주세요.";
    }
    if (d.coupon) return "쿠폰 적용을 확인해 주세요.";
    return "입력값을 확인해 주세요.";
  }

  if (err === "product_not_found") return "상품 정보를 찾을 수 없습니다. eSIM 메인에서 다시 선택해 주세요.";
  if (err === "idempotency_mismatch") return "이전 주문 정보와 달라 새로 주문할 수 없습니다. 페이지를 새로고침해 주세요.";
  if (err === "db_unconfigured") return "주문 서버(DB)가 연결되지 않았습니다. 잠시 후 다시 시도해 주세요.";
  if (err === "db_error") {
    return "주문 저장 중 서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.";
  }
  if (err === "internal_error" || err === "internal_meta_leak_blocked") {
    return "서버 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.";
  }

  return "주문 생성에 실패했습니다.";
}
