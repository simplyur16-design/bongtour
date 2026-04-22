import pg from 'pg';
import { config } from 'dotenv';
import fs from 'fs';
import path from 'path';
config({ path: '.env.local' });

const { Client } = pg;
const url = process.env.DATABASE_URL.replace(/\?.*$/, '');
const client = new Client({
  connectionString: url,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 30000, // 30초
  query_timeout: 60000, // 60초 (드라이버/버전에 따라 무시될 수 있음 → 아래 statement_timeout 병행)
});

await client.connect();
await client.query("SET statement_timeout = '120000'"); // 120초 (배치 쿼리용)

// 1. 먼저 정확한 행 수 확인
const cnt = await client.query('SELECT COUNT(*) as cnt FROM travel_reviews');
const totalRows = parseInt(cnt.rows[0].cnt, 10);
console.log(`백업 대상 행 수: ${totalRows}`);

if (totalRows === 0) {
  console.error('⚠️ 행 수가 0입니다. 중단.');
  process.exit(1);
}

// 2. 전체 행 가져오기 (배치로 나눠서)
const batchSize = 20;
const allRows = [];

for (let offset = 0; offset < totalRows; offset += batchSize) {
  const batch = await client.query(
    'SELECT * FROM travel_reviews ORDER BY created_at ASC NULLS LAST, id ASC LIMIT $1 OFFSET $2',
    [batchSize, offset]
  );
  allRows.push(...batch.rows);
  console.log(`  ${offset + batch.rows.length}/${totalRows} 행 가져옴`);
}

console.log(`\n실제 가져온 행 수: ${allRows.length}`);

if (allRows.length !== totalRows) {
  console.error(`⚠️ 행 수 불일치! 예상 ${totalRows}, 실제 ${allRows.length}`);
  process.exit(1);
}

// 3. 백업 디렉토리
const backupDir = 'backups/travel_reviews';
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

// 4. JSON 저장
const jsonPath = path.join(backupDir, `travel_reviews_v2_${timestamp}.json`);
fs.writeFileSync(jsonPath, JSON.stringify(allRows, null, 2));
console.log('JSON 저장:', jsonPath);

// 5. SQL INSERT 저장
const sqlPath = path.join(backupDir, `travel_reviews_v2_${timestamp}.sql`);
const columns = Object.keys(allRows[0]);

let sql = `-- travel_reviews 전체 백업 (v2)\n`;
sql += `-- 백업 시각: ${timestamp}\n`;
sql += `-- 행 수: ${allRows.length}\n\n`;

for (const row of allRows) {
  const values = columns.map(col => {
    const v = row[col];
    if (v === null) return 'NULL';
    if (typeof v === 'number') return v;
    if (typeof v === 'boolean') return v;
    if (v instanceof Date) return `'${v.toISOString()}'::timestamp with time zone`;
    if (Array.isArray(v) || typeof v === 'object') {
      return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
    }
    return `'${String(v).replace(/'/g, "''")}'`;
  }).join(', ');

  sql += `INSERT INTO travel_reviews (${columns.map(c => `"${c}"`).join(', ')}) VALUES (${values});\n`;
}

fs.writeFileSync(sqlPath, sql);
console.log('SQL 저장:', sqlPath);

// 6. 파일 검증: 실제 INSERT 줄 수 세기
const insertCount = (sql.match(/^INSERT INTO/gm) || []).length;
console.log(`\nINSERT 줄 수 검증: ${insertCount} (기대: ${allRows.length})`);
if (insertCount !== allRows.length) {
  console.error('⚠️ SQL INSERT 개수 불일치!');
  process.exit(1);
}

console.log('\n백업 완료 (COUNT = 가져온 행 = INSERT 줄).');
await client.end();
