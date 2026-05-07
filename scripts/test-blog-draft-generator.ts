/**
 * B-4-2 검증: 1건 패키지 블로그 초안 (extract + Gemini + 선택적 DB INSERT)
 *
 *   npx tsx scripts/test-blog-draft-generator.ts <productId> [monthKey]
 *   npx tsx scripts/test-blog-draft-generator.ts <productId> 2026-06 --insert
 *
 * --insert 없으면 persist=false (DB 미기록, 파싱·본문만 stdout).
 */
import './load-env-for-scripts'

import { generateNaverBlogDraftForPackage } from '@/lib/bong-marketing/blog-draft-generator'
import { prisma } from '@/lib/prisma'

const argv = process.argv.slice(2).filter((a) => a !== '--insert')
const insert = process.argv.includes('--insert')
const productId = argv[0]?.trim()
const monthKey = (argv[1]?.trim() || '2026-06').trim()

async function main() {
  if (!productId) {
    console.error('Usage: npx tsx scripts/test-blog-draft-generator.ts <productId> [monthKey] [--insert]')
    process.exit(1)
  }

  console.log(JSON.stringify({ productId, monthKey, insert }, null, 2))

  const r = await generateNaverBlogDraftForPackage(prisma, productId, monthKey, {
    persist: insert,
    packageOnly: true,
  })

  if (!r.ok) {
    console.error(JSON.stringify(r, null, 2))
    process.exit(1)
  }

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
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
