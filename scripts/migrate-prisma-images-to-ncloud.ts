/**
 * Prisma에 들어 있는 이미지 URL/경로를 Ncloud Object Storage로 복사하고,
 * DB 필드를 새 public URL로 갱신합니다.
 *
 * 기본: `/uploads/...` 로컬 파일만 (public/ 아래 실제 파일 읽기)
 * 선택: `--include-http` — http(s) URL은 fetch 후 Ncloud에 재업로드 (Pexels 등; 용량·정책 주의)
 *
 *   npx tsx scripts/migrate-prisma-images-to-ncloud.ts
 *   npx tsx scripts/migrate-prisma-images-to-ncloud.ts --apply
 *   npx tsx scripts/migrate-prisma-images-to-ncloud.ts --apply --include-http
 */

import './load-env-for-scripts'
import { createHash } from 'crypto'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { prisma } from '../lib/prisma'
import {
  buildNcloudPublicUrl,
  getNcloudObjectStorageEnv,
  isNcloudObjectStorageConfigured,
  uploadNcloudObject,
} from '../lib/ncloud-object-storage'

function hasFlag(name: string): boolean {
  return process.argv.includes(name)
}

function normalizeUrl(u: string): string {
  return u.trim().split('?')[0]
}

function isAlreadyNcloud(u: string, publicBase: string): boolean {
  const b = publicBase.replace(/\/+$/, '')
  const n = normalizeUrl(u)
  return n.startsWith(b + '/') || n === b
}

function isLocalUploadPath(u: string): boolean {
  const n = normalizeUrl(u)
  return n.startsWith('/uploads/') || n.startsWith('/images/')
}

function isHttpUrl(u: string): boolean {
  const n = normalizeUrl(u)
  return n.startsWith('https://') || n.startsWith('http://')
}

function extFromPath(p: string): string {
  const m = /\.([a-zA-Z0-9]+)$/.exec(p)
  return (m?.[1] ?? 'bin').toLowerCase()
}

function contentTypeForExt(ext: string): string {
  switch (ext) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg'
    case 'png':
      return 'image/png'
    case 'webp':
      return 'image/webp'
    case 'gif':
      return 'image/gif'
    case 'svg':
      return 'image/svg+xml'
    default:
      return 'application/octet-stream'
  }
}

async function readLocalPublicFile(webPath: string): Promise<{ buffer: Buffer; ext: string } | null> {
  const rel = normalizeUrl(webPath).replace(/^\/+/, '')
  const abs = join(process.cwd(), 'public', rel)
  try {
    const buffer = await readFile(abs)
    return { buffer, ext: extFromPath(rel) }
  } catch {
    return null
  }
}

async function fetchHttp(url: string): Promise<{ buffer: Buffer; ext: string; contentType: string } | null> {
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) return null
  const ct = res.headers.get('content-type') ?? 'application/octet-stream'
  const buf = Buffer.from(await res.arrayBuffer())
  const ext =
    ct.includes('jpeg') || ct.includes('jpg')
      ? 'jpg'
      : ct.includes('png')
        ? 'png'
        : ct.includes('webp')
          ? 'webp'
          : ct.includes('gif')
            ? 'gif'
            : extFromPath(new URL(url).pathname) || 'bin'
  return { buffer: buf, ext, contentType: ct.split(';')[0].trim() }
}

function shortHash(buf: Buffer): string {
  return createHash('sha256').update(buf).digest('hex').slice(0, 12)
}

/** 동일 바이트라도 DB 경로가 다르면 별도 객체로 두기 위한 접미사 */
function sourceKeySuffix(src: string): string {
  return createHash('sha256').update(normalizeUrl(src)).digest('hex').slice(0, 10)
}

/** 문자열 트리 안의 모든 값이 urlMap 키와 같으면 치환 */
function replaceUrlsDeep(value: unknown, urlMap: Map<string, string>): unknown {
  if (value === null || value === undefined) return value
  if (typeof value === 'string') {
    const n = normalizeUrl(value)
    return urlMap.get(n) ?? value
  }
  if (Array.isArray(value)) {
    return value.map((v) => replaceUrlsDeep(v, urlMap))
  }
  if (typeof value === 'object') {
    const o = value as Record<string, unknown>
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(o)) {
      out[k] = replaceUrlsDeep(v, urlMap)
    }
    return out
  }
  return value
}

async function main(): Promise<void> {
  const apply = hasFlag('--apply')
  const includeHttp = hasFlag('--include-http')

  if (!isNcloudObjectStorageConfigured()) {
    throw new Error('Ncloud 환경 변수(NCLOUD_*)가 필요합니다.')
  }
  const ncloud = getNcloudObjectStorageEnv()
  const publicBase = ncloud.publicBaseUrl

  console.log('[migrate-prisma-images] mode:', apply ? 'APPLY' : 'dry-run')
  console.log('[migrate-prisma-images] include-http:', includeHttp)

  /** 원본 URL(normalized) -> 새 Ncloud URL */
  const urlMap = new Map<string, string>()
  /** ImageAsset 등: 원본 URL -> { publicUrl, objectKey } */
  const metaBySource = new Map<string, { publicUrl: string; objectKey: string }>()
  /** 이미 처리한 원본(중복 업로드 방지) */
  const pending = new Set<string>()

  function consider(u: string | null | undefined): void {
    if (!u || typeof u !== 'string') return
    const n = normalizeUrl(u)
    if (!n) return
    if (isAlreadyNcloud(n, publicBase)) return
    if (isLocalUploadPath(n)) {
      pending.add(n)
      return
    }
    if (includeHttp && isHttpUrl(n)) {
      pending.add(n)
    }
  }

  const products = await prisma.product.findMany({
    select: { id: true, bgImageUrl: true, schedule: true },
  })
  for (const p of products) {
    consider(p.bgImageUrl)
    if (p.schedule) {
      try {
        const j = JSON.parse(p.schedule) as unknown
        const collect = (v: unknown): void => {
          if (typeof v === 'string') consider(v)
          else if (Array.isArray(v)) v.forEach(collect)
          else if (v && typeof v === 'object') Object.values(v as object).forEach(collect)
        }
        collect(j)
      } catch {
        /* ignore bad json */
      }
    }
  }

  const photoPools = await prisma.photoPool.findMany({ select: { filePath: true } })
  for (const ph of photoPools) consider(ph.filePath)

  const destinations = await prisma.destination.findMany({ select: { imageUrl: true } })
  for (const d of destinations) consider(d.imageUrl)

  const destSets = await prisma.destinationImageSet.findMany({
    select: { mainImageUrl: true, scheduleImageUrls: true },
  })
  for (const s of destSets) {
    consider(s.mainImageUrl)
    if (s.scheduleImageUrls) {
      try {
        const arr = JSON.parse(s.scheduleImageUrls) as unknown[]
        for (const item of arr) {
          if (item && typeof item === 'object' && 'url' in item) consider(String((item as { url?: string }).url))
        }
      } catch {
        /* ignore */
      }
    }
  }

  const imageAssets = await prisma.imageAsset.findMany({ select: { publicUrl: true } })
  for (const a of imageAssets) consider(a.publicUrl)

  const editorials = await prisma.editorialContent.findMany({ select: { heroImageUrl: true } })
  for (const e of editorials) consider(e.heroImageUrl)

  const monthly = await prisma.monthlyCurationContent.findMany({ select: { imageUrl: true } })
  for (const m of monthly) consider(m.imageUrl)

  const brands = await prisma.brand.findMany({ select: { logoPath: true } })
  for (const b of brands) consider(b.logoPath)

  const logs = await prisma.assetUsageLog.findMany({ select: { assetPath: true } })
  for (const l of logs) consider(l.assetPath)

  console.log('[migrate-prisma-images] unique sources to migrate:', pending.size)

  for (const src of pending) {
    let buffer: Buffer | null = null
    let ext = 'bin'
    let contentType = 'application/octet-stream'

    if (isLocalUploadPath(src)) {
      const r = await readLocalPublicFile(src)
      if (!r) {
        console.warn('[migrate-prisma-images] skip (file missing):', src)
        continue
      }
      buffer = r.buffer
      ext = r.ext
      contentType = contentTypeForExt(ext)
    } else if (includeHttp && isHttpUrl(src)) {
      const r = await fetchHttp(src)
      if (!r) {
        console.warn('[migrate-prisma-images] skip (fetch failed):', src.slice(0, 120))
        continue
      }
      buffer = r.buffer
      ext = r.ext
      contentType = r.contentType || contentTypeForExt(ext)
    } else {
      continue
    }

    const hash = shortHash(buffer)
    const sk = sourceKeySuffix(src)
    const now = new Date()
    const y = String(now.getUTCFullYear())
    const mo = String(now.getUTCMonth() + 1).padStart(2, '0')
    const safeName = `${hash}-${sk}.${ext}`
    const objectKey = `migrated/from-prisma/${y}/${mo}/${safeName}`

    const predictedUrl = buildNcloudPublicUrl(publicBase, objectKey)
    if (!apply) {
      urlMap.set(normalizeUrl(src), predictedUrl)
      metaBySource.set(normalizeUrl(src), { publicUrl: predictedUrl, objectKey })
      console.log('[migrate-prisma-images] would upload', src.slice(0, 80), '→', objectKey)
      continue
    }

    const { publicUrl } = await uploadNcloudObject({
      objectKey,
      body: buffer,
      contentType,
    })
    urlMap.set(normalizeUrl(src), publicUrl)
    metaBySource.set(normalizeUrl(src), { publicUrl, objectKey })
    console.log('[migrate-prisma-images] uploaded', normalizeUrl(src).slice(0, 60), '→', publicUrl.slice(0, 80))
  }

  if (!apply) {
    console.log('[migrate-prisma-images] dry-run done. Use --apply to upload and update DB.')
    return
  }

  if (urlMap.size === 0) {
    console.log('[migrate-prisma-images] nothing to update.')
    return
  }

  let updated = 0

  for (const p of products) {
    let changed = false
    let bg = p.bgImageUrl
    if (bg && urlMap.has(normalizeUrl(bg))) {
      bg = urlMap.get(normalizeUrl(bg))!
      changed = true
    }
    let sched = p.schedule
    if (sched) {
      try {
        const parsed = JSON.parse(sched) as unknown
        const next = replaceUrlsDeep(parsed, urlMap)
        const nextStr = JSON.stringify(next)
        if (nextStr !== sched) {
          sched = nextStr
          changed = true
        }
      } catch {
        /* */
      }
    }
    if (changed) {
      await prisma.product.update({
        where: { id: p.id },
        data: { bgImageUrl: bg, schedule: sched },
      })
      updated++
    }
  }

  for (const ph of await prisma.photoPool.findMany({ select: { id: true, filePath: true } })) {
    const n = normalizeUrl(ph.filePath)
    if (urlMap.has(n)) {
      await prisma.photoPool.update({
        where: { id: ph.id },
        data: { filePath: urlMap.get(n)! },
      })
      updated++
    }
  }

  for (const d of await prisma.destination.findMany({ select: { id: true, imageUrl: true } })) {
    const u = d.imageUrl
    if (u && urlMap.has(normalizeUrl(u))) {
      await prisma.destination.update({
        where: { id: d.id },
        data: { imageUrl: urlMap.get(normalizeUrl(u))! },
      })
      updated++
    }
  }

  for (const s of await prisma.destinationImageSet.findMany({
    select: { id: true, mainImageUrl: true, scheduleImageUrls: true },
  })) {
    let main = s.mainImageUrl
    let schedStr = s.scheduleImageUrls
    let ch = false
    if (main && urlMap.has(normalizeUrl(main))) {
      main = urlMap.get(normalizeUrl(main))!
      ch = true
    }
    if (schedStr) {
      try {
        const arr = JSON.parse(schedStr) as Array<{ url?: string }>
        let schCh = false
        const next = arr.map((item) => {
          const u = item.url
          if (u && urlMap.has(normalizeUrl(u))) {
            schCh = true
            return { ...item, url: urlMap.get(normalizeUrl(u))! }
          }
          return item
        })
        if (schCh) {
          schedStr = JSON.stringify(next)
          ch = true
        }
      } catch {
        /* */
      }
    }
    if (ch) {
      await prisma.destinationImageSet.update({
        where: { id: s.id },
        data: { mainImageUrl: main, scheduleImageUrls: schedStr },
      })
      updated++
    }
  }

  for (const a of await prisma.imageAsset.findMany({
    select: { id: true, publicUrl: true },
  })) {
    const u = a.publicUrl
    if (!u) continue
    const n = normalizeUrl(u)
    const meta = metaBySource.get(n)
    if (!meta) continue
    await prisma.imageAsset.update({
      where: { id: a.id },
      data: {
        publicUrl: meta.publicUrl,
        storagePath: meta.objectKey,
        storageBucket: ncloud.bucket,
      },
    })
    updated++
  }

  for (const e of await prisma.editorialContent.findMany({ select: { id: true, heroImageUrl: true } })) {
    const u = e.heroImageUrl
    if (u && urlMap.has(normalizeUrl(u))) {
      await prisma.editorialContent.update({
        where: { id: e.id },
        data: { heroImageUrl: urlMap.get(normalizeUrl(u))! },
      })
      updated++
    }
  }

  for (const m of await prisma.monthlyCurationContent.findMany({ select: { id: true, imageUrl: true } })) {
    const u = m.imageUrl
    if (u && urlMap.has(normalizeUrl(u))) {
      await prisma.monthlyCurationContent.update({
        where: { id: m.id },
        data: { imageUrl: urlMap.get(normalizeUrl(u))! },
      })
      updated++
    }
  }

  for (const b of await prisma.brand.findMany({ select: { id: true, logoPath: true } })) {
    const u = b.logoPath
    if (u && urlMap.has(normalizeUrl(u))) {
      await prisma.brand.update({
        where: { id: b.id },
        data: { logoPath: urlMap.get(normalizeUrl(u))! },
      })
      updated++
    }
  }

  for (const l of await prisma.assetUsageLog.findMany({ select: { id: true, assetPath: true } })) {
    const u = l.assetPath
    if (u && urlMap.has(normalizeUrl(u))) {
      await prisma.assetUsageLog.update({
        where: { id: l.id },
        data: { assetPath: urlMap.get(normalizeUrl(u))! },
      })
      updated++
    }
  }

  console.log('[migrate-prisma-images] DB rows touched (updates):', updated)
  console.log('[migrate-prisma-images] done.')
}

main()
  .catch((e) => {
    console.error('[migrate-prisma-images] fatal:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
