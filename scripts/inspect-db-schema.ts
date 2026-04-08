/**
 * SQLite prisma/dev.db 실제 구조 점검 (PRAGMA 기반)
 * 실행: npx tsx scripts/inspect-db-schema.ts
 */
import { PrismaClient } from '@prisma/client'

const url = process.env.DATABASE_URL || 'file:./prisma/dev.db'
const prisma = new PrismaClient({ datasources: { db: { url } } })

type PragmaTableInfo = { cid: number; name: string; type: string; notnull: number; dflt_value: string | null; pk: number }
type PragmaIndexList = { seq: number; name: string; unique: number; origin: string }
type PragmaIndexInfo = { seqno: number; cid: number; name: string }

async function main() {
  const out: Record<string, unknown> = {}

  // Product 테이블 컬럼
  const productCols = await prisma.$queryRawUnsafe<PragmaTableInfo[]>("PRAGMA table_info(Product)")
  out.Product_columns = productCols

  // Product 인덱스 목록
  const productIndexList = await prisma.$queryRawUnsafe<PragmaIndexList[]>("PRAGMA index_list(Product)")
  out.Product_index_list = productIndexList

  // Product 각 인덱스의 컬럼
  for (const idx of productIndexList) {
    const info = await prisma.$queryRawUnsafe<PragmaIndexInfo[]>(`PRAGMA index_info("${idx.name}")`)
    out[`Product_index_${idx.name}`] = info
  }

  // ItineraryDay 테이블 존재 및 컬럼
  try {
    const itineraryDayCols = await prisma.$queryRawUnsafe<PragmaTableInfo[]>("PRAGMA table_info(ItineraryDay)")
    out.ItineraryDay_columns = itineraryDayCols
    const idIndexList = await prisma.$queryRawUnsafe<PragmaIndexList[]>("PRAGMA index_list(ItineraryDay)")
    out.ItineraryDay_index_list = idIndexList
    for (const idx of idIndexList) {
      const info = await prisma.$queryRawUnsafe<PragmaIndexInfo[]>(`PRAGMA index_info("${idx.name}")`)
      out[`ItineraryDay_index_${idx.name}`] = info
    }
  } catch (e) {
    out.ItineraryDay_error = String(e)
  }

  // ProductDeparture 테이블
  try {
    const pdCols = await prisma.$queryRawUnsafe<PragmaTableInfo[]>("PRAGMA table_info(ProductDeparture)")
    out.ProductDeparture_columns = pdCols
    const pdIndexList = await prisma.$queryRawUnsafe<PragmaIndexList[]>("PRAGMA index_list(ProductDeparture)")
    out.ProductDeparture_index_list = pdIndexList
    for (const idx of pdIndexList) {
      const info = await prisma.$queryRawUnsafe<PragmaIndexInfo[]>(`PRAGMA index_info("${idx.name}")`)
      out[`ProductDeparture_index_${idx.name}`] = info
    }
  } catch (e) {
    out.ProductDeparture_error = String(e)
  }

  // SQLite 마스터: 모든 테이블 목록
  const tables = await prisma.$queryRawUnsafe<{ name: string }[]>("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
  out.all_tables = tables

  const toJson = (v: unknown): unknown =>
    typeof v === 'bigint' ? Number(v) : Array.isArray(v) ? v.map(toJson) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, v2]) => [k, toJson(v2)])) : v
  console.log(JSON.stringify(toJson(out), null, 2))
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
