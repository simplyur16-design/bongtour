/**
 * H-4 (재설계): Product country/city — 트리 koreanLabel이 아닌 canonical 단일 국가/도시만 자동 정정.
 * DB 마스터(Overseas*) 없이 `lib/overseas-country-canonical.ts`만 사용.
 *
 *   npm run backfill:product-from-master           # dry-run
 *   npm run backfill:product-from-master:apply    # 반영 (승인 후)
 */
import './load-env-for-scripts'

import { PrismaClient } from '@prisma/client'
import {
  canonicalCityKoForProduct,
  canonicalCountryKoForProduct,
  cityTextMatchesMultiCityLabel,
  countryTextMatchesMultiCountryLabel,
  getCountryKeyMeta,
  getNodeKeyMeta,
  getTreeLabelClassificationStats,
  hangulCityFromAsciiForNode,
  isLikelyAsciiLocationSlug,
} from '@/lib/overseas-country-canonical'

const apply = process.argv.includes('--apply')

/** multi_city 리프에서 로마자 → 대표 단일 도시(운영 SSOT) */
const MULTI_LEAF_ASCII_CITY: Record<string, Record<string, string>> = {
  'beijing-tianjin': { beijing: '북경', tianjin: '천진' },
  'shizuoka-izu': { shizuoka: '시즈오카' },
  shandong: { qingdao: '칭다오', yantai: '연태', jinan: '제난', weihai: '위해' },
}

/** 권역명이 country에만 있고 키가 없을 때 */
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

function titleStrongMultiCountry(title: string): boolean {
  const t = title.trim()
  if (!t) return false
  if (/\d+\s*개국/.test(t)) return true
  if (/\d+\s*국\b/.test(t) && /(일주|여행|투어|팩|패키지|일정)/.test(t)) return true
  if (/(두|세|네|다섯|여섯|일곱|여덟|아홉|열)\s*국|다국|복수|연계.*국|N국/i.test(t)) return true
  return false
}

/** 스포트라이트 검증용 id 부분 문자열 */
const SPOTLIGHT_SUBSTRINGS = ['cmnzu1nmw', 'cmnxx5kur', 'cmopwzncs', 'cmnwlheca', 'cmopofaq7']

function planRow(p: {
  id: string
  title: string | null
  country: string | null
  city: string | null
  countryKey: string | null
  nodeKey: string | null
}, tagCount: number): {
  nextCountry: string | null
  nextCity: string | null
  autoCountry: boolean
  autoCity: boolean
  blockRow: boolean
  operatorReasons: string[]
} {
  const ck = (p.countryKey ?? '').trim()
  const nk = (p.nodeKey ?? '').trim()
  const cm = ck ? getCountryKeyMeta(ck) : undefined
  const nm = nk ? getNodeKeyMeta(nk) : undefined

  const operatorReasons: string[] = []
  const countryLabel = (p.country ?? '').trim()
  const cityLabel = (p.city ?? '').trim()
  const asciiCi = isLikelyAsciiLocationSlug(p.city)

  if (titleStrongMultiCountry(p.title ?? '') && tagCount === 0) {
    operatorReasons.push('multi_country_suspected_no_tags')
    return {
      nextCountry: p.country,
      nextCity: p.city,
      autoCountry: false,
      autoCity: false,
      blockRow: true,
      operatorReasons,
    }
  }

  if (CHAOS_REGION_COUNTRY_LABELS.has(countryLabel) && !ck) {
    operatorReasons.push('region_label_without_master_key')
    return {
      nextCountry: p.country,
      nextCity: p.city,
      autoCountry: false,
      autoCity: false,
      blockRow: true,
      operatorReasons,
    }
  }

  if (/&/.test(p.title ?? '') && /앙코르|하롱|씨엠립|프놈펜/i.test(p.title ?? '')) {
    operatorReasons.push('multi_destination_title')
    return {
      nextCountry: p.country,
      nextCity: p.city,
      autoCountry: false,
      autoCity: false,
      blockRow: true,
      operatorReasons,
    }
  }

  let blockCountry = false
  let blockCity = false

  if (cm?.class === 'multi_country' || cm?.class === 'theme_or_other') {
    blockCountry = true
  }

  if (
    cm?.class === 'multi_country' &&
    (countryTextMatchesMultiCountryLabel(ck, p.country) ||
      (!!countryLabel && countryLabel.includes('·') && countryLabel === cm.treeLabel))
  ) {
    operatorReasons.push('multi_country_label_in_db')
    blockCountry = true
  }

  if (cityTextMatchesMultiCityLabel(nk, p.city)) {
    operatorReasons.push('multi_city_label_in_db')
    blockCity = true
  }

  if (nm?.class === 'multi_city') {
    blockCity = true
  }

  let nextCountry = p.country
  let nextCity = p.city
  let autoCountry = false
  let autoCity = false

  const canonCo = canonicalCountryKoForProduct(ck)
  if (!blockCountry && canonCo && (isLikelyAsciiLocationSlug(p.country) || !countryLabel || countryLabel !== canonCo)) {
    nextCountry = canonCo
    autoCountry = true
  }

  if (nk && !blockCity) {
    const fromAscii = hangulCityFromAsciiForNode(nk, p.city)
    if (fromAscii && (asciiCi || !cityLabel || cityLabel !== fromAscii)) {
      nextCity = fromAscii
      autoCity = true
    }
    if (!autoCity) {
      const canonCi = canonicalCityKoForProduct(nk)
      if (canonCi && (asciiCi || !cityLabel || cityLabel !== canonCi)) {
        nextCity = canonCi
        autoCity = true
      }
    }
  }

  if (nk) {
    const table = MULTI_LEAF_ASCII_CITY[nk]
    if (table) {
      const low = (p.city ?? '').trim().toLowerCase()
      const hit = table[low]
      if (hit && (p.city ?? '').trim() !== hit) {
        nextCity = hit
        autoCity = true
      }
    }
    if (nk === 'shandong' && cityLabel === '청도') {
      nextCity = '칭다오'
      autoCity = true
    }
  }

  if (ck === 'france' && nk === 'fr' && !(p.city ?? '').trim() && /파리/i.test(p.title ?? '')) {
    nextCity = '파리'
    autoCity = true
  }

  if (
    nk === 'hanoi-halong' &&
    isLikelyAsciiLocationSlug(p.city) &&
    (p.city ?? '').trim().toLowerCase() === 'hanoi'
  ) {
    nextCity = '하노이'
    autoCity = true
  }

  return {
    nextCountry,
    nextCity,
    autoCountry,
    autoCity,
    blockRow: false,
    operatorReasons,
  }
}

async function main() {
  const prisma = new PrismaClient()
  try {
    const stats = getTreeLabelClassificationStats()
    const tagAgg = await prisma.productCountryTag.groupBy({ by: ['productId'], _count: { _all: true } })
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

    let autoFixCountryRows = 0
    let autoFixCityRows = 0
    const operatorReasonCounts = new Map<string, number>()

    const updates: Array<{ id: string; country: string | null; city: string | null }> = []

    let operatorQueueRows = 0

    for (const p of products) {
      const tagCount = tagCountByProduct.get(p.id) ?? 0
      const plan = planRow(p, tagCount)

      if (plan.blockRow) {
        operatorQueueRows++
        for (const r of plan.operatorReasons) {
          operatorReasonCounts.set(r, (operatorReasonCounts.get(r) ?? 0) + 1)
        }
        if (chaosSamples.length < 80) {
          chaosSamples.push({
            id: p.id,
            title: (p.title ?? '').slice(0, 80),
            field: 'operator',
            before: `${p.country ?? ''} / ${p.city ?? ''}`,
            after: null,
            reason: plan.operatorReasons.join(','),
          })
        }
        continue
      }

      if (plan.operatorReasons.length > 0) {
        operatorQueueRows++
        for (const r of plan.operatorReasons) {
          operatorReasonCounts.set(r, (operatorReasonCounts.get(r) ?? 0) + 1)
        }
      }

      const countryChanged = plan.autoCountry && plan.nextCountry !== p.country
      const cityChanged = plan.autoCity && plan.nextCity !== p.city

      if (countryChanged) {
        autoFixCountryRows++
        if (autoSamples.length < 80) {
          autoSamples.push({
            id: p.id,
            title: (p.title ?? '').slice(0, 60),
            field: 'country',
            before: p.country,
            after: plan.nextCountry,
          })
        }
      }
      if (cityChanged) {
        autoFixCityRows++
        if (autoSamples.length < 80) {
          autoSamples.push({
            id: p.id,
            title: (p.title ?? '').slice(0, 60),
            field: 'city',
            before: p.city,
            after: plan.nextCity,
          })
        }
      }

      if (countryChanged || cityChanged) {
        updates.push({ id: p.id, country: plan.nextCountry, city: plan.nextCity })
      }
    }

    const spotlight: Array<{
      substring: string
      id: string | null
      title: string | null
      keys: { countryKey: string | null; nodeKey: string | null }
      current: { country: string | null; city: string | null }
      planned: { country: string | null; city: string | null }
      autoCountry: boolean
      autoCity: boolean
      operatorReasons: string[]
      blockRow: boolean
    }> = []

    for (const sub of SPOTLIGHT_SUBSTRINGS) {
      const row = products.find((x) => x.id.includes(sub)) ?? null
      if (!row) {
        spotlight.push({
          substring: sub,
          id: null,
          title: null,
          keys: { countryKey: null, nodeKey: null },
          current: { country: null, city: null },
          planned: { country: null, city: null },
          autoCountry: false,
          autoCity: false,
          operatorReasons: ['not_found_in_db'],
          blockRow: true,
        })
        continue
      }
      const tagCount = tagCountByProduct.get(row.id) ?? 0
      const plan = planRow(row, tagCount)
      spotlight.push({
        substring: sub,
        id: row.id,
        title: row.title,
        keys: { countryKey: row.countryKey, nodeKey: row.nodeKey },
        current: { country: row.country, city: row.city },
        planned: { country: plan.nextCountry, city: plan.nextCity },
        autoCountry: plan.autoCountry,
        autoCity: plan.autoCity,
        operatorReasons: plan.operatorReasons,
        blockRow: plan.blockRow,
      })
    }

    const summary = {
      mode: apply ? 'apply' : 'dry-run',
      treeLabelStats: stats,
      canonicalMappingRows: {
        singleCountryKeys: stats.singleCountryMappingCount,
        singleCityNodes: stats.singleCityMappingCount,
      },
      productsScanned: products.length,
      autoFixCountryRows,
      autoFixCityRows,
      autoFixProducts: updates.length,
      operatorQueueByReason: Object.fromEntries(operatorReasonCounts),
      operatorQueueRowCount: operatorQueueRows,
      productCountryTagProductsWithAnyTag: tagAgg.length,
    }

    console.log(JSON.stringify(summary, null, 2))
    console.log('--- spotlight (5 cases) ---')
    console.log(JSON.stringify(spotlight, null, 2))
    console.log('--- auto samples (up to 80) ---')
    console.log(JSON.stringify(autoSamples, null, 2))
    console.log('--- operator samples (up to 80) ---')
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
