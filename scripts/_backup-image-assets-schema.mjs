import pg from 'pg'
import { config } from 'dotenv'
import fs from 'fs'
import path from 'path'

config({ path: '.env.local' })

const { Client } = pg
const url = process.env.DATABASE_URL.replace(/\?.*$/, '')
const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } })
await client.connect()

const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
const backupDir = 'backups/image_assets'
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true })
}

const tableDef = await client.query(`
  SELECT column_name, data_type, is_nullable, column_default
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'image_assets'
  ORDER BY ordinal_position
`)

const checks = await client.query(`
  SELECT con.conname, pg_get_constraintdef(con.oid) as definition
  FROM pg_constraint con
  JOIN pg_class rel ON con.conrelid = rel.oid
  WHERE rel.relname = 'image_assets' AND con.contype = 'c'
  ORDER BY con.conname
`)

const policies = await client.query(`
  SELECT policyname, cmd, qual, with_check
  FROM pg_policies
  WHERE tablename = 'image_assets'
`)

const indexes = await client.query(`
  SELECT indexname, indexdef
  FROM pg_indexes
  WHERE tablename = 'image_assets'
  ORDER BY indexname
`)

const rls = await client.query(`
  SELECT relname, relrowsecurity, relforcerowsecurity
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = 'image_assets'
`)

const checkCreateSql = checks.rows.map(
  (r) => `ALTER TABLE "image_assets" ADD CONSTRAINT "${r.conname}" ${r.definition};`,
)

const indexCreateSql = indexes.rows.map((r) => `${r.indexdef};`)

const schemaDoc = {
  exported_at: timestamp,
  rls: {
    relrowsecurity: rls.rows[0]?.relrowsecurity ?? null,
    relforcerowsecurity: rls.rows[0]?.relforcerowsecurity ?? null,
    policy_count: policies.rows.length,
    policies: policies.rows,
  },
  columns: tableDef.rows,
  check_constraints: checks.rows.map((r) => ({
    name: r.conname,
    definition: r.definition,
    create_sql: `ALTER TABLE "image_assets" ADD CONSTRAINT "${r.conname}" ${r.definition};`,
  })),
  indexes: indexes.rows.map((r) => ({
    name: r.indexname,
    create_sql: `${r.indexdef};`,
  })),
  check_create_statements: checkCreateSql,
  index_create_statements: indexCreateSql,
}

const schemaPath = path.join(backupDir, `schema_${timestamp}.json`)
fs.writeFileSync(schemaPath, JSON.stringify(schemaDoc, null, 2))
console.log('image_assets 스키마 저장:', schemaPath)

await client.end()
