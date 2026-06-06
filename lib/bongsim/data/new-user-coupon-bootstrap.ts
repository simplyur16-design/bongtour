export type NewUserCouponBootstrapResult = {
  welcomeIssued: boolean;
  reason: "ok" | "no-pg" | "no-email" | "welcome-skip-existing" | "welcome-not-issued";
};

/**
 * 신규 User 생성 직후(이메일 가입 API 또는 OAuth 콜백).
 * 가입 환영 쿠폰은 2026-06부터 폐지 — 호출부는 유지하되 발급하지 않음.
 */
export async function runNewUserCouponBootstrap(_userId: string): Promise<NewUserCouponBootstrapResult> {
  return { welcomeIssued: false, reason: "ok" };
}
