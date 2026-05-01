/**
 * DB에서 `bgImageUrl`이 Pexels(`*.pexels.com`)인 상품을 찾아,
 * 이미지를 내려받아 WebP(품질 80, 최대 너비 1200)로 변환 후 Ncloud Object Storage에 올리고 URL을 갱신합니다.
 *
 *   npm run migrate:pexels
 *   npx tsx scripts/migrate-pexels-to-ncloud.ts
 *
 * 환경 변수 (기존 `lib/object-storage.ts` SSOT):
 * - DATABASE_URL
 * - NCLOUD_ACCESS_KEY, NCLOUD_SECRET_KEY
 * - NCLOUD_OBJECT_STORAGE_ENDPOINT, NCLOUD_OBJECT_STORAGE_BUCKET (미설정 시 기본 버킷명 사용),
 *   NCLOUD_OBJECT_STORAGE_PUBLIC_BASE_URL
 *
 * 안티봇: Pexels 다운로드 사이 2~3초(랜덤) 대기.
 */

import './load-env-for-scripts'

import sharp from 'sharp'
import { prisma } from '../lib/prisma'
import { isObjectStorageConfigured, uploadStorageObjectRaw } from '../lib/object-storage'
import {
  buildProductHeroImageStorageKey,
  downloadRemoteImage,
  extractPexelsPhotoIdFromCdnUrl,
  isPexelsCdnUrl,
} from '../lib/product-pexels-image-rehost'
import { toAssetSlug } from '../lib/image-asset-slug'
import { toHeroStorageSourceTypeSegment } from '../lib/product-hero-image-source-type'

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

function randomPexelsDelayMs(): number {
  return 2000 + Math.floor(Math.random() * 1001)
}

function isNcloudUrl(u: string): boolean {
  const l = u.toLowerCase()
  return l.includes('ncloudstorage.com') || l.includes('ncloud.com')
}

function parseExternalPhotoId(raw: string | null | undefined): number | null {
  if (!raw?.trim()) return null
  const n = Number.parseInt(raw.trim(), 10)
  return Number.isFinite(n) && n > 0 ? n : null
}

async function main() {
  if (!process.env.DATABASE_URL?.trim()) {
    console.error('[migrate-pexels-to-ncloud] DATABASE_URL 이(가) 필요합니다.')
    process.exit(1)
  }
  if (!isObjectStorageConfigured()) {
    console.error(
      '[migrate-pexels-to-ncloud] Ncloud Object Storage 환경 변수가 불완전합니다. ' +
        'NCLOUD_ACCESS_KEY, NCLOUD_SECRET_KEY, NCLOUD_OBJECT_STORAGE_ENDPOINT, ' +
        'NCLOUD_OBJECT_STORAGE_BUCKET(또는 기본값), NCLOUD_OBJECT_STORAGE_PUBLIC_BASE_URL 을 설정하세요. ' +
        '(참고: 저장소 버킷명은 NCLOUD_OBJECT_STORAGE_BUCKET 입니다.)',
    )
    process.exit(1)
  }

  const products = await prisma.product.findMany({
    where: {
      AND: [{ bgImageUrl: { not: null } }, { bgImageUrl: { contains: 'pexels.com', mode: 'insensitive' } }],
    },
    select: {
      id: true,
      bgImageUrl: true,
      bgImagePlaceName: true,
      bgImageCityName: true,
      bgImageExternalId: true,
      title: true,
    },
  })

  const targets = products.filter((p) => {
    const u = p.bgImageUrl?.trim() ?? ''
    if (!u) return false
    if (isNcloudUrl(u)) return false
    return true
  })

  console.log(`[migrate-pexels-to-ncloud] Pexels URL 상품: ${targets.length}건`)

  let success = 0
  let failed = 0
  const failures: { id: string; url: string; error: string }[] = []

  for (const p of targets) {
    const bgUrl = p.bgImageUrl!.trim()
    await sleep(randomPexelsDelayMs())

    try {
      if (!isPexelsCdnUrl(bgUrl)) {
        throw new Error('Pexels CDN 호스트가 아닙니다 (images.pexels.com 등만 지원)')
      }

      const { buffer } = await downloadRemoteImage(bgUrl)

      const webpBuf = await sharp(buffer)
        .rotate()
        .resize({ width: 1200, withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer()

      const meta = await sharp(webpBuf).metadata()

      const fromUrl = extractPexelsPhotoIdFromCdnUrl(bgUrl)
      const fromDb = parseExternalPhotoId(p.bgImageExternalId)
      const pid = fromUrl ?? fromDb
      const sourceId = pid != null ? String(pid) : `id-${p.id.replace(/[^a-z0-9]/gi, '').slice(0, 14)}`

      const placeSlug = p.bgImagePlaceName?.trim() ? toAssetSlug(p.bgImagePlaceName) : null
      const citySlug = p.bgImageCityName?.trim() ? toAssetSlug(p.bgImageCityName) : null

      const { objectKey } = buildProductHeroImageStorageKey({
        placeSlug,
        citySlug,
        sourceTypeSegment: toHeroStorageSourceTypeSegment('pexels'),
        sourceIdSegment: sourceId,
        ext: 'webp',
      })

      const up = await uploadStorageObjectRaw({
        objectKey,
        body: webpBuf,
        contentType: 'image/webp',
      })

      await prisma.product.update({
        where: { id: p.id },
        data: {
          bgImageUrl: up.publicUrl,
          bgImageStoragePath: up.objectKey,
          bgImageStorageBucket: up.bucket,
          bgImageWidth: meta.width ?? undefined,
          bgImageHeight: meta.height ?? undefined,
          bgImageRehostedAt: new Date(),
        },
      })

      success++
      console.log(`[ok] ${p.id} ${p.title?.slice(0, 40) ?? ''}`)
    } catch (e) {
      failed++
      const msg = e instanceof Error ? e.message : String(e)
      failures.push({ id: p.id, url: bgUrl, error: msg })
      console.error(`[skip] ${p.id}: ${msg}`)
    }
  }

  console.log('\n=== 요약 ===')
  console.log(`성공: ${success}`)
  console.log(`실패: ${failed}`)
  if (failures.length > 0) {
    console.log('실패 상세:')
    for (const f of failures) {
      console.log(`  - id=${f.id}`)
      console.log(`    url=${f.url}`)
      console.log(`    error=${f.error}`)
    }
  }

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect().catch(() => {})
  process.exit(1)
})
