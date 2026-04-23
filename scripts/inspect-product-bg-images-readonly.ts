/**
 * Read-only: Product 대표 이미지(bgImage*) 실측 집계.
 * 실행: npx tsx scripts/inspect-product-bg-images-readonly.ts
 */
import './load-env-for-scripts'
import { PrismaClient } from '../prisma-gen-runtime'

const prisma = new PrismaClient()

function pct(n: number, d: number): string {
  if (!d) return '0.0%'
  return `${((100 * n) / d).toFixed(1)}%`
}

function trimLen(s: string | null | undefined): number {
  return (s ?? '').trim().length
}

async function main(): Promise<void> {
  const base = {
    AND: [{ bgImageUrl: { not: null } }, { NOT: { bgImageUrl: '' } }] as const,
  }

  const totalWithImage = await prisma.product.count({ where: base })

  /** 파일명 `...-pexels-123.webp` 때문에 Supabase URL에도 "pexels"가 들어갈 수 있음 → CDN 호스트만 별도 집계 */
  const pexelsCdnHost = await prisma.product.count({
    where: {
      AND: [
        ...base.AND,
        {
          OR: [
            { bgImageUrl: { contains: 'images.pexels.com', mode: 'insensitive' as const } },
            { bgImageUrl: { contains: 'www.pexels.com/photo', mode: 'insensitive' as const } },
          ],
        },
      ],
    },
  })

  const [pexelsSubstring, supabaseInUrl, ncloudInUrl, uploadsRelative] = await Promise.all([
    prisma.product.count({
      where: { AND: [...base.AND, { bgImageUrl: { contains: 'pexels', mode: 'insensitive' as const } }] },
    }),
    prisma.product.count({
      where: { AND: [...base.AND, { bgImageUrl: { contains: 'supabase', mode: 'insensitive' as const } }] },
    }),
    prisma.product.count({
      where: { AND: [...base.AND, { bgImageUrl: { contains: 'ncloud', mode: 'insensitive' as const } }] },
    }),
    prisma.product.count({
      where: { AND: [...base.AND, { bgImageUrl: { startsWith: '/' } }] },
    }),
  ])

  const withStoragePath = await prisma.product.count({
    where: { AND: [...base.AND, { bgImageStoragePath: { not: null } }, { NOT: { bgImageStoragePath: '' } }] },
  })

  const [hasPhotographer, hasSourceUrl, hasPlaceName, hasCityName, hasSource, hasExternalId, hasRehostLabel] =
    await Promise.all([
      prisma.product.count({
        where: {
          AND: [
            ...base.AND,
            { bgImagePhotographer: { not: null } },
            { NOT: { bgImagePhotographer: '' } },
          ],
        },
      }),
      prisma.product.count({
        where: {
          AND: [...base.AND, { bgImageSourceUrl: { not: null } }, { NOT: { bgImageSourceUrl: '' } }],
        },
      }),
      prisma.product.count({
        where: {
          AND: [...base.AND, { bgImagePlaceName: { not: null } }, { NOT: { bgImagePlaceName: '' } }],
        },
      }),
      prisma.product.count({
        where: {
          AND: [...base.AND, { bgImageCityName: { not: null } }, { NOT: { bgImageCityName: '' } }],
        },
      }),
      prisma.product.count({
        where: {
          AND: [...base.AND, { bgImageSource: { not: null } }, { NOT: { bgImageSource: '' } }],
        },
      }),
      prisma.product.count({
        where: {
          AND: [...base.AND, { bgImageExternalId: { not: null } }, { NOT: { bgImageExternalId: '' } }],
        },
      }),
      prisma.product.count({
        where: {
          AND: [
            ...base.AND,
            { bgImageRehostSearchLabel: { not: null } },
            { NOT: { bgImageRehostSearchLabel: '' } },
          ],
        },
      }),
    ])

  const [hasPublicSeoLine, hasPublicSeoKeywords] = await Promise.all([
    prisma.product.count({
      where: {
        AND: [...base.AND, { publicImageHeroSeoLine: { not: null } }, { NOT: { publicImageHeroSeoLine: '' } }],
      },
    }),
    prisma.product.count({
      where: {
        AND: [
          ...base.AND,
          { publicImageHeroSeoKeywordsJson: { not: null } },
          { NOT: { publicImageHeroSeoKeywordsJson: '' } },
        ],
      },
    }),
  ])

  const allCoreSeo = await prisma.product.count({
    where: {
      AND: [
        ...base.AND,
        { bgImagePhotographer: { not: null } },
        { NOT: { bgImagePhotographer: '' } },
        { bgImageSourceUrl: { not: null } },
        { NOT: { bgImageSourceUrl: '' } },
        { bgImagePlaceName: { not: null } },
        { NOT: { bgImagePlaceName: '' } },
        { bgImageCityName: { not: null } },
        { NOT: { bgImageCityName: '' } },
        { bgImageSource: { not: null } },
        { NOT: { bgImageSource: '' } },
      ],
    },
  })

  type BucketRow = { bucket: string; c: bigint }
  const bucketRows = await prisma.$queryRaw<BucketRow[]>`
    SELECT bucket, COUNT(*)::bigint AS c
    FROM (
      SELECT
        CASE
          WHEN "bgImageUrl" ILIKE '%pexels%' THEN 'pexels_url'
          WHEN "bgImageUrl" ILIKE '%ncloud%' THEN 'ncloud_url'
          WHEN "bgImageUrl" ILIKE '%supabase%' THEN 'supabase_url'
          WHEN "bgImageUrl" LIKE '/%' THEN 'relative_path'
          WHEN "bgImageUrl" ILIKE 'http%' THEN 'other_http'
          ELSE 'other'
        END AS bucket
      FROM "Product"
      WHERE "bgImageUrl" IS NOT NULL AND length(trim("bgImageUrl")) > 0
    ) t
    GROUP BY bucket
    ORDER BY c DESC
  `

  const pickSamples = async (label: string, extraWhere: object, take: number) => {
    const list = await prisma.product.findMany({
      where: { AND: [...base.AND, extraWhere] },
      select: {
        id: true,
        originSource: true,
        originCode: true,
        title: true,
        bgImageUrl: true,
        bgImageSource: true,
        bgImageSourceUrl: true,
        bgImagePhotographer: true,
        bgImagePlaceName: true,
        bgImageCityName: true,
        bgImageExternalId: true,
        bgImageStoragePath: true,
        bgImageRehostSearchLabel: true,
        bgImageRehostedAt: true,
        publicImageHeroSeoLine: true,
      },
      take,
      orderBy: { updatedAt: 'desc' },
    })
    return { label, list }
  }

  const samplesPexels = await pickSamples(
    'pexels_cdn_host',
    {
      OR: [
        { bgImageUrl: { contains: 'images.pexels.com', mode: 'insensitive' } },
        { bgImageUrl: { contains: 'www.pexels.com/photo', mode: 'insensitive' } },
      ],
    },
    5
  )
  const samplesSupabase = await pickSamples(
    'supabase_in_url',
    { bgImageUrl: { contains: 'supabase', mode: 'insensitive' } },
    4
  )
  const samplesNcloud = await pickSamples('ncloud_in_url', { bgImageUrl: { contains: 'ncloud', mode: 'insensitive' } }, 3)
  const samplesMixed = await pickSamples('other_http_no_pexels_supabase_ncloud', {
    AND: [
      { bgImageUrl: { startsWith: 'http' } },
      { NOT: { bgImageUrl: { contains: 'pexels', mode: 'insensitive' } } },
      { NOT: { bgImageUrl: { contains: 'supabase', mode: 'insensitive' } } },
      { NOT: { bgImageUrl: { contains: 'ncloud', mode: 'insensitive' } } },
    ],
  }, 3)

  console.log('\n=== Product bgImage 실측 (read-only) ===\n')
  console.log(`1) 이미지 URL이 비어 있지 않은 상품: ${totalWithImage}`)
  console.log(
    `2) Pexels CDN URL( images.pexels.com 또는 www.pexels.com/photo ): ${pexelsCdnHost}  (참고: URL 아무 곳에 "pexels" 문자열만: ${pexelsSubstring} — 파일명에 -pexels- 포함 시 과대)` 
  )
  console.log(`3) bgImageUrl에 "supabase" 포함(대소문자 무시): ${supabaseInUrl}`)
  console.log(`4) bgImageUrl에 "ncloud" 포함(대소문자 무시): ${ncloudInUrl}`)
  console.log(`   · 로컬 상대경로(/로 시작): ${uploadsRelative}`)
  console.log(
    `   · bgImageStoragePath 채워짐(재호스팅·내부 객체 키 추적): ${withStoragePath} (${pct(withStoragePath, totalWithImage)} of 이미지 있음)`
  )
  console.log('\n--- URL 단일 버킷(우선순위: pexels > ncloud > supabase > 상대경로 > 기타 http) ---')
  for (const r of bucketRows) {
    console.log(`   ${r.bucket}: ${String(r.c)}`)
  }

  console.log('\n=== SEO·출처 메타 저장률 (분모: 이미지 있는 상품 전체) ===\n')
  const lines: [string, number][] = [
    ['bgImagePhotographer (작가)', hasPhotographer],
    ['bgImageSourceUrl (출처 페이지 URL)', hasSourceUrl],
    ['bgImagePlaceName (장소명)', hasPlaceName],
    ['bgImageCityName (도시명)', hasCityName],
    ['bgImageSource (출처 라벨)', hasSource],
    ['bgImageExternalId (외부 사진 ID 등)', hasExternalId],
    ['bgImageRehostSearchLabel (검색·라벨)', hasRehostLabel],
    ['publicImageHeroSeoLine (공개 SEO 한 줄)', hasPublicSeoLine],
    ['publicImageHeroSeoKeywordsJson', hasPublicSeoKeywords],
    ['위 5종 동시 충족(작가+sourceUrl+place+city+source)', allCoreSeo],
  ]
  for (const [name, n] of lines) {
    console.log(`   ${name}: ${n}  (${pct(n, totalWithImage)})`)
  }

  function printBlock(block: { label: string; list: Awaited<ReturnType<typeof pickSamples>>['list'] }) {
    console.log(`\n--- 샘플: ${block.label} (${block.list.length}건) ---`)
    for (const p of block.list) {
      const url = (p.bgImageUrl ?? '').slice(0, 96)
      console.log(`\n· ${p.originSource} / ${p.originCode}`)
      console.log(`  title: ${(p.title ?? '').slice(0, 70)}`)
      console.log(`  bgImageUrl: ${url}${trimLen(p.bgImageUrl) > 96 ? '…' : ''}`)
      console.log(
        `  source=${p.bgImageSource ?? '∅'} photographer=${p.bgImagePhotographer ?? '∅'} place=${p.bgImagePlaceName ?? '∅'} city=${p.bgImageCityName ?? '∅'}`
      )
      console.log(`  sourceUrl: ${(p.bgImageSourceUrl ?? '').slice(0, 88)}${trimLen(p.bgImageSourceUrl) > 88 ? '…' : ''}`)
      console.log(`  externalId=${p.bgImageExternalId ?? '∅'} storagePath=${p.bgImageStoragePath ?? '∅'}`)
      console.log(`  rehostLabel=${p.bgImageRehostSearchLabel ?? '∅'} rehostedAt=${p.bgImageRehostedAt?.toISOString() ?? '∅'}`)
      console.log(`  publicImageHeroSeoLine: ${(p.publicImageHeroSeoLine ?? '∅').slice(0, 100)}`)
    }
  }

  printBlock(samplesPexels)
  printBlock(samplesSupabase)
  printBlock(samplesNcloud)
  printBlock(samplesMixed)

  console.log('\n=== done ===\n')
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
