import type { ProcessWelcomepayPaymentResult } from "@/lib/bongsim/data/process-welcomepay-payment-outcome";

/** 결제 결과 페이지 `message` 쿼리용 — PG·내부 reason을 고객용 문구로 매핑 */
export function welcomepayCheckoutFailMessage(
  fin: Extract<ProcessWelcomepayPaymentResult, { ok: false }>,
): string {
  if (fin.devDetail && process.env.NODE_ENV === "development") {
    return `${fin.reason}: ${fin.devDetail}`;
  }
  switch (fin.reason) {
    case "db_unconfigured":
      return "결제 서버 DB가 설정되지 않았습니다. DATABASE_URL을 확인해 주세요.";
    case "db_error":
      return "결제 승인 후 주문 저장에 실패했습니다. 잠시 후 다시 시도하거나 고객센터로 문의해 주세요.";
    case "amount_mismatch":
      return "결제 금액이 주문과 일치하지 않습니다.";
    case "not_payable":
      return "이미 처리된 주문이거나 결제할 수 없는 상태입니다.";
    case "unknown_attempt":
      return "결제 시도 정보를 찾을 수 없습니다.";
    default:
      return fin.reason;
  }
}
