import type { PrismaClient } from '@prisma/client'

/**
 * 목록 카드 대표사진 1상품 1장.
 * 다른 공개·등록대기 상품이 이미 대표사진으로 쓰는 사진(같은 주소 또는 같은 원본 사진 번호)은 자동 배정에서 고르지 않는다.
 * REGRESSION-FREEZE[card-cover-photo-unique]: 다른 공개·대기 상품 대표사진 재사용 금지 — manifest
 */

export type CoverPhotoRef = {
  url?: string | null
  externalId?: string | null
  originalLink?: string | null
}

function normalizeUrlKey(raw: string): string | null {
  const s = raw.trim()
  if (!s) return null
  try {
    const u = new URL(s)
    let p = u.pathname
    try {
      p = decodeURIComponent(p)
    } catch {
      /* keep raw path */
    }
    return `url:${u.host.toLowerCase()}${p.toLowerCase()}`
  } catch {
    return `url:${s.toLowerCase()}`
  }
}

const PEXELS_ID_PATTERNS: RegExp[] = [
  /images\.pexels\.com\/photos\/(\d{4,})\//i,
  /pexels\.com\/photo\/(?:[^/?#]*-)?(\d{4,})\/?/i,
  /pexels-(\d{4,})/i,
  /_(\d{4,})(?:_card)?_pexels_/i,
]

const UNSPLASH_ID_PATTERNS: RegExp[] = [/unsplash\.com\/photos\/(?:[^/?#]*-)?([A-Za-z0-9_-]{11})(?:[/?#]|$)/i]

function decodeSafe(s: string): string {
  try {
    return decodeURIComponent(s)
  } catch {
    return s
  }
}

function idKeysFromText(text: string): string[] {
  const out: string[] = []
  const t = decodeSafe(text)
  for (const re of PEXELS_ID_PATTERNS) {
    const m = t.match(re)
    if (m) out.push(`pexels:${m[1]}`)
  }
  for (const re of UNSPLASH_ID_PATTERNS) {
    const m = t.match(re)
    if (m) out.push(`unsplash:${m[1]}`)
  }
  return out
}

/** 같은 사진 판단 열쇠: 정규화 주소 + Pexels/Unsplash 원본 번호 */
export function coverPhotoKeys(ref: CoverPhotoRef): string[] {
  const keys = new Set<string>()
  const url = String(ref.url ?? '').trim()
  if (url) {
    const k = normalizeUrlKey(url)
    if (k) keys.add(k)
    for (const x of idKeysFromText(url)) keys.add(x)
  }
  const link = String(ref.originalLink ?? '').trim()
  if (link) for (const x of idKeysFromText(link)) keys.add(x)
  const ext = String(ref.externalId ?? '').trim()
  if (ext) {
    const prefixed = ext.match(/^(pexels|unsplash)[:_-](.+)$/i)
    if (prefixed) keys.add(`${prefixed[1]!.toLowerCase()}:${prefixed[2]}`)
    else if (/^\d{4,}$/.test(ext)) keys.add(`pexels:${ext}`)
    else if (/^[A-Za-z0-9_-]{11}$/.test(ext)) keys.add(`unsplash:${ext}`)
  }
  return [...keys]
}

export type CoverPhotoUsage = {
  isUsed: (ref: CoverPhotoRef) => boolean
  mark: (ref: CoverPhotoRef) => void
  size: () => number
}

export function createCoverPhotoUsage(refs: Iterable<CoverPhotoRef> = []): CoverPhotoUsage {
  const used = new Set<string>()
  const mark = (ref: CoverPhotoRef) => {
    for (const k of coverPhotoKeys(ref)) used.add(k)
  }
  for (const r of refs) mark(r)
  return {
    isUsed: (ref) => coverPhotoKeys(ref).some((k) => used.has(k)),
    mark,
    size: () => used.size,
  }
}

/** 공개(등록)·등록대기 상품의 대표사진 사용 목록. 자기 상품은 뺀다. */
export async function loadCoverPhotoUsage(
  prisma: Pick<PrismaClient, 'product'>,
  opts: { excludeProductId?: string | null } = {},
): Promise<CoverPhotoUsage> {
  const rows = await prisma.product.findMany({
    where: {
      bgImageUrl: { not: null },
      ...(opts.excludeProductId ? { id: { not: opts.excludeProductId } } : {}),
      OR: [
        { registrationStatus: 'registered' },
        { registrationStatus: 'pending' },
        { registrationStatus: null },
        { registrationStatus: '' },
      ],
    },
    select: { bgImageUrl: true, bgImageExternalId: true, bgImageSourceUrl: true },
  })
  return createCoverPhotoUsage(
    rows.map((r) => ({ url: r.bgImageUrl, externalId: r.bgImageExternalId, originalLink: r.bgImageSourceUrl })),
  )
}

/** 일정에서 대표사진 재검색용 장소 키워드(핵심 방문지 우선, 중복·도시명 제외) */
export function coverFallbackPlaceQueries(
  primary: string,
  dayKeywords: Array<string | null | undefined>,
  cityTerms: Array<string | null | undefined>,
  max = 2,
): string[] {
  const norm = (s: string) => s.trim().toLowerCase()
  const seen = new Set<string>([norm(primary)])
  const city = new Set(cityTerms.map((c) => norm(String(c ?? ''))).filter(Boolean))
  const out: string[] = []
  for (const raw of dayKeywords) {
    const k = String(raw ?? '').trim()
    if (!k || /^day_\d+$/i.test(k) || /^premade_\d+$/i.test(k)) continue
    const n = norm(k)
    if (seen.has(n) || city.has(n)) continue
    seen.add(n)
    out.push(k)
    if (out.length >= max) break
  }
  return out
}
