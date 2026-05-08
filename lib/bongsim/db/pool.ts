import { Pool, type PoolConfig } from "pg";

/** Next.js dev 핫리로드 시 모듈 스코프가 초기화되어도 풀 인스턴스를 유지 */
type GlobalWithBongsimPool = typeof globalThis & {
  __bongsimPool?: Pool;
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

/** strict → 연결 실패 시 relaxed 로 한 번만 전환 (프로세스 전역 TLS 비활성화 금지) */
let sslRejectUnauthorized: boolean = true;

/** 세션 모드(5432) → 트랜잭션 풀러(6543). 비표준 URL은 `:@host:5432` 형태만 치환. */
function rewriteSessionPort5432To6543(urlStr: string): string {
  try {
    const u = new URL(urlStr);
    if (u.port === "5432") {
      u.port = "6543";
      return u.toString();
    }
    return urlStr;
  } catch {
    return urlStr.replace(/:5432(?=[/?#]|$)/g, ":6543");
  }
}

function isTransactionPoolerPort(urlStr: string): boolean {
  try {
    return new URL(urlStr).port === "6543";
  } catch {
    return /:6543(?=[/?#]|$)/.test(urlStr);
  }
}

function isLikelyTlsHandshakeIssue(err: unknown): boolean {
  const msg = String(err instanceof Error ? err.message : err);
  const code = typeof err === "object" && err !== null && "code" in err ? String((err as { code?: string }).code) : "";
  return (
    /certificate|Certification|SSL|TLS|UNABLE_TO_VERIFY|SELF_SIGNED|wrong version number|ssl/i.test(msg) ||
    code === "DEPTH_ZERO_SELF_SIGNED_CERT" ||
    code === "UNABLE_TO_VERIFY_LEAF_SIGNATURE"
  );
}

function buildPoolConfig(): PoolConfig | null {
  let url = process.env.DATABASE_URL?.trim();
  if (!url) return null;

  // sslmode를 URL에서 제거 (pg-connection-string이 ssl 설정을 덮어쓰는 것 방지)
  url = url.replace(/[?&]sslmode=[^&]*/gi, "").replace(/\?$/, "");

  url = rewriteSessionPort5432To6543(url);

  const useTxnPooler = isTransactionPoolerPort(url);

  const cfg: PoolConfig & { prepareThreshold?: number } = {
    connectionString: url,
    max: 5,
    idleTimeoutMillis: 10_000,
    ssl: sslRejectUnauthorized ? { rejectUnauthorized: true } : { rejectUnauthorized: false },
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

/**
 * Supabase 등: 우선 인증서 검증 ON. 체인 문제 등으로 실패 시 한 번만 검증 완화 후 재시도.
 * instrumentation 등 서버 기동 시 호출 권장.
 */
export async function probePgPoolTlsOrFallback(): Promise<{ ok: boolean; sslStrict: boolean }> {
  const pool = getPgPool();
  if (!pool) return { ok: true, sslStrict: sslRejectUnauthorized };

  try {
    await pool.query("SELECT 1");
    return { ok: true, sslStrict: sslRejectUnauthorized };
  } catch (err) {
    if (sslRejectUnauthorized && isLikelyTlsHandshakeIssue(err)) {
      console.warn(
        "[bongsim/db/pool] Strict TLS (rejectUnauthorized: true) failed; falling back to rejectUnauthorized: false.",
        err instanceof Error ? err.message : err,
      );
      await pool.end().catch(() => {});
      setCachedPool(undefined);
      sslRejectUnauthorized = false;
      const pool2 = getPgPool();
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
    return { ok: false, sslStrict: sslRejectUnauthorized };
  }
}

export async function closePgPool(): Promise<void> {
  const p = getCachedPool();
  if (p) {
    await p.end();
    setCachedPool(undefined);
  }
}
