/** USIMSA Partner API secret resolution (no `server-only` — safe for tsx scripts). */

export type UsimsaRuntimeEnv = "development" | "production";

export type UsimsaSecretKeyResolution = {
  secretKey: string;
  /** `USIMSA_SECRET_KEY` 단일 값이면 legacy, 환경별 변수면 env_split */
  source: "legacy_single" | "env_split";
  /** 실제로 읽은 환경변수 이름(값 노출 없음) */
  envVar: "USIMSA_SECRET_KEY" | "USIMSA_DEV_SECRET_KEY" | "USIMSA_PROD_SECRET_KEY";
};

function trimOrEmpty(value: string | undefined): string {
  return (value ?? "").trim();
}

/**
 * SSOT: `USIMSA_SECRET_KEY` (주문·취소·조회 공통).
 * - 값이 있으면 **환경 무관** 우선 — `USIMSA_PROD_SECRET_KEY`는 무시.
 * - 비어 있을 때만 `USIMSA_ENV`에 따라 `USIMSA_PROD_SECRET_KEY` / `USIMSA_DEV_SECRET_KEY`.
 */
export function resolveSecretKey(runtimeEnv: UsimsaRuntimeEnv): UsimsaSecretKeyResolution {
  const legacy = trimOrEmpty(process.env.USIMSA_SECRET_KEY);
  if (legacy) {
    return { secretKey: legacy, source: "legacy_single", envVar: "USIMSA_SECRET_KEY" };
  }
  if (runtimeEnv === "production") {
    const k = trimOrEmpty(process.env.USIMSA_PROD_SECRET_KEY);
    if (!k) {
      throw new Error(
        "Usimsa: USIMSA_PROD_SECRET_KEY is missing (or set USIMSA_SECRET_KEY for legacy single secret). Add it in the server environment (e.g. Railway / .env.local).",
      );
    }
    return { secretKey: k, source: "env_split", envVar: "USIMSA_PROD_SECRET_KEY" };
  }
  const k = trimOrEmpty(process.env.USIMSA_DEV_SECRET_KEY);
  if (!k) {
    throw new Error(
      "Usimsa: USIMSA_DEV_SECRET_KEY is missing (or set USIMSA_SECRET_KEY for legacy single secret). Add it in the server environment (e.g. Railway / .env.local).",
    );
  }
  return { secretKey: k, source: "env_split", envVar: "USIMSA_DEV_SECRET_KEY" };
}
