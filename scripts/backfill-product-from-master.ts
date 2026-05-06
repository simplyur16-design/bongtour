/**
 * H-4: 등록·해외 상품의 country/city 표기를 DB 마스터 한글 라벨로 자동 정정(가능한 행만).
 *
 *   npm run backfill:product-from-master           # dry-run
 *   npm run backfill:product-from-master:apply    # 반영
 */
import './load-env-for-scripts'

import { PrismaClient } from '@prisma/client'

const apply = process.argv.includes('--apply')

const ASCII_SLUG = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/i
function isLikelyAsciiLocationSlug(s: string | null | undefined): boolean {
  if (!s || !s.trim()) return false
  return ASCII_SLUG.test(s.trim())
}

/** 권역·광역 라벨이 country 컬럼에 들어간 카오스(운영자 정정 대상) */
const CHAOS_REGION_COUNTRY_LABELS = new Set([
  '동유럽',
  '북유럽',
  '서유럽',
  '남유럽',
  '중유럽',
  '동남아',
  '동남아시아',
  '중동',
  '중동·아프리카',
  '아프리카',
  '북미',
  '남미',
  '남태평양',
  '대양주',
  '오세아니아',
  '중앙아시아',
  '중국권',
  '남태평양·대양주',
  '유럽',
  '아시아',
])

function titleSuggestsMultiCountry(title: string): boolean {
  const t = title.trim()
  if (!t) return false
  if (/\d+\s*개국/.test(t)) return true
  if (/\d+\s*국\b/.test(t) && /(일주|여행|투어|팩|패키지|일정)/.test(t)) return true
  if (/(두|세|네|다섯|여섯|일곱|여덟|아홉|열)\s*국|다국|복수|연계.*국|N국/i.test(t)) return true
  return false
}

function labelNeedsFix(dbLabel: string, current: string | null): boolean {
  const cur = (current ?? '').trim()
  if (!cur) return true
  if (isLikelyAsciiLocationSlug(cur)) return true
  return cur !== dbLabel.trim()
}

async function main() {
  const prisma = new PrismaClient()
  try {
    const [countryRows, nodeRows, tagAgg] = await Promise.all([
      prisma.overseasCountry.findMany({ select: { countryKey: true, koreanLabel: true } }),
      prisma.overseasNode.findMany({ select: { nodeKey: true, koreanLabel: true } }),
      prisma.productCountryTag.groupBy({ by: ['productId'], _count: { _all: true } }),
    ])

    if (countryRows.length === 0) {
      console.log(JSON.stringify({ error: 'overseas_master_empty', hint: 'seed:overseas-tree:apply' }, null, 2))
      process.exit(1)
    }

    const countryKr = new Map(countryRows.map((c) => [c.countryKey, c.koreanLabel]))
    const nodeKr = new Map(nodeRows.map((n) => [n.nodeKey, n.koreanLabel]))
    const tagCountByProduct = new Map(tagAgg.map((t) => [t.productId, t._count._all]))

    const products = await prisma.product.findMany({
      where: { registrationStatus: 'registered', travelScope: 'overseas' },
      select: {
        id: true,
        title: true,
        country: true,
        city: true,
        countryKey: true,
        nodeKey: true,
      },
    })

    type Sample = { id: string; title: string; field: string; before: string | null; after: string | null }
    const autoSamples: Sample[] = []
    const chaosSamples: Array<Sample & { reason: string }> = []

    let autoCountry = 0
    let autoCity = 0
    let chaosRegion = 0
    let chaosMultiNoTags = 0

    const updates: Array<{
      id: string
      country: string | null
      city: string | null
    }> = []

    for (const p of products) {
      const ck = (p.countryKey ?? '').trim()
      const nk = (p.nodeKey ?? '').trim()
      const masterCountry = ck ? countryKr.get(ck) : undefined
      const masterCity = nk ? nodeKr.get(nk) : undefined

      const countryLabel = (p.country ?? '').trim()
      const tagCount = tagCountByProduct.get(p.id) ?? 0
      const multiChaos = titleSuggestsMultiCountry(p.title ?? '') && tagCount === 0

      if (multiChaos) {
        chaosMultiNoTags++
        if (chaosSamples.length < 80) {
          chaosSamples.push({
            id: p.id,
            title: (p.title ?? '').slice(0, 80),
            field: 'multi_title',
            before: p.country,
            after: null,
            reason: 'multi_country_suspected_no_tags',
          })
        }
        continue
      }

      const cantMapCountry = !ck || !masterCountry
      const regionChaosQueue = CHAOS_REGION_COUNTRY_LABELS.has(countryLabel) && cantMapCountry
      if (regionChaosQueue) {
        chaosRegion++
        if (chaosSamples.length < 80) {
          chaosSamples.push({
            id: p.id,
            title: (p.title ?? '').slice(0, 80),
            field: 'country/region',
            before: p.country,
            after: null,
            reason: 'region_label_without_master_key',
          })
        }
        continue
      }

      let nextCountry = p.country
      let nextCity = p.city
      let changed = false

      if (masterCountry && labelNeedsFix(masterCountry, p.country)) {
        autoCountry++
        nextCountry = masterCountry
        changed = true
        if (autoSamples.length < 80) {
          autoSamples.push({
            id: p.id,
            title: (p.title ?? '').slice(0, 60),
            field: 'country',
            before: p.country,
            after: masterCountry,
          })
        }
      }

      if (nk && masterCity && labelNeedsFix(masterCity, p.city)) {
        autoCity++
        nextCity = masterCity
        changed = true
        if (autoSamples.length < 80) {
          autoSamples.push({
            id: p.id,
            title: (p.title ?? '').slice(0, 60),
            field: 'city',
            before: p.city,
            after: masterCity,
          })
        }
      }

      if (changed) {
        updates.push({ id: p.id, country: nextCountry, city: nextCity })
      }
    }

    const summary = {
      mode: apply ? 'apply' : 'dry-run',
      productsScanned: products.length,
      autoFixCountryRows: autoCountry,
      autoFixCityRows: autoCity,
      autoFixProducts: updates.length,
      operatorQueueRegionLikeCountry: chaosRegion,
      operatorQueueMultiTitleNoTags: chaosMultiNoTags,
      productCountryTagProductsWithAnyTag: tagAgg.length,
    }

    console.log(JSON.stringify(summary, null, 2))
    console.log('--- auto samples (up to 80) ---')
    console.log(JSON.stringify(autoSamples, null, 2))
    console.log('--- chaos / operator samples (up to 80) ---')
    console.log(JSON.stringify(chaosSamples, null, 2))

    if (apply && updates.length > 0) {
      await prisma.$transaction(
        updates.map((u) =>
          prisma.product.update({
            where: { id: u.id },
            data: { country: u.country, city: u.city },
          }),
        ),
      )
    }
  } finally {
    await prisma.$disconnect()
  }
}

void main().catch((e) => {
  console.error(e)
  process.exit(1)
})
