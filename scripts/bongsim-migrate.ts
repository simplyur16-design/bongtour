#!/usr/bin/env tsx
/**
 * 봉심 마이그레이션 러너.
 *   - db/bongsim-migrations/*.sql 파일명 순서대로 적용
 *   - bongsim_schema_migrations 테이블에 체크섬 기록 → 중복 적용 방지
 *   - --list / --dry-run / --force
 * 환경변수: DATABASE_URL
 */
import { Client } from 'pg';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { config as loadDotenv } from 'dotenv';

// .env.local 우선, 없으면 .env (Next.js 외부에서 tsx 직접 실행 시)
if (existsSync('.env.local')) {
  loadDotenv({ path: '.env.local' });
} else if (existsSync('.env')) {
  loadDotenv({ path: '.env' });
}

const MIGRATIONS_DIR = resolve(process.cwd(), 'db/bongsim-migrations');

type Args = { list: boolean; dryRun: boolean; force: boolean };

function parseArgs(argv: string[]): Args {
  return {
    list: argv.includes('--list'),
    dryRun: argv.includes('--dry-run'),
    force: argv.includes('--force'),
  };
}

function sha256(s: string): string {
  return createHash('sha256').update(s, 'utf8').digest('hex');
}

async function ensureMigrationsTable(client: Client): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS bongsim_schema_migrations (
      filename    TEXT PRIMARY KEY,
      checksum    TEXT NOT NULL,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}

type MigrationFile = { filename: string; path: string; sql: string; checksum: string };

function listMigrationFiles(): MigrationFile[] {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => /^\d{4}_.+\.sql$/i.test(f))
    .sort();
  return files.map((filename) => {
    const path = join(MIGRATIONS_DIR, filename);
    const sql = readFileSync(path, 'utf8');
    return { filename, path, sql, checksum: sha256(sql) };
  });
}

async function fetchApplied(client: Client): Promise<Map<string, string>> {
  const res = await client.query<{ filename: string; checksum: string }>(
    'SELECT filename, checksum FROM bongsim_schema_migrations ORDER BY filename ASC',
  );
  return new Map(res.rows.map((r) => [r.filename, r.checksum]));
}

async function applyMigration(client: Client, file: MigrationFile): Promise<void> {
  // 파일 내 BEGIN/COMMIT 포함되어 있음 — 여기서 감싸지 않음
  await client.query(file.sql);
  await client.query(
    `INSERT INTO bongsim_schema_migrations (filename, checksum)
     VALUES ($1, $2)
     ON CONFLICT (filename) DO UPDATE SET checksum = EXCLUDED.checksum, applied_at = now()`,
    [file.filename, file.checksum],
  );
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('[bongsim-migrate] DATABASE_URL 없음. .env.local 확인.');
    process.exit(1);
  }

  // sslmode=require 가 있으면 Node 쪽 rejectUnauthorized 와 충돌하는 경우가 있어 제거 후 ssl 옵션만 사용
  const connectionString = dbUrl
    .replace(/\?sslmode=require\b/i, '')
    .replace(/&sslmode=require\b/i, '')
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  try {
    await ensureMigrationsTable(client);
    const files = listMigrationFiles();
    const applied = await fetchApplied(client);

    if (args.list) {
      console.log(`[bongsim-migrate] 적용 이력 (${applied.size}건):`);
      for (const [filename, checksum] of applied) {
        const onDisk = files.find((f) => f.filename === filename);
        const drift = onDisk && onDisk.checksum !== checksum ? ' ⚠️ 체크섬 변경됨' : '';
        console.log(`  - ${filename}  ${checksum.slice(0, 12)}${drift}`);
      }
      const pending = files.filter((f) => !applied.has(f.filename));
      if (pending.length) {
        console.log(`\n[bongsim-migrate] 미적용 (${pending.length}건):`);
        for (const f of pending) console.log(`  - ${f.filename}  ${f.checksum.slice(0, 12)}`);
      } else {
        console.log('\n[bongsim-migrate] 모두 최신.');
      }
      return;
    }

    const toApply = files.filter((f) => {
      if (args.force) return true;
      const existing = applied.get(f.filename);
      if (!existing) return true;
      if (existing !== f.checksum) {
        console.warn(
          `[bongsim-migrate] ⚠️ ${f.filename} 체크섬 변경. 적용 스킵. --force로 재적용 가능.`,
        );
      }
      return false;
    });

    if (!toApply.length) {
      console.log('[bongsim-migrate] 적용할 마이그레이션 없음.');
      return;
    }

    if (args.dryRun) {
      console.log('[bongsim-migrate] (dry-run) 적용 예정:');
      for (const f of toApply) console.log(`  - ${f.filename}`);
      return;
    }

    for (const f of toApply) {
      const startedAt = Date.now();
      process.stdout.write(`[bongsim-migrate] → ${f.filename} ... `);
      try {
        await applyMigration(client, f);
        console.log(`OK (${Date.now() - startedAt}ms)`);
      } catch (e) {
        console.log('FAIL');
        console.error(e);
        process.exit(1);
      }
    }

    console.log(`[bongsim-migrate] 완료: ${toApply.length}건 적용.`);
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error('[bongsim-migrate] fatal:', e);
  process.exit(1);
});
