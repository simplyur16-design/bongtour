/**
 * Railway preDeploy — departureAirportLabel migration 파일 존재·내용 검증.
 * REGRESSION-FREEZE[product-departure-airport-label]
 */
import fs from 'node:fs'
import path from 'node:path'

const MIGRATION_DIR = path.join(
  process.cwd(),
  'prisma',
  'migrations',
  '20260627140000_product_departure_airport_label',
)
const MIGRATION_SQL = path.join(MIGRATION_DIR, 'migration.sql')
const SCHEMA = path.join(process.cwd(), 'prisma', 'schema.prisma')

function fail(msg: string): never {
  console.error(`verify-product-departure-airport-migration: ${msg}`)
  process.exit(1)
}

if (!fs.existsSync(MIGRATION_SQL)) {
  fail(`missing ${MIGRATION_SQL}`)
}

const sql = fs.readFileSync(MIGRATION_SQL, 'utf8')
if (!/departureAirportLabel/i.test(sql)) {
  fail('migration.sql must ALTER Product.departureAirportLabel')
}

const schema = fs.readFileSync(SCHEMA, 'utf8')
if (!/departureAirportLabel\s+String\?/i.test(schema)) {
  fail('schema.prisma must declare departureAirportLabel String?')
}

console.log('verify-product-departure-airport-migration: OK')
