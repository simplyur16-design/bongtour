import { DEFAULT_OG_IMAGE_PATH } from '@/lib/site-metadata'

/** 4–9월 링크 공유(OG) — 해변 시즌 배너 */
export const DEFAULT_OG_APR_SEP_PATH = '/og/default-apr-sep.webp'

/** 10·11·2·3월 링크 공유(OG) — BONG TOUR 산·여행 배너 */
export const DEFAULT_OG_OCT_NOV_FEB_MAR_PATH = '/og/default-oct-nov-feb-mar.webp'

export const OG_SEASON_PAGE_KEYS = [
  'season-apr-sep',
  'season-oct-nov-feb-mar',
  'season-dec-jan',
] as const

export type OgSeasonPageKey = (typeof OG_SEASON_PAGE_KEYS)[number]

const SEASON_KEY_SET = new Set<string>(OG_SEASON_PAGE_KEYS)

export function isOgSeasonPageKey(key: string): key is OgSeasonPageKey {
  return SEASON_KEY_SET.has(key)
}

/** KST 기준 월(1–12). */
export function kstCalendarMonth(now: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    month: 'numeric',
  }).formatToParts(now)
  const m = Number.parseInt(parts.find((p) => p.type === 'month')?.value ?? '', 10)
  return Number.isFinite(m) && m >= 1 && m <= 12 ? m : now.getUTCMonth() + 1
}

/** 현재 KST 월에 적용되는 OG 시즌 pageKey (DB·관리자 업로드 키). */
// REGRESSION-FREEZE[og-image-seasonal]: KST 월→시즌 pageKey — manifest og-image-seasonal
export function getOgSeasonPageKey(now: Date = new Date()): OgSeasonPageKey {
  const m = kstCalendarMonth(now)
  if (m >= 4 && m <= 9) return 'season-apr-sep'
  if (m === 10 || m === 11 || m === 2 || m === 3) return 'season-oct-nov-feb-mar'
  return 'season-dec-jan'
}

export function staticOgPathForSeasonKey(seasonKey: OgSeasonPageKey): string {
  switch (seasonKey) {
    case 'season-apr-sep':
      return DEFAULT_OG_APR_SEP_PATH
    case 'season-oct-nov-feb-mar':
      return DEFAULT_OG_OCT_NOV_FEB_MAR_PATH
    case 'season-dec-jan':
      return DEFAULT_OG_IMAGE_PATH
  }
}

/** DB 업로드 없을 때 정적 OG 경로 (현재 시즌). */
export function getSeasonalDefaultOgImagePath(now: Date = new Date()): string {
  return staticOgPathForSeasonKey(getOgSeasonPageKey(now))
}

export const OG_SEASON_PAGE_LABELS: Record<
  OgSeasonPageKey,
  { label: string; months: string; description: string }
> = {
  'season-apr-sep': {
    label: '홈 공유 — 4~9월',
    months: '4·5·6·7·8·9월',
    description: '여름·해변 배너. 미업로드 시 public/og/default-apr-sep.webp',
  },
  'season-oct-nov-feb-mar': {
    label: '홈 공유 — 10·11·2·3월',
    months: '10·11·2·3월',
    description: 'BONG TOUR 산·여행 배너. 미업로드 시 default-oct-nov-feb-mar.webp',
  },
  'season-dec-jan': {
    label: '홈 공유 — 12·1월',
    months: '12·1월',
    description: '겨울 시즌. 미업로드 시 public/og/default.webp',
  },
}
