/**
 * OG pageKey·정적 미리보기 — 클라이언트·서버 공용 (Prisma/Storage 없음).
 */

import {
  isOgSeasonPageKey,
  OG_SEASON_PAGE_KEYS,
  staticOgPathForSeasonKey,
} from '@/lib/og-image-seasonal'

export const VALID_PAGE_KEYS = [
  ...OG_SEASON_PAGE_KEYS,
  'overseas',
  'private-trip',
  'training',
  'esim',
] as const

export type OgPageKey = (typeof VALID_PAGE_KEYS)[number]

const VALID_SET = new Set<string>(VALID_PAGE_KEYS)

export function isValidOgPageKey(key: string): key is OgPageKey {
  return VALID_SET.has(key)
}

function staticPathForPage(pageKey: string): string {
  if (isOgSeasonPageKey(pageKey)) return staticOgPathForSeasonKey(pageKey)
  return `/og/${pageKey}.webp`
}

/** 관리자 UI — 업로드 없을 때 보여줄 정적 미리보기 경로 */
export function staticOgPreviewPathForPageKey(pageKey: OgPageKey): string {
  return staticPathForPage(pageKey)
}
