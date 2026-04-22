import pg from 'pg'
import { config } from 'dotenv'

config({ path: '.env.local' })

const { Client } = pg
const url = process.env.DATABASE_URL.replace(/\?.*$/, '')
const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } })
await client.connect()

const r = await client.query(`
  SELECT column_name, data_type, is_nullable, column_default
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'image_assets'
  ORDER BY ordinal_position
`)

console.log('Supabase image_assets 컬럼 (총 ' + r.rows.length + '개):')
r.rows.forEach((c) => {
  console.log(
    `  ${c.column_name.padEnd(30)} ${c.data_type.padEnd(20)} ${c.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'}`,
  )
})

await client.end()
