/**
 * B-4-3 검증: 자유여행(airtel/private) 블로그 초안
 *
 *   npx tsx scripts/test-airtel-blog-draft-generator.ts <productId> [monthKey]
 *   npx tsx scripts/test-airtel-blog-draft-generator.ts <productId> 2026-06 --insert
 *   npx tsx scripts/test-airtel-blog-draft-generator.ts <productId> 2026-06 --runs 5
 *
 * --insert 없으면 persist=false (DB 미기록).
 */
import './load-env-for-scripts'

import { getAirtelBlogContext } from '@/lib/bong-marketing/airtel-blog-context'
import { generateNaverBlogDraftForAirtel } from '@/lib/bong-marketing/blog-draft-generator'
import { extractProductGeoMeta } from '@/lib/bong-marketing/product-extractor'
import { prisma } from '@/lib/prisma'

type StrategyKey = 'raw' | 'fenced' | 'braces' | 'comma_clean'

function scheduleExcerptPreview(schedule: string | null): string | null {
  const raw = (schedule ?? '').trim()
  if (!raw) return null
  return raw.length > 1200 ? `${raw.slice(0, 1200)}…` : raw
}

function parseCli(argv: string[]): {
  insert: boolean
  runs: number
  positional: string[]
} {
  let insert = false
  let runs = 1
  const positional: string[] = []
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--insert') insert = true
    else if (a === '--runs') {
      const n = Number(argv[++i])
      runs = Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1
    } else {
      positional.push(a)
    }
  }
  return { insert, runs, positional }
}

async function main() {
  const argv = process.argv.slice(2)
  const { insert, runs, positional } = parseCli(argv)
  const productId = positional[0]?.trim()
  const monthKey = (positional[1]?.trim() || '2026-06').trim()

  if (!productId) {
    console.error(
      'Usage: npx tsx scripts/test-airtel-blog-draft-generator.ts <productId> [monthKey] [--insert] [--runs N]',
    )
    process.exit(1)
  }

  console.log(JSON.stringify({ productId, monthKey, insert, runs }, null, 2))

  const ctx = await getAirtelBlogContext(prisma, productId, monthKey)
  if (ctx) {
    const geo = await extractProductGeoMeta(productId, {
      utmSource: 'naver_blog',
      utmContent: 'final_cta',
      campaignMonthKey: monthKey,
    })
    const payloadPreview = {
      geo,
      campaignMonthKey: monthKey,
      product: {
        title: ctx.row.title,
        summary: ctx.row.summary,
        benefitSummary: ctx.row.benefitSummary,
        duration: ctx.row.duration,
        tripDays: ctx.row.tripDays,
        tripNights: ctx.row.tripNights,
        productType: ctx.row.productType,
        scheduleExcerpt: scheduleExcerptPreview(ctx.row.schedule),
      },
      airtelMeta: ctx.airtelMeta,
      bongSpotsByCity: ctx.bongSpotsByCity,
      bongFoodsByCity: ctx.bongFoodsByCity,
      bongTipsByCityOrCountry: ctx.bongTipsByCityOrCountry,
      seasonalNotesForMonth: ctx.seasonalNotesForMonth,
    }
    console.log('[airtel payload preview keys]', Object.keys(payloadPreview))
    const payloadJson = JSON.stringify(payloadPreview, null, 2)
    console.log(payloadJson.slice(0, 3500))
    if (payloadJson.length > 3500) {
      console.log('…(payload JSON truncated for stdout)')
    }
    console.log(
      '[bong counts]',
      JSON.stringify(
        {
          spots: ctx.bongSpotsByCity.length,
          foods: ctx.bongFoodsByCity.length,
          tips: ctx.bongTipsByCityOrCountry.length,
          seasonalNotes: ctx.seasonalNotesForMonth.length,
        },
        null,
        2,
      ),
    )
    console.log('[utm inquiry URL]', geo.inquiryUrl)
  } else {
    console.warn('[getAirtelBlogContext] null (상품 없음 또는 monthKey 월 파싱 실패)')
  }

  const strategyCounts: Record<StrategyKey, number> = {
    raw: 0,
    fenced: 0,
    braces: 0,
    comma_clean: 0,
  }
  let unknownStrategySuccess = 0
  let okCount = 0
  let failCount = 0
  const failureCodes: Record<string, number> = {}

  for (let i = 1; i <= runs; i++) {
    const r = await generateNaverBlogDraftForAirtel(prisma, productId, monthKey, {
      persist: insert,
    })

    if (!r.ok) {
      failCount++
      failureCodes[r.code] = (failureCodes[r.code] ?? 0) + 1
      console.error(JSON.stringify({ run: i, ok: false, ...r }, null, 2))
      if (r.code === 'PARSE_FAIL') {
        const preview =
          r.geminiRawPreview ?? (typeof r.error === 'string' ? r.error.slice(0, 500) : '')
        console.error(`[PARSE_FAIL raw head run=${i}]\n${preview}`)
      }
      continue
    }

    okCount++
    const s = r.geminiJsonParseStrategy
    if (s === 'raw' || s === 'fenced' || s === 'braces' || s === 'comma_clean') {
      strategyCounts[s]++
    } else {
      unknownStrategySuccess++
    }

    const bodyBeforeCta = r.bodyWithCta.split(/\n\n---\n\n## 여행 상담\n/)[0] ?? r.bodyWithCta

    if (runs === 1) {
      console.log(
        JSON.stringify(
          {
            ok: true,
            blogPostId: r.blogPostId ?? null,
            persisted: r.persisted,
            title: r.title,
            titleLen: r.title.length,
            excerpt: r.excerpt,
            excerptLen: (r.excerpt ?? '').length,
            recommendedSpots: r.recommendedSpots,
            recommendedFoods: r.recommendedFoods,
            inquiryPath: r.inquiryPath,
            generationModel: r.generationModel,
            geminiJsonParseStrategy: r.geminiJsonParseStrategy,
            bodyLenBeforeCta: bodyBeforeCta.length,
            hasDepartInfoBlock: bodyBeforeCta.includes('## 출발 정보'),
            bodyPreview: r.bodyWithCta.slice(0, 1200) + (r.bodyWithCta.length > 1200 ? '…' : ''),
          },
          null,
          2,
        ),
      )
    }
  }

  if (runs > 1) {
    console.log(
      JSON.stringify(
        {
          summary: {
            runs,
            okCount,
            failCount,
            failureCodes,
            strategyCountsOnSuccess: strategyCounts,
            unknownStrategySuccess,
          },
        },
        null,
        2,
      ),
    )
  }

  await prisma.$disconnect()

  if (failCount > 0) {
    process.exit(1)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
