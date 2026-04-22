import pg from 'pg';
import Database from 'better-sqlite3';
import { config } from 'dotenv';

config({ path: '.env.local' });

const { Client } = pg;
const pgUrl = process.env.DATABASE_URL.replace(/\?.*$/, '');
const pgClient = new Client({
  connectionString: pgUrl,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 30000,
});

await pgClient.connect();
await pgClient.query("SET statement_timeout = '600000'");

const sqlite = new Database('prisma/dev.db', { readonly: true });

/** @type {Map<string, Map<string, string>>} table -> col -> format_type */
const pgTypeCache = new Map();

async function loadPgColumnTypes(tableName) {
  if (pgTypeCache.has(tableName)) return pgTypeCache.get(tableName);
  const { rows } = await pgClient.query(
    `
    SELECT a.attname AS col, format_type(a.atttypid, a.atttypmod) AS typ
    FROM pg_attribute a
    JOIN pg_class c ON a.attrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE n.nspname = 'public'
      AND c.relname = $1
      AND a.attnum > 0
      AND NOT a.attisdropped
    `,
    [tableName]
  );
  const m = new Map(rows.map((r) => [r.col, r.typ]));
  pgTypeCache.set(tableName, m);
  return m;
}

function convertValue(v, col, pgTyp) {
  if (v === null || v === undefined) return null;

  if (typeof v === 'bigint') {
    if (v <= BigInt(Number.MAX_SAFE_INTEGER) && v >= BigInt(Number.MIN_SAFE_INTEGER)) return Number(v);
    return v.toString();
  }

  if (Buffer.isBuffer(v)) return v;

  const typ = (pgTyp || '').toLowerCase();

  if (typ === 'boolean' || typ.includes('bool')) {
    if (typeof v === 'boolean') return v;
    if (typeof v === 'number') return v !== 0;
    if (typeof v === 'string') {
      const s = v.trim().toLowerCase();
      if (s === '1' || s === 'true') return true;
      if (s === '0' || s === 'false' || s === '') return false;
    }
    return Boolean(v);
  }

  if (
    typ.includes('timestamp') ||
    typ === 'date' ||
    (typeof v === 'number' && v > 1_000_000_000_000 && v < 1e14)
  ) {
    if (typeof v === 'number' && v > 1_000_000_000_000) {
      const d = new Date(v);
      if (!Number.isNaN(d.getTime())) return d.toISOString();
    }
    if (typeof v === 'string' && v.trim()) return v;
  }

  if (typeof v === 'number' && Number.isInteger(v) && (typ.includes('int') || typ === 'integer' || typ === 'bigint')) {
    return v;
  }

  if (typeof v === 'number' && (typ.includes('double') || typ.includes('real') || typ === 'numeric')) {
    return v;
  }

  return v;
}

// FK 순서 (부모 → 자식) — travel_reviews, image_assets 제외
const MIGRATION_ORDER = [
  'User',
  'Brand',
  'Destination',
  'DestinationGalleryCache',
  'DestinationImageSet',
  'PhotoPool',
  'AgentScrapeReport',
  'ScraperQueue',
  'HanatourMonthlyBenefit',
  'EditorialContent',
  'MonthlyCurationContent',
  'VerificationToken',
  'RegisterAdminInputSnapshot',
  'Account',
  'Session',
  'Product',
  'OptionalTour',
  'ProductPrice',
  'Itinerary',
  'ItineraryDay',
  'ProductDeparture',
  'Booking',
  'AssetUsageLog',
  'MonthlyCurationItem',
  'CustomerInquiry',
  'RegisterAdminAnalysis',
];

console.log('='.repeat(60));
console.log('Phase C: SQLite → PostgreSQL 데이터 이전');
console.log('='.repeat(60));

const summary = [];
const totalStart = Date.now();

for (const tableName of MIGRATION_ORDER) {
  console.log(`\n[${tableName}]`);
  const startTime = Date.now();

  let rows;
  try {
    rows = sqlite.prepare(`SELECT * FROM "${tableName}"`).all();
  } catch (e) {
    console.log(`  SQLite 테이블 없음 또는 읽기 실패: ${e.message}`);
    summary.push({ table: tableName, status: 'skip', reason: 'not_in_sqlite', rows: 0 });
    continue;
  }

  if (rows.length === 0) {
    console.log(`  SQLite에 0행 → 스킵`);
    summary.push({ table: tableName, status: 'skip', reason: 'empty', rows: 0 });
    continue;
  }

  console.log(`  SQLite 행 수: ${rows.length}`);

  const columns = Object.keys(rows[0]);
  console.log(`  컬럼 수: ${columns.length}`);

  const pgTypes = await loadPgColumnTypes(tableName);

  let inserted = 0;
  let failed = 0;
  const errors = [];
  const batchSize = 100;

  outer: for (let batchStart = 0; batchStart < rows.length; batchStart += batchSize) {
    const batch = rows.slice(batchStart, batchStart + batchSize);

    for (let bi = 0; bi < batch.length; bi++) {
      const row = batch[bi];
      const globalRowIndex = batchStart + bi + 1;

      try {
        const values = columns.map((col) => convertValue(row[col], col, pgTypes.get(col)));
        const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
        const columnList = columns.map((c) => `"${c}"`).join(', ');

        await pgClient.query(
          `INSERT INTO "${tableName}" (${columnList}) VALUES (${placeholders})`,
          values
        );
        inserted++;
      } catch (e) {
        errors.push({
          row: globalRowIndex,
          error: e.message.substring(0, 200),
          code: e.code,
        });
        failed++;

        if (failed === 1) {
          console.log(`  첫 에러 분석:`);
          console.log(`    SQLite row 샘플:`, JSON.stringify(row).substring(0, 300));
          console.log(`    에러:`, e.message);
        }

        if (failed >= 5) {
          console.log(`  실패 5개 초과 → 테이블 이전 중단`);
          break outer;
        }
      }
    }

    if (failed >= 5) break;

    if (batchStart + batchSize < rows.length) {
      console.log(`  진행: ${inserted + failed} / ${rows.length}`);
    }
  }

  const elapsed = Date.now() - startTime;

  if (failed === 0) {
    console.log(`  ✅ 완료: ${inserted}행 (${elapsed}ms)`);
    summary.push({ table: tableName, status: 'success', rows: inserted, elapsed });
  } else {
    console.log(`  ⚠️ 부분 성공: ${inserted}/${rows.length}행, 실패 ${failed}건`);
    summary.push({
      table: tableName,
      status: 'partial',
      rows: inserted,
      failed,
      elapsed,
      sample_errors: errors.slice(0, 3),
    });

    if (failed >= 5) {
      console.log('\n\n🚨 테이블 이전 실패 → 전체 중단');
      break;
    }
  }
}

sqlite.close();
await pgClient.end();

console.log('\n' + '='.repeat(60));
console.log('Phase C 완료');
console.log('='.repeat(60));
console.log(`총 소요 시간: ${((Date.now() - totalStart) / 1000).toFixed(1)}초`);

console.log('\n테이블별 결과:');
let totalInserted = 0;
summary.forEach((s) => {
  const icon = s.status === 'success' ? '✅' : s.status === 'partial' ? '⚠️' : 'ℹ️';
  console.log(`  ${icon} ${s.table.padEnd(30)} ${s.rows} 행 (${s.status})`);
  if (s.status === 'success' || s.status === 'partial') totalInserted += s.rows;
});

console.log(`\n총 이전: ${totalInserted} 행`);

const failures = summary.filter((s) => s.status === 'partial');
if (failures.length > 0) {
  console.log('\n⚠️ 부분 실패 테이블 상세:');
  failures.forEach((f) => {
    console.log(`\n  ${f.table}:`);
    f.sample_errors?.forEach((e) => {
      console.log(`    [row ${e.row}] ${e.code}: ${e.error}`);
    });
  });
}
