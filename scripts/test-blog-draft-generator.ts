/**
 * B-4-2 검증: 1건 패키지 블로그 초안 (extract + Gemini + 선택적 DB INSERT)
 *
 *   npx tsx scripts/test-blog-draft-generator.ts <productId> [monthKey]
 *   npx tsx scripts/test-blog-draft-generator.ts <productId> 2026-06 --insert
 *   npx tsx scripts/test-blog-draft-generator.ts <productId> 2026-06 --runs 5
 *
 * --insert 없으면 persist=false (DB 미기록, 파싱·본문만 stdout).
 */
import './load-env-for-scripts'

import { generateNaverBlogDraftForPackage } from '@/lib/bong-marketing/blog-draft-generator'
import { prisma } from '@/lib/prisma'

type StrategyKey = 'raw' | 'fenced' | 'braces' | 'comma_clean'

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
      'Usage: npx tsx scripts/test-blog-draft-generator.ts <productId> [monthKey] [--insert] [--runs N]',
    )
    process.exit(1)
  }

  console.log(JSON.stringify({ productId, monthKey, insert, runs }, null, 2))

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
    const r = await generateNaverBlogDraftForPackage(prisma, productId, monthKey, {
      persist: insert,
      packageOnly: true,
    })

    if (!r.ok) {
      failCount++
      failureCodes[r.code] = (failureCodes[r.code] ?? 0) + 1
      console.error(JSON.stringify({ run: i, ok: false, ...r }, null, 2))
      if (r.code === 'PARSE_FAIL') {
        const preview =
          r.geminiRawPreview ??
          (typeof r.error === 'string' ? r.error.slice(0, 500) : '')
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

    if (runs === 1) {
      const bodyBeforeCta = r.bodyWithCta.split(/\n\n---\n\n## 여행 상담\n/)[0] ?? r.bodyWithCta
      const tipsSection = bodyBeforeCta.match(/## 봉 팁\s*([\s\S]*)$/m)
      const tipTail = (tipsSection?.[1] ?? '').trim()
      const tipBullets = tipTail.match(/^\s*[-*]\s+/gm)?.length ?? 0
      const tipParagraphs = tipTail ? tipTail.split(/\n\n+/).filter((p) => p.trim().length > 40).length : 0

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
            photoSpots: r.photoSpots,
            inquiryPath: r.inquiryPath,
            generationModel: r.generationModel,
            geminiJsonParseStrategy: r.geminiJsonParseStrategy,
            bodyLenBeforeCta: bodyBeforeCta.length,
            hasDepartInfoBlock: bodyBeforeCta.includes('## 출발 정보'),
            bongTipListItemsApprox: tipBullets,
            bongTipParagraphChunksApprox: tipParagraphs,
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
