import type { MonthlyCurationMidPayload } from '@/lib/overseas-cms-public'
import type { OverseasDisplayBucketId } from '@/lib/overseas-display-buckets'

export type SeasonCurationInsertBlock = {
  payload: MonthlyCurationMidPayload
  insertAfterBucket: OverseasDisplayBucketId
}

const JP = new Set([
  'japan',
  'jp',
  '일본',
  'tokyo',
  'osaka',
  'kyoto',
  'hokkaido',
  'okinawa',
  'fukuoka',
  'nagoya',
  'jpn',
])

const CN = new Set(['china', 'cn', '중국', 'chn'])

const HK = new Set(['hongkong', 'hk', 'hong-kong', '홍콩', 'hk-mo-sz', 'macau', '마카오'])

const SEA = new Set([
  'sea',
  '동남아',
  'thailand',
  'vietnam',
  'cambodia',
  'laos',
  'myanmar',
  'philippines',
  'indonesia',
  'malaysia',
  'singapore',
  'brunei',
  '태국',
  '베트남',
  '발리',
  '싱가포르',
  '푸켓',
  '다낭',
  '세부',
  '보라카이',
  'guam',
  'saipan',
  '괌',
  '사이판',
])

const EU_W = new Set([
  'europe_west',
  'europe-west',
  'uk',
  'switzerland',
  'italy',
  'france',
  'south-france',
  'sicily',
  'germany',
  'ireland',
  'netherlands',
  'belgium',
  'austria',
  'spain',
  'portugal',
  '서유럽',
])

const EU_N = new Set(['europe_north', 'nordic-baltic', '북유럽', 'scandinavia'])

const EU_E = new Set(['europe_east', 'czech', 'hungary', 'balkans', '동유럽'])

const AM = new Set([
  'americas',
  'usa',
  'us',
  'canada',
  'hawaii',
  'mexico',
  'brazil',
  'argentina',
  'peru',
  '미주',
  '하와이',
  '캐나다',
  '미국',
])

function norm(raw: string | null | undefined): string {
  return (raw ?? '').trim().toLowerCase()
}

/**
 * CMS `MonthlyCurationContent.countryCode` 등 → 상품 목록 권역 버킷.
 * 매칭 실패 시 일본 버킷 아래(fallback).
 */
export function resolveSeasonCurationInsertAfterBucket(
  countryCode: string | null | undefined
): OverseasDisplayBucketId {
  const k = norm(countryCode)
  if (!k) return 'japan'
  if (JP.has(k)) return 'japan'
  if (CN.has(k)) return 'china'
  if (HK.has(k)) return 'hongkong'
  if (SEA.has(k)) return 'sea'
  if (EU_W.has(k)) return 'europe_west'
  if (EU_N.has(k)) return 'europe_north'
  if (EU_E.has(k)) return 'europe_east'
  if (AM.has(k)) return 'americas'
  if (k === 'other' || k === '기타' || k === '그외') return 'other'
  return 'japan'
}

/** `countryCode` 우선, 비어 있으면 `regionKey`로 동일 규칙 시도. */
export function resolveSeasonCurationInsertAfterBucketFromRow(row: {
  countryCode: string | null | undefined
  regionKey: string | null | undefined
}): OverseasDisplayBucketId {
  const cc = (row.countryCode ?? '').trim()
  if (cc) return resolveSeasonCurationInsertAfterBucket(cc)
  const rk = (row.regionKey ?? '').trim()
  if (rk) return resolveSeasonCurationInsertAfterBucket(rk)
  return 'japan'
}
