/**
 * 등록(상태 전환) 전 사진 게이트 — 기존 자동 등록 검사에 '더하기만' 한다(기존 guard 완화 없음).
 * 막는 사유(칸 단위):
 *  photo_sight_mismatch   그날 방문 명소와 맞지 않거나 맞는지 확인할 근거가 없음
 *  photo_public_duplicate 공개 상품이 이미 쓰는 사진(출처 id·주소) — 대표·카드 포함
 *  photo_irrelevant_subject 인물 주피사체·회의실/사무실·로고 등 무관 사진(제목·태그 기준)
 *  photo_low_res / photo_over_bytes / photo_not_measured  1200px 미만·용량(대표 200,000B·일차 400,000B) 초과·측정 실패
 * 관리자가 고른 칸(imageManualSelected·수동 대표)은 해상도·내용 판정에서 제외한다(기존과 동일, 용량만 본다).
 * REGRESSION-FREEZE[register-photo-registration-gate]: 등록 전 사진 5가지 사유 차단 — manifest
 */
import {
  AUTOFILL_COVER_MAX_BYTES,
  AUTOFILL_DAY_MAX_BYTES,
  AUTOFILL_MIN_WIDTH,
  photoIdentityKeys,
  photoSubjectIsIrrelevant,
  photoSubjectIsPerson,
  type PublicPhotoUsage,
} from '@/lib/photo-autofill-gate'
import { deriveDaySights, foldPhotoText, sightMatchInText, sightProfile, sightsOverlap } from '@/lib/photo-autofill-sight'
import { photoCandidateText } from '@/lib/register-photo-subject-filter'

export type RegistrationPhotoReason =
  | 'photo_sight_mismatch'
  | 'photo_public_duplicate'
  | 'photo_irrelevant_subject'
  | 'photo_low_res'
  | 'photo_over_bytes'
  | 'photo_not_measured'

export type RegistrationPhotoBlock = {
  kind: 'cover' | 'day'
  day: number | null
  reason: RegistrationPhotoReason
  detail: string
}

export type RegistrationPhotoInput = {
  productId: string
  /** 목적지 낱말(한글 + 영문 매핑) — 대표 사진의 도시 일치 근거와 일차 명소 추출에 쓴다 */
  destinationTerms: readonly string[]
  cover: {
    url: string
    externalId?: string | null
    originalLink?: string | null
    source?: string | null
    placeLabel?: string | null
    sightMatch?: string | null
  } | null
  schedule: string | null
  usage: PublicPhotoUsage
  probes: Record<string, { bytes: number | null; width: number | null } | undefined>
}

function coverLocked(source: string | null | undefined): boolean {
  return /manual|admin/i.test(String(source ?? ''))
}

function textOf(link: string | null | undefined): string {
  return foldPhotoText(photoCandidateText([link]).replace(/\b(pexels|unsplash|photo|photos|free|stock|image|com|www|https?)\b/gi, ' '))
}

export function evaluateRegistrationPhotos(input: RegistrationPhotoInput): { ok: boolean; blocks: RegistrationPhotoBlock[] } {
  const blocks: RegistrationPhotoBlock[] = []
  const push = (b: RegistrationPhotoBlock) => blocks.push(b)

  const measure = (kind: 'cover' | 'day', day: number | null, url: string, locked: boolean) => {
    const pr = input.probes[url]
    if (!pr || pr.bytes == null || pr.width == null) {
      push({ kind, day, reason: 'photo_not_measured', detail: 'size not measured' })
      return
    }
    const max = kind === 'cover' ? AUTOFILL_COVER_MAX_BYTES : AUTOFILL_DAY_MAX_BYTES
    if (pr.bytes >= max) push({ kind, day, reason: 'photo_over_bytes', detail: `${pr.bytes}>=${max}` })
    if (!locked && pr.width < AUTOFILL_MIN_WIDTH) push({ kind, day, reason: 'photo_low_res', detail: `${pr.width}<${AUTOFILL_MIN_WIDTH}` })
  }

  const subject = (kind: 'cover' | 'day', day: number | null, text: string) => {
    if (text.length < 3) return
    if (photoSubjectIsPerson({ title: text, tags: '' }) || photoSubjectIsIrrelevant(text)) {
      push({ kind, day, reason: 'photo_irrelevant_subject', detail: text.slice(0, 80) })
    }
  }

  const cover = input.cover
  if (cover && cover.url.trim()) {
    const locked = coverLocked(cover.source)
    measure('cover', null, cover.url, locked)
    if (!locked) {
      const conflict = input.usage.conflict(photoIdentityKeys({ url: cover.url, externalId: cover.externalId, originalLink: cover.originalLink }), input.productId)
      if (conflict) push({ kind: 'cover', day: null, reason: 'photo_public_duplicate', detail: `used by ${conflict.productId}(${conflict.role})` })
      const text = textOf(cover.originalLink)
      subject('cover', null, text)
      if (text.length >= 3 && !cover.sightMatch) {
        const sight = sightProfile(String(cover.placeLabel ?? ''))
        const anchors = [...input.destinationTerms]
        const hit = sightMatchInText(sight, text, anchors) ?? (anchors.map(foldPhotoText).filter(Boolean).some((a) => ` ${text} `.includes(` ${a} `)) ? 'dest' : null)
        if (!hit) push({ kind: 'cover', day: null, reason: 'photo_sight_mismatch', detail: `no place in "${text.slice(0, 60)}"` })
      }
    }
  }

  let days: unknown
  try {
    days = input.schedule ? JSON.parse(input.schedule) : []
  } catch {
    days = []
  }
  if (Array.isArray(days)) {
    for (const [i, raw] of (days as Array<Record<string, unknown>>).entries()) {
      const url = String(raw?.imageUrl ?? '').trim()
      if (!url) continue
      const day = Math.floor(Number(raw.day)) > 0 ? Math.floor(Number(raw.day)) : i + 1
      const locked = raw.imageManualSelected === true
      measure('day', day, url, locked)
      if (locked) continue
      const src = raw.imageSource && typeof raw.imageSource === 'object' ? (raw.imageSource as Record<string, unknown>) : {}
      const link = String(src.originalLink ?? raw.imageSourcePageUrl ?? '')
      const conflict = input.usage.conflict(photoIdentityKeys({ url, externalId: String(src.externalId ?? ''), originalLink: link }), input.productId)
      if (conflict) push({ kind: 'day', day, reason: 'photo_public_duplicate', detail: `used by ${conflict.productId}(${conflict.role})` })
      const text = textOf(link)
      subject('day', day, text)
      const d = deriveDaySights(
        {
          title: typeof raw.title === 'string' ? raw.title : null,
          routeText: typeof raw.routeText === 'string' ? raw.routeText : null,
          description: typeof raw.description === 'string' ? raw.description : null,
          imageKeyword: typeof raw.imageKeyword === 'string' ? raw.imageKeyword : null,
          imageKeyword2: typeof raw.imageKeyword2 === 'string' ? raw.imageKeyword2 : null,
        },
        input.destinationTerms.join(' '),
      )
      if (d.sights.length === 0) continue
      const anchors = [...d.cityTerms, ...input.destinationTerms]
      const profiles = d.sights.map(sightProfile)
      const storedSight = String(src.sight ?? '').trim()
      const evidence =
        String(src.sightMatch ?? '').trim() !== '' &&
        storedSight !== '' &&
        profiles.some((p) => sightsOverlap(p, sightProfile(storedSight)) || foldPhotoText(p.name) === foldPhotoText(storedSight))
      if (evidence) continue
      const textHit = text.length >= 3 && profiles.some((p) => sightMatchInText(p, text, anchors) != null)
      if (!textHit) push({ kind: 'day', day, reason: 'photo_sight_mismatch', detail: text.length >= 3 ? `no sight in "${text.slice(0, 60)}"` : 'unverified (no title/tags)' })
    }
  }
  return { ok: blocks.length === 0, blocks }
}

/** 상품 단위 등록 차단 사유 코드(중복 제거). 해상도·용량은 기존 검사의 사유와 같은 뜻이라 따로 올리지 않는다. */
export function registrationBlockCodes(blocks: readonly RegistrationPhotoBlock[]): Array<'photo_sight_mismatch' | 'photo_public_duplicate' | 'photo_irrelevant_subject'> {
  const out = new Set<'photo_sight_mismatch' | 'photo_public_duplicate' | 'photo_irrelevant_subject'>()
  for (const b of blocks) {
    if (b.reason === 'photo_sight_mismatch' || b.reason === 'photo_public_duplicate' || b.reason === 'photo_irrelevant_subject') out.add(b.reason)
  }
  return [...out]
}
