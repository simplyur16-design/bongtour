/**
 * 봉투어에 쓰지 않는 출처 판정(R03-25 사장님 20:13 "난 봉투어에 위키피아 사진 넣지 않는다", 2026-11-29 00:14 "기존 Wikimedia·불일치 사진 교체해").
 * 이미 들어 있는 Wikimedia·Wikipedia·Commons 사진을 판정해 정기 자동 채움 경로가 교체하게 한다(교체 대상 표시).
 * 판정은 사진 주소 호스트·원본 링크 호스트·출처 이름 — 우리 풀 파일 이름(ncloudstorage)은 증거가 아니다.
 * REGRESSION-FREEZE[photo-run-budget-judge-1129]: 기존 Wikimedia·Commons 사진은 교체 대상, 맞는 사진이 없으면 빈칸 — manifest
 */
const BANNED_HOST_RE = /(^|\.)(wikimedia|wikipedia|wikimediafoundation)\.org$/i
const BANNED_SOURCE_RE = /wikimedia|wikipedia|commons/i

function hostOf(link: unknown): string {
  const raw = String(link ?? '').trim()
  if (!raw) return ''
  try {
    return new URL(raw).hostname.replace(/^www\./, '').toLowerCase()
  } catch {
    return ''
  }
}

export type PhotoSourceFacts = {
  url?: unknown
  source?: unknown
  originalLink?: unknown
  sourcePageUrl?: unknown
}

/** Wikimedia·Wikipedia·Commons 에서 온 사진인가(URL 호스트·원본 링크 호스트·source 이름) */
export function photoIsBannedSource(p: PhotoSourceFacts): boolean {
  if (BANNED_HOST_RE.test(hostOf(p.url))) return true
  if (BANNED_HOST_RE.test(hostOf(p.originalLink))) return true
  if (BANNED_HOST_RE.test(hostOf(p.sourcePageUrl))) return true
  return BANNED_SOURCE_RE.test(String(p.source ?? ''))
}

/**
 * 2026-11-28 91칸 재판정에서 확정된 기존 오답 — 상품·일차·사진(외부 ID)이 같을 때만 적용(사진이 바뀌면 자동 해제).
 * pkg-nl-0036 1일차(칭다오 5.4광장 일차에 광저우 문 사진, 출처 페이지 slug 가 urban-scene-in-guangzhou-with-traditional-gate).
 */
export const CONFIRMED_WRONG_PHOTOS_1129: ReadonlyArray<{ productId: string; day: number; externalId: string }> = [
  { productId: 'cmtdagc3e05xpea0f3o2ugs1l', day: 1, externalId: '35272173' },
]

export function photoIsConfirmedWrong(productId: string, day: number | null, externalId: unknown): boolean {
  if (day == null) return false
  const ext = String(externalId ?? '').trim()
  return CONFIRMED_WRONG_PHOTOS_1129.some((c) => c.productId === productId && c.day === day && c.externalId === ext)
}
