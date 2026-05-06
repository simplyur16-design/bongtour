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

  console.log(
    JSON.stringify(
      {
        ok: true,
        blogPostId: r.blogPostId ?? null,
        persisted: r.persisted,
        title: r.title,
        excerpt: r.excerpt,
        photoSpots: r.photoSpots,
        inquiryPath: r.inquiryPath,
        generationModel: r.generationModel,
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
