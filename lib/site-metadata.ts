/** 공개 SEO용 사이트 기준 URL (OG·canonical·JSON-LD) */
export const SITE_NAME = 'Bong투어'

/** 공개 URL: NEXT_PUBLIC_* → NEXTAUTH_URL(운영에서 흔히 설정) → 로컬 개발 폴백 */
export function getSiteOrigin(): string {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXTAUTH_URL?.trim() ||
    'http://localhost:3000'
  let s = raw.replace(/\/$/, '')
  /** `bongtour.com` 처럼 스킴이 없으면 `app/layout.tsx` 의 `new URL(siteOrigin)` 이 프로덕션에서 즉시 500 을 유발한다. */
  if (s.length > 0 && !/^https?:\/\//i.test(s)) {
    s = `https://${s.replace(/^\/+/, '')}`
  }
  try {
    new URL(s)
    return s.replace(/\/$/, '')
  } catch {
    return 'http://localhost:3000'
  }
}

export function absoluteUrl(path: string): string {
  const base = getSiteOrigin()
  const p = path.startsWith('/') ? path : `/${path}`
  return `${base}${p}`
}

/** OG·스키마용 — DB에 저장된 절대 URL은 그대로, 상대 경로만 사이트 origin 결합 */
export function toAbsoluteImageUrl(url: string | null | undefined): string | undefined {
  const u = (url ?? '').trim()
  if (!u) return undefined
  if (u.startsWith('http://') || u.startsWith('https://')) return u
  return absoluteUrl(u.startsWith('/') ? u : `/${u}`)
}

/** 메타 이미지 fallback — 공개 정적 자산 */
export const DEFAULT_OG_IMAGE_PATH = '/og/default.webp'

/** 상품 상세 description — 메타·JSON-LD 공통 (DB 필드만 사용) */
export function buildPublicProductDescription(input: {
  title: string
  primaryDestination?: string | null
  destination?: string | null
}): string {
  const dest = (input.primaryDestination ?? input.destination ?? '').trim()
  const head = `${input.title}${dest ? ` (${dest})` : ''}`
  return `${head}의 일정·출발 정보와 여행 안내를 확인할 수 있습니다. 예약·상담은 문의를 통해 안내됩니다.`
}
