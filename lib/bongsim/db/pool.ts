import { Pool, type PoolConfig } from "pg";
import {
  isTransactionPoolerUrl,
  rewriteSupabaseSessionPoolerToTransaction,
} from "@/lib/supabase-pooler-url";

/**
 * Next.js instrumentation·라우트 번들이 모듈 인스턴스를 따로 가져도
 * 풀·TLS 완화 플래그는 프로세스 전역으로 공유해야 한다.
 * (모듈 `let` 이면 probe가 완화해도 라우트 쪽은 strict로 풀을 다시 만들어 카탈로그가 전부 db_error)
 */
// REGRESSION-FREEZE[bongsim-pg-tls-global]: pool+TLS flag on globalThis — manifest
type GlobalWithBongsimPool = typeof globalThis & {
  __bongsimPool?: Pool;
  /** false = 인증서 검증 완화 확정. undefined/true = strict 시도 */
  __bongsimSslRejectUnauthorized?: boolean;
};

function getCachedPool(): Pool | undefined {
  return (globalThis as GlobalWithBongsimPool).__bongsimPool;
}

function setCachedPool(p: Pool | undefined): void {
  if (p === undefined) {
    delete (globalThis as GlobalWithBongsimPool).__bongsimPool;
  } else {
    (globalThis as GlobalWithBongsimPool).__bongsimPool = p;
  }
}

function isSupabasePoolerConnectionString(urlStr: string): boolean {
  try {
    const host = new URL(urlStr).hostname.toLowerCase();
    return host.includes("pooler.supabase.com") || host.includes("pooler.supabase.co");
  } catch {
    return /pooler\.supabase\.(com|co)/i.test(urlStr);
  }
}

/**
 * Supabase pooler는 체인에 self-signed가 있어 strict TLS가 항상 실패한다.
 * 첫 접근 시 URL 보고 기본값을 정하고 globalThis에 고정한다.
 */
function getSslRejectUnauthorized(): boolean {
  const g = globalThis as GlobalWithBongsimPool;
  if (typeof g.__bongsimSslRejectUnauthorized === "boolean") {
    return g.__bongsimSslRejectUnauthorized;
  }
  const raw = process.env.DATABASE_URL?.trim() ?? "";
  // pooler → 처음부터 relaxed (probe 전 cold request도 카탈로그 살림)
  const strict = raw ? !isSupabasePoolerConnectionString(raw) : true;
  g.__bongsimSslRejectUnauthorized = strict;
  return strict;
}

function setSslRejectUnauthorized(next: boolean): void {
  (globalThis as GlobalWithBongsimPool).__bongsimSslRejectUnauthorized = next;
}

export function isBongsimPgTlsHandshakeIssue(err: unknown): boolean {
  const msg = String(err instanceof Error ? err.message : err);
  const code =
    typeof err === "object" && err !== null && "code" in err
      ? String((err as { code?: string }).code ?? "")
      : "";
  return (
    /certificate|Certification|SSL|TLS|UNABLE_TO_VERIFY|SELF_SIGNED|wrong version number|ssl/i.test(msg) ||
    code === "DEPTH_ZERO_SELF_SIGNED_CERT" ||
    code === "UNABLE_TO_VERIFY_LEAF_SIGNATURE" ||
    code === "SELF_SIGNED_CERT_IN_CHAIN"
  );
}

/**
 * Supabase 세션 풀은 pool_size 15. Prisma(`connection_limit`)와 이 풀이 한 인스턴스에서
 * 15를 다 쓰면 배포 중 구 인스턴스·`prisma migrate deploy` 가 EMAXCONNSESSION 으로 죽는다.
 */
const BONGSIM_POOL_MAX_DEFAULT = 4;

export function resolveBongsimPoolMax(): number {
  const raw = process.env.BONGSIM_PG_POOL_MAX?.trim();
  if (raw) {
    const n = Number.parseInt(raw, 10);
    if (Number.isFinite(n) && n >= 1 && n <= 20) return n;
  }
  return BONGSIM_POOL_MAX_DEFAULT;
}

function buildPoolConfig(): PoolConfig | null {
  let url = process.env.DATABASE_URL?.trim();
  if (!url) return null;

  // sslmode를 URL에서 제거 (pg-connection-string이 ssl 설정을 덮어쓰는 것 방지)
  url = url.replace(/[?&]sslmode=[^&]*/gi, "").replace(/\?$/, "");

  url = rewriteSupabaseSessionPoolerToTransaction(url);

  const useTxnPooler = isTransactionPoolerUrl(url);
  const sslStrict = getSslRejectUnauthorized();

  const cfg: PoolConfig & { prepareThreshold?: number } = {
    connectionString: url,
    max: resolveBongsimPoolMax(),
    idleTimeoutMillis: 10_000,
    // 연결 고갈 시 무한 대기 → eSIM by-country「상품 조회 중…」무한 로딩 방지
    connectionTimeoutMillis: 6_000,
    ssl: sslStrict ? { rejectUnauthorized: true } : { rejectUnauthorized: false },
  };

  // PgBouncer transaction pooling: 풀러가 prepared statement를 유지하기 어려울 때 대비(자동 prepare 비활성화)
  if (useTxnPooler) {
    cfg.prepareThreshold = 0;
  }

  return cfg;
}

export function getPgPool(): Pool | null {
  const existing = getCachedPool();
  if (existing) return existing;

  const cfg = buildPoolConfig();
  if (!cfg) return null;

  const next = new Pool(cfg);
  setCachedPool(next);
  return next;
}

async function rebuildPoolWithRelaxedTls(): Promise<Pool | null> {
  setSslRejectUnauthorized(false);
  await closePgPool().catch(() => {});
  return getPgPool();
}

/**
 * Supabase 등: 우선 인증서 검증 ON. 체인 문제 등으로 실패 시 한 번만 검증 완화 후 재시도.
 * instrumentation 등 서버 기동 시 호출 권장.
 */
export async function probePgPoolTlsOrFallback(): Promise<{ ok: boolean; sslStrict: boolean }> {
  const pool = getPgPool();
  if (!pool) return { ok: true, sslStrict: getSslRejectUnauthorized() };

  try {
    await pool.query("SELECT 1");
    return { ok: true, sslStrict: getSslRejectUnauthorized() };
  } catch (err) {
    if (getSslRejectUnauthorized() && isBongsimPgTlsHandshakeIssue(err)) {
      console.warn(
        "[bongsim/db/pool] Strict TLS (rejectUnauthorized: true) failed; falling back to rejectUnauthorized: false.",
        err instanceof Error ? err.message : err,
      );
      const pool2 = await rebuildPoolWithRelaxedTls();
      if (!pool2) return { ok: false, sslStrict: false };
      try {
        await pool2.query("SELECT 1");
        return { ok: true, sslStrict: false };
      } catch (e2) {
        console.error("[bongsim/db/pool] Fallback pool SELECT 1 failed:", e2);
        return { ok: false, sslStrict: false };
      }
    }
    console.error("[bongsim/db/pool] SELECT 1 failed:", err);
    return { ok: false, sslStrict: getSslRejectUnauthorized() };
  }
}

export async function closePgPool(): Promise<void> {
  const p = getCachedPool();
  if (p) {
    await p.end();
    setCachedPool(undefined);
  }
}

/** 카탈로그 등 — 트랜잭션 풀러에서도 세션에 남지 않게 LOCAL + BEGIN */
export const BONGSIM_CATALOG_STATEMENT_TIMEOUT_MS = 12_000;

// REGRESSION-FREEZE[bongsim-catalog-list-perf]: classify connect timeout + pool self-heal — manifest

export type BongsimPgFailureKind = "connection_timeout" | "db_error";

export function classifyBongsimPgError(err: unknown): BongsimPgFailureKind {
  const msg = String(err instanceof Error ? err.message : err);
  const code =
    typeof err === "object" && err !== null && "code" in err
      ? String((err as { code?: string }).code ?? "")
      : "";
  if (
    /timeout exceeded when trying to connect|Connection terminated due to connection timeout|connect ETIMEDOUT|ECONNREFUSED/i.test(
      msg,
    ) ||
    // Supabase 풀러 고갈. 일시적 용량 문제라 풀 리셋 + 503 재시도 경로로 보낸다.
    /EMAXCONNSESSION|max clients reached|too many connections|remaining connection slots/i.test(msg) ||
    code === "ETIMEDOUT" ||
    code === "ECONNREFUSED" ||
    code === "53300"
  ) {
    return "connection_timeout";
  }
  return "db_error";
}

export function getBongsimPoolStats(): {
  total: number;
  idle: number;
  waiting: number;
} | null {
  const p = getCachedPool();
  if (!p) return null;
  return {
    total: p.totalCount,
    idle: p.idleCount,
    waiting: p.waitingCount,
  };
}

let poolResetInFlight: Promise<void> | null = null;

/** Railway 등에서 연결이 고이면 다음 요청이 새 풀을 쓰도록 1회 리셋 */
export function resetBongsimPgPoolAfterConnectTimeout(err: unknown): void {
  if (classifyBongsimPgError(err) !== "connection_timeout") return;
  if (poolResetInFlight) return;
  const stats = getBongsimPoolStats();
  console.error("[bongsim/db/pool] connection_timeout — resetting pool", { stats });
  poolResetInFlight = closePgPool()
    .catch((e) => {
      console.error("[bongsim/db/pool] pool reset failed", e);
    })
    .finally(() => {
      poolResetInFlight = null;
    });
}

async function runWithStatementTimeout<T>(
  fn: (client: import("pg").PoolClient) => Promise<T>,
  timeoutMs: number,
): Promise<T> {
  const pool = getPgPool();
  if (!pool) {
    throw new Error("db_unconfigured");
  }
  const client = await pool.connect();
  const ms = Math.max(1_000, Math.trunc(timeoutMs));
  try {
    await client.query("BEGIN");
    await client.query(`SET LOCAL statement_timeout = ${ms}`);
    const out = await fn(client);
    await client.query("COMMIT");
    return out;
  } catch (e) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* ignore */
    }
    throw e;
  } finally {
    client.release();
  }
}

export async function withBongsimStatementTimeout<T>(
  fn: (client: import("pg").PoolClient) => Promise<T>,
  timeoutMs: number = BONGSIM_CATALOG_STATEMENT_TIMEOUT_MS,
): Promise<T> {
  try {
    return await runWithStatementTimeout(fn, timeoutMs);
  } catch (e) {
    // instrumentation 번들과 라우트 번들의 TLS 플래그가 갈라진 경우 여기서 복구
    if (getSslRejectUnauthorized() && isBongsimPgTlsHandshakeIssue(e)) {
      console.warn(
        "[bongsim/db/pool] TLS handshake failed in statement-timeout path; rebuilding relaxed pool",
      );
      await rebuildPoolWithRelaxedTls();
      return await runWithStatementTimeout(fn, timeoutMs);
    }
    throw e;
  }
}

/**
 * plans 등 BEGIN/SET LOCAL을 피하는 plain `pool.query` 경로용.
 * TLS handshake 실패 시 relaxed 풀로 1회 재시도.
 */
export async function withBongsimPoolQuery<T>(fn: (pool: Pool) => Promise<T>): Promise<T> {
  const pool = getPgPool();
  if (!pool) throw new Error("db_unconfigured");
  try {
    return await fn(pool);
  } catch (e) {
    if (getSslRejectUnauthorized() && isBongsimPgTlsHandshakeIssue(e)) {
      console.warn("[bongsim/db/pool] TLS handshake failed in pool-query path; rebuilding relaxed pool");
      const pool2 = await rebuildPoolWithRelaxedTls();
      if (!pool2) throw e;
      return await fn(pool2);
    }
    throw e;
  }
}
