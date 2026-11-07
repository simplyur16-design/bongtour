/**
 * 문과장 1106 v4: 사람 검수 3축 digest 의 '정본 입력 문자열' — 서버(node:crypto)·브라우저(WebCrypto) 공용.
 * - import 없음(클라이언트 번들 안전). 해시는 UTF-8 바이트의 SHA-256 hex.
 * - schedule: 저장된 Product.schedule 문자열 그대로(재직렬화·정규화 없음).
 * - summaryDescription: JSON.stringify([[day, title|null, description|null], …]) — 저장 행 순서.
 * - photoIdentity: JSON.stringify(collectReviewPhotoIdentity(row)) — 대표+일차 사진 URL·외부ID·저장경로·출처URL(바이트 해시 없음).
 */
export type ReviewCanonicalRow = {
  schedule: string | null
  bgImageUrl: string | null
  bgImageExternalId: string | null
  bgImageStoragePath: string | null
  bgImageSourceUrl: string | null
}

export type ReviewPhotoIdentity = {
  slot: string
  url: string
  externalId: string | null
  storagePath: string | null
  sourceUrl: string | null
  /** 바이트 해시 미검증(다운로드·로컬 자산 없음) — 값을 지어내지 않음 */
  bytesSha256: null
}

export type InspectedReviewDigests = {
  scheduleSha256: string
  summaryDescriptionSha256: string
  photoIdentitySha256: string
}

const s0 = (v: unknown): string | null => {
  const t = v == null ? '' : String(v).trim()
  return t ? t : null
}
const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {}

export function parseReviewScheduleArray(schedule: string | null): Record<string, unknown>[] | null {
  try {
    const v = JSON.parse(String(schedule ?? '')) as unknown
    return Array.isArray(v) ? (v as Record<string, unknown>[]) : null
  } catch {
    return null
  }
}

export function collectReviewPhotoIdentity(row: ReviewCanonicalRow): ReviewPhotoIdentity[] {
  const out: ReviewPhotoIdentity[] = []
  const cover = s0(row.bgImageUrl)
  if (cover) {
    out.push({
      slot: 'cover',
      url: cover,
      externalId: s0(row.bgImageExternalId),
      storagePath: s0(row.bgImageStoragePath),
      sourceUrl: s0(row.bgImageSourceUrl),
      bytesSha256: null,
    })
  }
  for (const [i, r] of (parseReviewScheduleArray(row.schedule) ?? []).entries()) {
    const day = Number(r.day) || i + 1
    const u1 = s0(r.imageUrl)
    if (u1) {
      const src = obj(r.imageSource)
      out.push({ slot: `day${day}.1`, url: u1, externalId: s0(src.externalId), storagePath: s0(r.imageStoragePath), sourceUrl: s0(r.imageSourcePageUrl), bytesSha256: null })
    }
    const u2 = s0(r.imageUrl2)
    if (u2) {
      const src2 = obj(r.imageSource2)
      out.push({ slot: `day${day}.2`, url: u2, externalId: s0(src2.externalId), storagePath: null, sourceUrl: s0(src2.sourceUrl), bytesSha256: null })
    }
  }
  return out
}

/** 정본 입력 문자열 3개. 일정이 JSON 배열이 아니면 null(검수 불가). */
export function reviewCanonicalInputs(
  row: ReviewCanonicalRow,
): { schedule: string; summaryDescription: string; photoIdentity: string; photoList: ReviewPhotoIdentity[] } | null {
  const arr = parseReviewScheduleArray(row.schedule)
  if (!arr || row.schedule == null) return null
  const sd = arr.map((r, i) => [Number(r.day) || i + 1, r.title ?? null, r.description ?? null])
  const photoList = collectReviewPhotoIdentity(row)
  return { schedule: String(row.schedule), summaryDescription: JSON.stringify(sd), photoIdentity: JSON.stringify(photoList), photoList }
}

type SubtleLike = { digest(alg: string, data: Uint8Array): Promise<ArrayBuffer> }

/** 브라우저(관리자 화면)에서 '지금 화면에 불러온 행' 그대로의 digest — WebCrypto SHA-256(UTF-8). */
export async function computeInspectedReviewDigests(
  row: ReviewCanonicalRow,
  subtle: SubtleLike | undefined = (globalThis as { crypto?: { subtle?: SubtleLike } }).crypto?.subtle,
): Promise<InspectedReviewDigests | null> {
  const c = reviewCanonicalInputs(row)
  if (!c || !subtle) return null
  const hex = async (s: string) =>
    Array.from(new Uint8Array(await subtle.digest('SHA-256', new TextEncoder().encode(s))))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
  return {
    scheduleSha256: await hex(c.schedule),
    summaryDescriptionSha256: await hex(c.summaryDescription),
    photoIdentitySha256: await hex(c.photoIdentity),
  }
}
