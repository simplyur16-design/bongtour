import type { Pool } from "pg";
import {
  classifyBongsimPgError,
  getPgPool,
  healBongsimPgPoolForCatalog,
  resetBongsimPgPoolAfterConnectTimeout,
  type BongsimPgFailureKind,
} from "@/lib/bongsim/db/pool";

/** REGRESSION-FREEZE[bongsim-admin-payments-query]: admin DB heal·1회 재시도 — manifest */
export async function withBongsimAdminPgRetry<T>(run: (pool: Pool) => Promise<T>): Promise<T> {
  // probe는 instrumentation 기동 시 1회. 요청 경로 SELECT 1 금지.
  const pool = getPgPool();
  if (!pool) {
    throw Object.assign(new Error("db_unconfigured"), { code: "db_unconfigured" });
  }
  try {
    return await run(pool);
  } catch (first) {
    await healBongsimPgPoolForCatalog(
      first instanceof Error ? first.message : "admin-pg-retry",
    );
    const pool2 = getPgPool();
    if (!pool2) throw first;
    try {
      return await run(pool2);
    } catch (second) {
      await resetBongsimPgPoolAfterConnectTimeout(second);
      throw second;
    }
  }
}

export function bongsimAdminQueryFailurePayload(err: unknown): {
  status: number;
  body: { error: string; message: string; kind?: BongsimPgFailureKind };
} {
  const code =
    typeof err === "object" && err !== null && "code" in err
      ? String((err as { code?: string }).code ?? "")
      : "";
  if (code === "db_unconfigured" || String(err instanceof Error ? err.message : err) === "db_unconfigured") {
    return {
      status: 503,
      body: {
        error: "db_unconfigured",
        message: "DB가 연결되어 있지 않습니다.",
      },
    };
  }
  const kind = classifyBongsimPgError(err);
  if (kind === "connection_timeout") {
    return {
      status: 503,
      body: {
        error: "connection_timeout",
        kind,
        message: "DB 연결이 지연되었습니다. 잠시 후 새로고침해 주세요.",
      },
    };
  }
  return {
    status: 500,
    body: {
      error: "query_failed",
      kind,
      message: "주문·발급 내역 조회에 실패했습니다. 새로고침 후에도 반복되면 서버 로그를 확인해 주세요.",
    },
  };
}
