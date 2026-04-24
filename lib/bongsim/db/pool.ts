import { Pool, type PoolConfig } from "pg";

let pool: Pool | null = null;

function buildPoolConfig(): PoolConfig | null {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  let url = process.env.DATABASE_URL?.trim();
  if (!url) return null;

  // sslmode를 URL에서 제거 (pg-connection-string이 ssl 설정을 덮어쓰는 것 방지)
  url = url.replace(/[?&]sslmode=[^&]*/gi, "").replace(/\?$/, "");

  const cfg: PoolConfig = {
    connectionString: url,
    max: 10,
    idleTimeoutMillis: 30_000,
    ssl: { rejectUnauthorized: false },
  };

  return cfg;
}

export function getPgPool(): Pool | null {
  if (!pool) {
    const cfg = buildPoolConfig();
    if (!cfg) return null;
    pool = new Pool(cfg);
  }
  return pool;
}

export async function closePgPool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
