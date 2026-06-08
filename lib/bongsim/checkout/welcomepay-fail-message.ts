import type { ProcessWelcomepayPaymentResult } from "@/lib/bongsim/data/process-welcomepay-payment-outcome";
import { normalizeWelcomepayPgUserMessage } from "@/lib/bongsim/welcomepay-pg-text-decode";
import { resolveWelcomepayEnv } from "@/lib/bongsim/welcomepay";

/** 모바일 `P_STATUS`·PC `resultCode` 등 PG 인증 실패 코드 → 고객용 문구 */
export function welcomepayPgAuthFailMessage(input: {
  resultCode: string;
  pgMessage?: string | null;
}): string {
  const rc = input.resultCode.trim();
  const pg = normalizeWelcomepayPgUserMessage((input.pgMessage ?? "").trim());
  const isTest = resolveWelcomepayEnv() !== "production";
  const codeHint = rc ? ` (오류코드 ${rc})` : "";

  if (rc === "01") {
    if (pg) return `${pg}${codeHint}`;
    if (isTest) {
      return (
        "결제가 거절되었습니다. 테스트 PG에서는 웰컴페이먼츠 안내 테스트 카드로만 결제할 수 있습니다."
      );
    }
    return (
      "결제창을 열기 전 웰컴페이먼츠에서 요청이 거절되었습니다(코드 01). " +
      "잠시 후 다시 시도해 주세요. 계속되면 고객센터로 문의해 주세요."
    );
  }

  if (pg) return `${pg}${codeHint}`;
  if (rc) return `결제 인증에 실패했습니다(오류코드 ${rc}).`;
  return "결제 인증에 실패했습니다.";
}

/** 인증 단계 성공 코드 — 모바일 `00`·PC `0000` 등 */
export function isWelcomepayAuthSuccessCode(code: string): boolean {
  const rc = code.trim();
  return rc === "0000" || rc === "00" || rc === "0";
}

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
