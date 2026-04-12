/**
 * 로컬 QA: preview → confirm 1회 + Product / ItineraryDay 조회 (일회성 스모크).
 * 사용: npx tsx scripts/qa-hotel-meal-confirm-flow.ts
 *
 * 붙여넣기 본문 vs HTTP canonical 키: `docs/register-supplier-extraction-spec.md` 「표기·키 SSOT (요약)」.
 */
import { readFileSync } from 'fs'
import { join } from 'path'
import { PrismaClient } from '@prisma/client'
import { SUPPLIER_ORIGIN_CANONICAL } from '@/lib/overseas-supplier-canonical-keys'

function loadEnvLocal() {
  const p = join(process.cwd(), '.env.local')
  const txt = readFileSync(p, 'utf8')
  for (const line of txt.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
    if (!m) continue
    let v = m[2].trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    if (!process.env[m[1]]) process.env[m[1]] = v
  }
}

const BASE = process.env.QA_BASE_URL || 'http://127.0.0.1:3000'
const REGISTER_URL = `${BASE.replace(/\/$/, '')}/api/travel/parse-and-register-modetour`

const PASTE = `상품코드: QA-HM-CONF-20260326
제목: 호텔식사 QA 확인용
일정: 3박4일
가격: 성인 2,000,000원

[호텔 안내]
대표 숙소: 그랜드호텔 서울
추가 숙소: 리조트호텔 제주 (2박차)

1일차 서울
숙소: 그랜드호텔 서울
식사: 아침 호텔조식 / 점심 현지식 / 저녁 한정식

2일차 이동
숙소: 리조트호텔 제주
식사: 아침 도시락 / 점심 자유 / 저녁 뷔페

3일차 제주
식사 요약: 현지 안내에 따름 (일부 끼만 제공)
`

async function main() {
  loadEnvLocal()
  const secret = process.env.ADMIN_BYPASS_SECRET
  if (!secret) throw new Error('ADMIN_BYPASS_SECRET missing')
  const cookie = `admin_bypass=${encodeURIComponent(secret)}`

  const previewBody = {
    mode: 'preview',
    text: PASTE,
    brandKey: SUPPLIER_ORIGIN_CANONICAL.modetour,
    originSource: SUPPLIER_ORIGIN_CANONICAL.modetour,
  }

  const pr = await fetch(REGISTER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify(previewBody),
  })
  const previewJson = (await pr.json()) as Record<string, unknown>
  if (!pr.ok) {
    console.error('PREVIEW_FAIL', pr.status, previewJson)
    process.exit(1)
  }
  const previewToken = previewJson.previewToken as string
  if (!previewToken) throw new Error('no previewToken')

  const confirmBody = {
    mode: 'confirm',
    text: PASTE,
    brandKey: SUPPLIER_ORIGIN_CANONICAL.modetour,
    originSource: SUPPLIER_ORIGIN_CANONICAL.modetour,
    previewToken,
  }

  const cr = await fetch(REGISTER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify(confirmBody),
  })
  const confirmJson = (await cr.json()) as Record<string, unknown>
  if (!cr.ok) {
    console.error('CONFIRM_FAIL', cr.status, confirmJson)
    process.exit(1)
  }

  const productId = confirmJson.productId as string
  const prisma = new PrismaClient()
  try {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: { itineraryDays: { orderBy: { day: 'asc' } } },
    })
    if (!product) throw new Error('product not found')

    let rawMetaObj: Record<string, unknown> = {}
    if (product.rawMeta) {
      try {
        rawMetaObj = JSON.parse(product.rawMeta) as Record<string, unknown>
      } catch {
        rawMetaObj = {}
      }
    }
    const sig = (rawMetaObj.structuredSignals as Record<string, unknown> | undefined) || {}

    const out = {
      confirmStatus: cr.status,
      productId,
      detailPath: confirmJson.detailPath,
      priceViewPath: confirmJson.priceViewPath,
      product: {
        hotelSummaryText: product.hotelSummaryText,
        hotelSummaryRaw: product.hotelSummaryRaw?.slice(0, 200) ?? null,
        structuredSignals: {
          hotelNames: sig.hotelNames,
          hotelInfoRaw: sig.hotelInfoRaw,
          hotelNoticeRaw: sig.hotelNoticeRaw,
          hotelStatusText: sig.hotelStatusText,
        },
      },
      itineraryDays: product.itineraryDays.map((d) => ({
        day: d.day,
        hotelText: d.hotelText,
        breakfastText: d.breakfastText,
        lunchText: d.lunchText,
        dinnerText: d.dinnerText,
        mealSummaryText: d.mealSummaryText,
        meals: d.meals?.slice(0, 120) ?? null,
      })),
    }

    console.log(JSON.stringify(out, null, 2))
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
