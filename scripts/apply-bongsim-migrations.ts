/**
 * 로컬·스테이징: bongsim PostgreSQL 마이그레이션 일괄 적용.
 * 사용: npx tsx scripts/apply-bongsim-migrations.ts
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { getPgPool } from "@/lib/bongsim/db/pool";

async function main() {
  const pool = getPgPool();
  if (!pool) {
    console.error("DATABASE_URL이 없습니다.");
    process.exit(1);
  }
  const dir = join(process.cwd(), "db", "bongsim-migrations");
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  const client = await pool.connect();
  try {
    for (const file of files) {
      const sql = readFileSync(join(dir, file), "utf8");
      console.log(`[apply] ${file}`);
      await client.query(sql);
    }
    console.log(`[done] ${files.length} migration(s)`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
