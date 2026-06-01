import dotenv from 'dotenv'
import { PrismaClient } from '../prisma-gen-runtime/index.js'
dotenv.config()
dotenv.config({ path: '.env.local', override: true })

const prisma = new PrismaClient()

const cols = await prisma.$queryRaw`
  SELECT column_name
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'Product'
    AND column_name IN ('publicDetailPayloadJson', 'publicDetailPayloadBuiltAt')
`
const names = new Set(cols.map((r) => r.column_name))
console.log('existing columns:', [...names])

if (!names.has('publicDetailPayloadJson') || !names.has('publicDetailPayloadBuiltAt')) {
  const statements = [
    'ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "publicDetailPayloadJson" TEXT',
    'ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "publicDetailPayloadBuiltAt" TIMESTAMP(3)',
  ]
  for (const sql of statements) {
    await prisma.$executeRawUnsafe(sql)
  }
  console.log('applied public detail payload columns')
} else {
  console.log('columns already present — skip DDL')
}

await prisma.$disconnect()
