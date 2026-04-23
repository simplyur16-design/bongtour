import { Pool, type PoolConfig } from "pg";

let pool: Pool | null = null;

function buildPoolConfig(): PoolConfig | null {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) return null;

  const cfg: PoolConfig = {
    connectionString: url,
    max: 10,
    idleTimeoutMillis: 30_000,
  };

  const strict = process.env.BONGSIM_PG_SSL_STRICT?.trim() === "1";
  const hasSslModeInUrl = /\bsslmode=/i.test(url);
  if (!strict && hasSslModeInUrl) {
    cfg.ssl = { rejectUnauthorized: false };
  }

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
