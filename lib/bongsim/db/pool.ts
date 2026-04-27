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

function buildPoolConfig(): PoolConfig | null {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
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
    ssl: { rejectUnauthorized: false },
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

export async function closePgPool(): Promise<void> {
  const p = getCachedPool();
  if (p) {
    await p.end();
    setCachedPool(undefined);
  }
}
