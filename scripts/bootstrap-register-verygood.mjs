/**
 * One-off: preview → confirm → brandId link → PATCH registered (if gates pass).
 * Requires: npm run dev, .env.local ADMIN_BYPASS_SECRET + GEMINI_API_KEY, DATABASE_URL.
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { PrismaClient } from '../prisma-gen-runtime/index.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')

function loadEnvLocal() {
  const p = path.join(root, '.env.local')
  if (!fs.existsSync(p)) return
  const raw = fs.readFileSync(p, 'utf8')
  for (const line of raw.split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq <= 0) continue
    const k = t.slice(0, eq).trim()
    let v = t.slice(eq + 1).trim()
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1)
    }
    if (process.env[k] == null || process.env[k] === '') process.env[k] = v
  }
}

loadEnvLocal()

const cookie = `admin_bypass=${process.env.ADMIN_BYPASS_SECRET ?? ''}`
const text = fs.readFileSync(path.join(__dirname, '_paste-verygood-JPP455.txt'), 'utf8')
const baseUrl = 'http://localhost:3000'

const previewBody = {
  mode: 'preview',
  originUrl:
    'https://www.verygoodtour.com/Product/PackageDetail?ProCode=JPP455-260603TW&PriceSeq=0&menuCode=101160503',
  originSource: '참좋은여행',
  travelScope: 'overseas',
  text,
}

async function main() {
  const r1 = await fetch(`${baseUrl}/api/travel/parse-and-register-verygoodtour`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify(previewBody),
  })
  const j1 = await r1.json()
  console.log('preview http', r1.status)
  if (!j1.success) {
    console.log(JSON.stringify(j1, null, 2))
    process.exit(1)
  }
  const confirmBody = {
    ...previewBody,
    mode: 'confirm',
    previewToken: j1.previewToken,
    previewContentDigest: j1.previewContentDigest,
    parsed: j1.parsed,
  }
  const r2 = await fetch(`${baseUrl}/api/travel/parse-and-register-verygoodtour`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify(confirmBody),
  })
  const j2 = await r2.json()
  console.log('confirm http', r2.status)
  if (!j2.success || !j2.productId) {
    console.log(JSON.stringify(j2, null, 2))
    process.exit(1)
  }
  console.log('productId', j2.productId)

  const prisma = new PrismaClient()
  const brand = await prisma.brand.findUnique({ where: { brandKey: 'verygoodtour' } })
  if (!brand) throw new Error('verygoodtour brand missing')
  await prisma.product.update({
    where: { id: j2.productId },
    data: { brandId: brand.id },
  })

  const d = await prisma.productDeparture.count({ where: { productId: j2.productId } })
  const it = await prisma.itineraryDay.count({ where: { productId: j2.productId } })
  console.log('ProductDeparture count', d, 'ItineraryDay count', it)
  if (d > 0 && it > 0) {
    const r3 = await fetch(`${baseUrl}/api/admin/products/${j2.productId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ registrationStatus: 'registered' }),
    })
    const j3 = await r3.json().catch(() => ({}))
    console.log('PATCH registered', r3.status, JSON.stringify(j3).slice(0, 500))
  } else {
    console.log('skip PATCH registered: need departures and itineraryDays')
  }
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
