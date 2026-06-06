import { resolveWelcomepayEnv } from "@/lib/bongsim/welcomepay";

/** 모바일 `P_STATUS`·PC `resultCode` 등 PG 인증 실패 코드 → 고객용 문구 */
export function welcomepayPgAuthFailMessage(input: {
  resultCode: string;
  pgMessage?: string | null;
}): string {
  const rc = input.resultCode.trim();
  const pg = (input.pgMessage ?? "").trim();
  const isTest = resolveWelcomepayEnv() !== "production";

  if (rc === "01") {
    if (pg) return pg;
    if (isTest) {
      return (
        "결제가 거절되었습니다. 테스트 PG에서는 웰컴페이먼츠 안내 테스트 카드로만 결제할 수 있습니다."
      );
    }
    return (
      "결제창을 열기 전 PG에서 요청이 거절되었습니다. " +
      "잠시 후 다시 시도해 주세요. 계속되면 고객센터로 문의해 주세요."
    );
  }

  if (pg) return pg;
  if (rc) return `결제 인증에 실패했습니다(resultCode=${rc}).`;
  return "결제 인증에 실패했습니다.";
}

/** 인증 단계 성공 코드 — 모바일 `00`·PC `0000` 등 */
export function isWelcomepayAuthSuccessCode(code: string): boolean {
  const rc = code.trim();
  return rc === "0000" || rc === "00" || rc === "0";
}
