import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { config } from 'dotenv';
config({ path: '.env.local' });

const { Client } = pg;
const url = process.env.DATABASE_URL.replace(/\?.*$/, '');
const client = new Client({ 
  connectionString: url, 
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 30000,
});

await client.connect();
await client.query("SET statement_timeout = '300000'");  // 5분

const sqlDir = 'prisma/migrations-postgres-manual/v1_init';
const files = [
  '01_drop_existing.sql',
  '02_create_all_tables.sql',
  '03_image_assets_checks.sql',
  '04_image_assets_indexes.sql',
  '05_image_assets_rls.sql',
  '06_travel_reviews_checks.sql',
  '07_travel_reviews_indexes.sql',
  '08_travel_reviews_rls.sql',
  '09_travel_reviews_data_restore.sql',
];

console.log('='.repeat(60));
console.log('Phase B 자동 실행 시작');
console.log('='.repeat(60));

// 실행 전 상태
const preState = await client.query(`
  SELECT table_name FROM information_schema.tables 
  WHERE table_schema = 'public' ORDER BY table_name
`);
console.log(`\n실행 전 테이블: ${preState.rows.length}개`);
preState.rows.forEach(r => console.log(`  - ${r.table_name}`));

const results = [];

for (const fname of files) {
  const fpath = path.join(sqlDir, fname);
  
  if (!fs.existsSync(fpath)) {
    console.error(`❌ 파일 없음: ${fpath}`);
    process.exit(1);
  }
  
  // UTF-8 BOM이 있으면 PG가 position 1에서 구문 오류(42601) — 선행 제거
  const sql = fs.readFileSync(fpath, 'utf-8').replace(/^\uFEFF/, '');
  const size = sql.length;
  
  console.log(`\n[${fname}] ${size} bytes`);
  console.log('-'.repeat(60));
  
  const startTime = Date.now();
  
  try {
    // 08과 09는 여러 statement 포함 가능 → 각 문장 분리 실행하면 에러 위치 파악 유리
    // 하지만 단순하게 전체 실행도 OK (pg는 multi-statement 지원)
    await client.query(sql);
    
    const elapsed = Date.now() - startTime;
    console.log(`✅ 성공 (${elapsed}ms)`);
    results.push({ file: fname, status: 'success', elapsed });
  } catch (e) {
    const elapsed = Date.now() - startTime;
    console.error(`❌ 실패 (${elapsed}ms)`);
    console.error(`에러 코드: ${e.code || 'UNKNOWN'}`);
    console.error(`메시지: ${e.message}`);
    if (e.detail) console.error(`상세: ${e.detail}`);
    if (e.hint) console.error(`힌트: ${e.hint}`);
    if (e.position) console.error(`위치: ${e.position}`);
    
    results.push({ file: fname, status: 'failed', elapsed, error: e.message });
    
    // 즉시 중단
    console.error('\n\n🚨 실행 중단. 이후 SQL은 실행하지 않음.');
    console.error('상태 복구 필요 시 백업 참고.');
    await client.end();
    process.exit(1);
  }
}

// 실행 후 상태
const postState = await client.query(`
  SELECT table_name FROM information_schema.tables 
  WHERE table_schema = 'public' ORDER BY table_name
`);
console.log(`\n실행 후 테이블: ${postState.rows.length}개`);

// 주요 테이블 행 수 검증
console.log('\n주요 테이블 행 수:');
const tablesToCheck = ['image_assets', 'travel_reviews', 'User', 'Product'];
for (const t of tablesToCheck) {
  try {
    const r = await client.query(`SELECT COUNT(*) as cnt FROM "${t}"`);
    console.log(`  ${t}: ${r.rows[0].cnt}`);
  } catch (e) {
    console.log(`  ${t}: 조회 실패 - ${e.message}`);
  }
}

// travel_reviews CHECK/RLS 검증
console.log('\ntravel_reviews 제약 확인:');
const rlsOn = await client.query(`SELECT relrowsecurity FROM pg_class WHERE relname = 'travel_reviews'`);
console.log(`  RLS 활성화: ${rlsOn.rows[0]?.relrowsecurity}`);

const policies = await client.query(`
  SELECT policyname FROM pg_policies WHERE tablename = 'travel_reviews'
`);
console.log(`  정책 개수: ${policies.rows.length}`);
policies.rows.forEach(p => console.log(`    - ${p.policyname}`));

const checks = await client.query(`
  SELECT COUNT(*) as cnt FROM pg_constraint con
  JOIN pg_class rel ON con.conrelid = rel.oid
  WHERE rel.relname = 'travel_reviews' AND con.contype = 'c'
`);
console.log(`  CHECK 제약: ${checks.rows[0].cnt}개`);

// image_assets도 확인
console.log('\nimage_assets 제약 확인:');
const imgRls = await client.query(`SELECT relrowsecurity FROM pg_class WHERE relname = 'image_assets'`);
console.log(`  RLS 활성화: ${imgRls.rows[0]?.relrowsecurity}`);

const imgChecks = await client.query(`
  SELECT COUNT(*) as cnt FROM pg_constraint con
  JOIN pg_class rel ON con.conrelid = rel.oid
  WHERE rel.relname = 'image_assets' AND con.contype = 'c'
`);
console.log(`  CHECK 제약: ${imgChecks.rows[0].cnt}개`);

const imgIndexes = await client.query(`
  SELECT COUNT(*) as cnt FROM pg_indexes WHERE tablename = 'image_assets'
`);
console.log(`  INDEX: ${imgIndexes.rows[0].cnt}개`);

await client.end();

console.log('\n' + '='.repeat(60));
console.log('Phase B 자동 실행 완료');
console.log('='.repeat(60));
console.log('\n결과 요약:');
results.forEach(r => {
  console.log(`  ${r.status === 'success' ? '✅' : '❌'} ${r.file} (${r.elapsed}ms)`);
});
