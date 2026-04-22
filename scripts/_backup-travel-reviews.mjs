import pg from 'pg'
import { config } from 'dotenv'
import fs from 'fs'
import path from 'path'

config({ path: '.env.local' })

const { Client } = pg
const url = process.env.DATABASE_URL.replace(/\?.*$/, '')
const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } })
await client.connect()

// 전체 행
const rows = await client.query('SELECT * FROM travel_reviews ORDER BY created_at')
console.log('백업할 행 수:', rows.rows.length)

// 백업 디렉토리
const backupDir = 'backups/travel_reviews'
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true })
}

const timestamp = new Date().toISOString().replace(/[:.]/g, '-')

// 1) JSON 형태 (완전 보존)
const jsonPath = path.join(backupDir, `travel_reviews_backup_${timestamp}.json`)
fs.writeFileSync(jsonPath, JSON.stringify(rows.rows, null, 2))
console.log('JSON 저장:', jsonPath)

// 2) SQL INSERT 형태 (재입력용)
const sqlPath = path.join(backupDir, `travel_reviews_backup_${timestamp}.sql`)
const columns = Object.keys(rows.rows[0] || {})
let sql = `-- travel_reviews 백업 ${timestamp}\n`
sql += `-- 행 수: ${rows.rows.length}\n\n`

for (const row of rows.rows) {
  const values = columns
    .map((col) => {
      const v = row[col]
      if (v === null) return 'NULL'
      if (typeof v === 'number') return v
      if (typeof v === 'boolean') return v
      if (v instanceof Date) return `'${v.toISOString()}'`
      if (Array.isArray(v) || (typeof v === 'object' && v !== null))
        return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`
      return `'${String(v).replace(/'/g, "''")}'`
    })
    .join(', ')

  sql += `INSERT INTO travel_reviews (${columns.map((c) => `"${c}"`).join(', ')}) VALUES (${values});\n`
}

fs.writeFileSync(sqlPath, sql)
console.log('SQL 저장:', sqlPath)

// 3) 테이블 정의 백업 (참고용)
const tableDef = await client.query(`
  SELECT column_name, data_type, is_nullable, column_default
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'travel_reviews'
  ORDER BY ordinal_position
`)

const checkConstraints = await client.query(`
  SELECT con.conname, pg_get_constraintdef(con.oid) as definition
  FROM pg_constraint con
  JOIN pg_class rel ON con.conrelid = rel.oid
  WHERE rel.relname = 'travel_reviews'
  ORDER BY con.conname
`)

const policies = await client.query(`
  SELECT policyname, cmd, qual, with_check
  FROM pg_policies
  WHERE tablename = 'travel_reviews'
`)

const indexes = await client.query(`
  SELECT indexname, indexdef
  FROM pg_indexes
  WHERE tablename = 'travel_reviews'
`)

const schemaDoc = {
  columns: tableDef.rows,
  check_constraints: checkConstraints.rows,
  rls_policies: policies.rows,
  indexes: indexes.rows,
}

const schemaPath = path.join(backupDir, `travel_reviews_schema_${timestamp}.json`)
fs.writeFileSync(schemaPath, JSON.stringify(schemaDoc, null, 2))
console.log('스키마 저장:', schemaPath)

await client.end()

console.log('\n=== 백업 완료 ===')
console.log('총 3개 파일 생성:')
console.log('  ', jsonPath)
console.log('  ', sqlPath)
console.log('  ', schemaPath)
