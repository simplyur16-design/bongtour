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
  /** OrderPaid·EsimQrNotify drain 전용 — 카탈로그 풀 포화와 분리 */
  __bongsimOutboxPool?: Pool;
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

function getCachedOutboxPool(): Pool | undefined {
  return (globalThis as GlobalWithBongsimPool).__bongsimOutboxPool;
}

function setCachedOutboxPool(p: Pool | undefined): void {
  if (p === undefined) {
    delete (globalThis as GlobalWithBongsimPool).__bongsimOutboxPool;
  } else {
    (globalThis as GlobalWithBongsimPool).__bongsimOutboxPool = p;
  }
}

function isSupabasePoolerConnectionString(urlStr: string): boolean {
  try {
    const host = new URL(urlStr).hostname.toLowerCase();
    // pooler·direct(db.*) 모두 체인 self-signed → strict TLS 불가
    return host.includes("supabase.com") || host.includes("supabase.co");
  } catch {
    return /supabase\.(com|co)/i.test(urlStr);
  }
}

/**
 * Supabase는 체인에 self-signed가 있어 strict TLS가 실패한다.
 * 첫 접근 시 URL 보고 기본값을 정하고 globalThis에 고정한다.
 */
function getSslRejectUnauthorized(): boolean {
  const g = globalThis as GlobalWithBongsimPool;
  if (typeof g.__bongsimSslRejectUnauthorized === "boolean") {
    return g.__bongsimSslRejectUnauthorized;
  }
  const raw = process.env.DATABASE_URL?.trim() ?? "";
  // Supabase → 처음부터 relaxed (probe 전 cold request도 카탈로그 살림)
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
 * Supabase 세션 풀 슬롯을 Prisma(`connection_limit`)와 나눠 쓴다.
 * 기본 5 — 동시 카탈로그/주문 조회 여유. 상한은 docs/ops/production-stability-root-cause.md 예산표.
 */
const BONGSIM_POOL_MAX_DEFAULT = 5;

export function resolveBongsimPoolMax(): number {
  const raw = process.env.BONGSIM_PG_POOL_MAX?.trim();
  if (raw) {
    const n = Number.parseInt(raw, 10);
    if (Number.isFinite(n) && n >= 1 && n <= 20) return n;
  }
  return BONGSIM_POOL_MAX_DEFAULT;
}

/** 발급 outbox drain 전용 풀 상한. 카탈로그와 합이 `BONGSIM_PG_POOL_MAX`를 넘지 않게 나눈다. */
const BONGSIM_OUTBOX_POOL_MAX_DEFAULT = 2;

// REGRESSION-FREEZE[bongsim-fulfill-outbox-own-pool]: drain pool max — manifest
export function resolveBongsimOutboxPoolMax(): number {
  const raw = process.env.BONGSIM_OUTBOX_POOL_MAX?.trim();
  if (raw) {
    const n = Number.parseInt(raw, 10);
    if (Number.isFinite(n) && n >= 1 && n <= 4) return n;
  }
  return BONGSIM_OUTBOX_POOL_MAX_DEFAULT;
}

/**
 * 프로세스 pg 예산 = catalog + outbox. 예: web 10 → catalog 8 + outbox 2.
 * REGRESSION-FREEZE[bongsim-fulfill-outbox-own-pool]: split stays inside pool max — manifest
 */
export function resolveBongsimCatalogPoolMax(): number {
  const total = resolveBongsimPoolMax();
  const outbox = Math.min(resolveBongsimOutboxPoolMax(), Math.max(1, total - 1));
  return total - outbox;
}

export function resolveBongsimOutboxPoolMaxClamped(): number {
  const total = resolveBongsimPoolMax();
  return Math.min(resolveBongsimOutboxPoolMax(), Math.max(1, total - 1));
}

/** pg Pool connectionTimeoutMillis — 기본 8s, env `BONGSIM_PG_CONNECT_TIMEOUT_MS` (3s–30s). */
export function resolveBongsimPoolConnectTimeoutMs(): number {
  const raw = process.env.BONGSIM_PG_CONNECT_TIMEOUT_MS?.trim();
  if (raw) {
    const n = Number.parseInt(raw, 10);
    if (Number.isFinite(n) && n >= 3_000 && n <= 30_000) return n;
  }
  return 8_000;
}

/**
 * 풀 슬롯이 이미 꽉 찬 연결 타임아웃이면 heal(close+재생성)이 Supabase 슬롯을
 * 더 잡아 악화시킨다 → backoff 재시도가 맞다.
 * REGRESSION-FREEZE[bongsim-fulfill-drain-saturated-retry]: saturated → no heal — manifest
 */
export function shouldBackoffInsteadOfHealOnConnectTimeout(
  stats: { total: number; idle: number; waiting: number } | null,
  poolMax: number = resolveBongsimCatalogPoolMax(),
): boolean {
  if (!stats) return false;
  return stats.idle === 0 && stats.total >= poolMax;
}

/**
 * 포화 connect timeout 직후 같은 tick에서 drain을 다시 치면 슬롯을 더 짓누른다.
 * REGRESSION-FREEZE[bongsim-fulfill-drain-saturated-retry]: saturated → no immediate retry — manifest
 */
export function shouldSkipImmediateDrainRetryOnSaturatedTimeout(saturated: boolean): boolean {
  return saturated === true;
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
    max: resolveBongsimCatalogPoolMax(),
    idleTimeoutMillis: 10_000,
    // 연결 고갈 시 무한 대기 → eSIM by-country「상품 조회 중…」무한 로딩 방지
    // worker 발급 드레인은 배치와 슬롯 경합 시 6s가 짧아 타임아웃→heal 연타가 난다.
    connectionTimeoutMillis: resolveBongsimPoolConnectTimeoutMs(),
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

/**
 * OrderPaid·EsimQrNotify drain 전용 풀.
 * 카탈로그 풀이 포화여도 발송 큐를 집어 솔라피로 보낼 수 있게 한다.
 * REGRESSION-FREEZE[bongsim-fulfill-outbox-own-pool]: getBongsimOutboxPool — manifest
 */
export function getBongsimOutboxPool(): Pool | null {
  const existing = getCachedOutboxPool();
  if (existing) return existing;

  const cfg = buildPoolConfig();
  if (!cfg) return null;

  const next = new Pool({ ...cfg, max: resolveBongsimOutboxPoolMaxClamped() });
  setCachedOutboxPool(next);
  return next;
}

/** fulfill drain — outbox 풀 우선, 없으면 카탈로그 풀 */
export function getBongsimFulfillOutboxPool(): Pool | null {
  return getBongsimOutboxPool() ?? getPgPool();
}

async function rebuildPoolWithRelaxedTls(): Promise<Pool | null> {
  setSslRejectUnauthorized(false);
  await closePgPool().catch(() => {});
  return getPgPool();
}

const PROBE_QUERY_BUDGET_MS = 4_000;

async function probeSelect1(pool: Pool): Promise<void> {
  // REGRESSION-FREEZE[bongsim-pg-tls-global]: probe SELECT 1 budget — manifest
  // idle 좀비 연결에서 query가 connectionTimeout을 안 타고 영구 대기하는 경우 차단.
  await Promise.race([
    pool.query("SELECT 1"),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("probe SELECT 1 timeout")), PROBE_QUERY_BUDGET_MS),
    ),
  ]);
}

/**
 * Supabase 등: 우선 인증서 검증 ON. 체인 문제 등으로 실패 시 한 번만 검증 완화 후 재시도.
 * instrumentation 등 서버 기동 시 호출 권장.
 */
export async function probePgPoolTlsOrFallback(): Promise<{ ok: boolean; sslStrict: boolean }> {
  const pool = getPgPool();
  if (!pool) return { ok: true, sslStrict: getSslRejectUnauthorized() };

  try {
    await probeSelect1(pool);
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
        await probeSelect1(pool2);
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
  const outbox = getCachedOutboxPool();
  // 캐시에서 먼저 분리 — end() 대기 중 다른 요청이 같은 Pool을 쓰면
  // "Cannot use a pool after calling end on the pool" 가 난다.
  setCachedPool(undefined);
  setCachedOutboxPool(undefined);
  // REGRESSION-FREEZE[bongsim-pg-tls-global]: pool.end() must not block request path — manifest
  // 체크아웃/대기 클라이언트가 있으면 end()가 풀러 압박 하에서 영구 대기 → /countries 무응답.
  if (p) void p.end().catch(() => {});
  if (outbox) void outbox.end().catch(() => {});
}

/** 카탈로그 등 — 트랜잭션 풀러에서도 세션에 남지 않게 LOCAL + BEGIN */
export const BONGSIM_CATALOG_STATEMENT_TIMEOUT_MS = 12_000;

// REGRESSION-FREEZE[bongsim-catalog-list-perf]: classify connect timeout + pool self-heal — manifest
// REGRESSION-FREEZE[simplyur-product-detail-same-catalog-pipe]: (EMAXCONN) max client connections reached → 503 — manifest

export type BongsimPgFailureKind = "connection_timeout" | "db_error";

export function classifyBongsimPgError(err: unknown): BongsimPgFailureKind {
  const msg = String(err instanceof Error ? err.message : err);
  const code =
    typeof err === "object" && err !== null && "code" in err
      ? String((err as { code?: string }).code ?? "")
      : "";
  if (
    /timeout exceeded when trying to connect|Connection terminated due to connection timeout|connect ETIMEDOUT|ECONNREFUSED|ECONNRESET/i.test(
      msg,
    ) ||
    // heal이 pool.end() 한 뒤 동시 요청이 옛 풀을 집는 경우 — 새 풀로 재시도
    /Cannot use a pool after calling end on the pool/i.test(msg) ||
    // 풀 잔상·서버가 연결을 끊은 경우 — 503 재시도
    /Connection terminated|server closed the connection|Client has encountered a connection error|broken pipe|EPIPE/i.test(
      msg,
    ) ||
    // Supabase 풀러 고갈. 일시적 용량 문제라 풀 리셋 + 503 재시도 경로로 보낸다.
    // (EMAXCONN) max client connections reached — Supabase session 200. EMAXCONNSESSION만 보면 상세가 db_error로 굳음.
    /EMAXCONN|max clients? connections? reached|too many connections|remaining connection slots|MaxClientsInSessionMode/i.test(
      msg,
    ) ||
    // statement_timeout — 풀 고갈·락과 겹치면 카탈로그가 db_error로 굳음 → 503 재시도
    /canceling statement due to statement timeout|query_canceled/i.test(msg) ||
    // TLS handshake 실패도 풀 재생성으로 복구 (strict→relaxed). 클라이언트가 503으로 재시도하게 한다.
    isBongsimPgTlsHandshakeIssue(err) ||
    code === "ETIMEDOUT" ||
    code === "ECONNREFUSED" ||
    code === "ECONNRESET" ||
    code === "53300" ||
    code === "57014" ||
    code === "57P01" ||
    code === "08006" ||
    code === "08001"
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
let lastCatalogHealAt = 0;
const CATALOG_HEAL_COOLDOWN_MS = 30_000;

/**
 * 카탈로그 복구용 풀 heal — 동시 요청이 closePgPool 연타하지 않게 coalesce + cooldown.
 * (연타 시 Supabase EMAXCONNSESSION → 전 국가/locale db_error 연쇄)
 */
const HEAL_WAIT_BUDGET_MS = 2_500;

// REGRESSION-FREEZE[bongsim-pg-tls-global]: healBongsimPgPoolForCatalog coalesce — manifest
export async function healBongsimPgPoolForCatalog(reason?: string): Promise<void> {
  if (poolResetInFlight) {
    await Promise.race([
      poolResetInFlight.catch(() => {}),
      new Promise<void>((r) => setTimeout(r, HEAL_WAIT_BUDGET_MS)),
    ]);
    return;
  }
  const now = Date.now();
  if (now - lastCatalogHealAt < CATALOG_HEAL_COOLDOWN_MS) {
    return;
  }
  lastCatalogHealAt = now;
  const stats = getBongsimPoolStats();
  console.warn("[bongsim/db/pool] catalog heal", { reason, stats });
  poolResetInFlight = (async () => {
    setSslRejectUnauthorized(false);
    // closePgPool: detach → non-blocking end. 이후 getPgPool()은 새 인스턴스.
    await closePgPool().catch(() => {});
    const pool = getPgPool();
    if (!pool) return;
    try {
      await Promise.race([
        pool.query("SELECT 1"),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("heal probe timeout")), HEAL_WAIT_BUDGET_MS),
        ),
      ]);
    } catch (probeErr) {
      // TLS만 한 번 더 교체. connection_timeout은 이미 새 풀이므로 이중 close 금지.
      if (isBongsimPgTlsHandshakeIssue(probeErr)) {
        await rebuildPoolWithRelaxedTls();
      }
    }
  })()
    .catch((e) => {
      console.error("[bongsim/db/pool] catalog heal failed", e);
    })
    .finally(() => {
      poolResetInFlight = null;
    });
  // 요청 경로가 heal에 붙잡혀 /countries가 무응답 되지 않게 상한.
  await Promise.race([
    poolResetInFlight,
    new Promise<void>((r) => setTimeout(r, HEAL_WAIT_BUDGET_MS)),
  ]);
}

/** Railway 등에서 연결이 고이면 다음 요청이 새 풀을 쓰도록 1회 리셋 (호출측에서 await 권장) */
export function resetBongsimPgPoolAfterConnectTimeout(err: unknown): Promise<void> {
  if (classifyBongsimPgError(err) !== "connection_timeout") return Promise.resolve();
  return healBongsimPgPoolForCatalog(
    isBongsimPgTlsHandshakeIssue(err) ? "tls_handshake" : "connection_timeout",
  );
}

const POOL_CONNECT_BUDGET_MS = () => resolveBongsimPoolConnectTimeoutMs();

async function connectWithBudget(pool: Pool): Promise<import("pg").PoolClient> {
  // REGRESSION-FREEZE[bongsim-pg-tls-global]: pool.connect budget — manifest
  const budget = POOL_CONNECT_BUDGET_MS();
  return await Promise.race([
    pool.connect(),
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error("timeout exceeded when trying to connect")),
        budget,
      ),
    ),
  ]);
}

async function runWithStatementTimeout<T>(
  fn: (client: import("pg").PoolClient) => Promise<T>,
  timeoutMs: number,
): Promise<T> {
  const pool = getPgPool();
  if (!pool) {
    throw new Error("db_unconfigured");
  }
  const client = await connectWithBudget(pool);
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

/**
 * 카탈로그 cold miss가 풀/TLS 잔상으로 한 번 실패해도 복구 후 1회 재시도.
 * (프로덕션에서 캐시된 jp만 되고 fr/kr plans·by-country가 db_error로 비는 증상 완화)
 */
// REGRESSION-FREEZE[bongsim-pg-tls-global]: withBongsimCatalogRetry heal+retry — manifest
export async function withBongsimCatalogRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (String(e instanceof Error ? e.message : e).includes("db_unconfigured")) throw e;
    console.warn(
      "[bongsim/db/pool] catalog query failed; healing pool and retrying once",
      e instanceof Error ? e.message : e,
    );
    await healBongsimPgPoolForCatalog(e instanceof Error ? e.message : String(e));
    if (!getPgPool()) throw e;
    return await fn();
  }
}
