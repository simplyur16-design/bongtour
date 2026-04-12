import fs from 'fs'
import path from 'path'

const CONFIG_REL = ['public', 'data', 'private-trip-hero-slides.json'] as const

export type PrivateTripHeroSlide = {
  imageUrl: string
  /** 히어로 하단 굵은 한 줄 (비우면 기본 문구) */
  headline?: string
  /** 보조 한 줄 (상품명 자리) */
  caption?: string
  /** 비우면 이미지는 링크 없음. `/inquiry?...` 또는 `/products/…` 등 */
  linkHref?: string
}

export type PrivateTripHeroSlidesFile = {
  lastUpdatedAt?: string | null
  lastUpdatedBy?: string | null
  slides: PrivateTripHeroSlide[]
}

function configPath(): string {
  return path.join(process.cwd(), ...CONFIG_REL)
}

function isAllowedImageUrl(u: string): boolean {
  const t = u.trim()
  return t.startsWith('/') || t.startsWith('https://')
}

export function parsePrivateTripHeroSlidesFile(raw: unknown): PrivateTripHeroSlidesFile {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { slides: [] }
  }
  const o = raw as Record<string, unknown>
  const slidesIn = o.slides
  const slides: PrivateTripHeroSlide[] = []
  if (Array.isArray(slidesIn)) {
    for (const row of slidesIn) {
      if (slides.length >= 50) break
      if (!row || typeof row !== 'object' || Array.isArray(row)) continue
      const r = row as Record<string, unknown>
      const imageUrl = typeof r.imageUrl === 'string' ? r.imageUrl.trim() : ''
      if (!imageUrl || !isAllowedImageUrl(imageUrl)) continue
      const headline = typeof r.headline === 'string' ? r.headline.trim() : undefined
      const caption = typeof r.caption === 'string' ? r.caption.trim() : undefined
      const linkHref = typeof r.linkHref === 'string' ? r.linkHref.trim() : undefined
      slides.push({
        imageUrl,
        headline: headline || undefined,
        caption: caption || undefined,
        linkHref: linkHref || undefined,
      })
    }
  }
  return {
    lastUpdatedAt: typeof o.lastUpdatedAt === 'string' ? o.lastUpdatedAt : null,
    lastUpdatedBy: typeof o.lastUpdatedBy === 'string' ? o.lastUpdatedBy : null,
    slides,
  }
}

export function readPrivateTripHeroSlidesFile(): PrivateTripHeroSlidesFile {
  try {
    const raw = fs.readFileSync(configPath(), 'utf8')
    return parsePrivateTripHeroSlidesFile(JSON.parse(raw) as unknown)
  } catch {
    return { slides: [] }
  }
}

/** 공개 페이지용: 유효 슬라이드만 (JSON 폴백 시 최대 50, 폴더 모드는 별도) */
export function getPrivateTripHeroSlides(): PrivateTripHeroSlide[] {
  return readPrivateTripHeroSlidesFile().slides
}

export type WritePrivateTripHeroSlidesInput = {
  slides: PrivateTripHeroSlide[]
  lastUpdatedBy: string
}

export function writePrivateTripHeroSlidesFile(input: WritePrivateTripHeroSlidesInput): PrivateTripHeroSlidesFile {
  const normalized: PrivateTripHeroSlide[] = []
  for (const s of input.slides) {
    if (normalized.length >= 50) break
    const imageUrl = (s.imageUrl ?? '').trim()
    if (!imageUrl || !isAllowedImageUrl(imageUrl)) continue
    const headline = (s.headline ?? '').trim()
    const caption = (s.caption ?? '').trim()
    const linkHref = (s.linkHref ?? '').trim()
    normalized.push({
      imageUrl,
      headline: headline || undefined,
      caption: caption || undefined,
      linkHref: linkHref || undefined,
    })
  }
  const next: PrivateTripHeroSlidesFile = {
    lastUpdatedAt: new Date().toISOString(),
    lastUpdatedBy: input.lastUpdatedBy,
    slides: normalized,
  }
  const p = configPath()
  const dir = path.dirname(p)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(p, JSON.stringify(next, null, 2), 'utf8')
  return next
}
