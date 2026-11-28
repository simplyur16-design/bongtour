/**
 * 등록(상태 전환) 전 사진 게이트 — 기존 자동 등록 검사에 '더하기만' 한다(기존 guard 완화 없음).
 * 막는 사유(칸 단위):
 *  photo_sight_mismatch   그날 방문 명소와 맞지 않거나 맞는지 확인할 근거가 없음
 *  photo_public_duplicate 예전 기록용. 상품 간 썸네일·일차 같은 사진은 막지 않는다(R03-12·봉실장 12:18).
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
  photoSubjectIsTextOrMap,
  type PublicPhotoUsage,
} from '@/lib/photo-autofill-gate'
import {
  deriveDaySights,
  foldPhotoText,
  scheduleOtherDaysText,
  scheduleRowSupplierText,
  isCityOnlySight,
  sightMatchInText,
  sightProfile,
  sightsOverlap,
} from '@/lib/photo-autofill-sight'
import { textHasMonochromeMarker } from '@/lib/photo-monochrome-text-1122'
import { planDayPhotoSave } from '@/lib/photo-day-save-gate-1128'
import { photoCandidateText, photoSubjectBlockReason } from '@/lib/register-photo-subject-filter'

export type RegistrationPhotoReason =
  | 'photo_sight_mismatch'
  | 'photo_public_duplicate'
  | 'photo_irrelevant_subject'
  | 'photo_low_res'
  | 'photo_over_bytes'
  | 'photo_not_measured'
  | 'photo_text_map'
  | 'photo_ai_generated'
  | 'photo_monochrome_text'
  | 'photo_in_product_duplicate'
  | 'photo_travel_day_empty'

/** 이미 들어 있는 사진 중 실사진으로 바꿀 칸 사유(지도·간판, AI 생성, 흑백 표시, 상품 안 중복, 그날 명소와 다른 사진) */
export const WRONG_PHOTO_REPLACE_REASONS: ReadonlySet<RegistrationPhotoReason> = new Set([
  'photo_sight_mismatch',
  'photo_irrelevant_subject',
  'photo_text_map',
  'photo_ai_generated',
  'photo_monochrome_text',
  'photo_in_product_duplicate',
  'photo_travel_day_empty',
  'photo_public_duplicate',
])

/** '저장된 명소가 그날 원문 명소에 없음' — 근거가 확실한 불일치(공개 상품 교체 대상) */
export const STORED_SIGHT_MISMATCH_DETAIL = 'stored sight not in day:'
/** '출처 메타(원본 페이지·제목·alt)가 그날 정답 명소와 다름' — 이름-내용 불일치(공개 상품 교체 대상) */
export const SOURCE_META_MISMATCH_DETAIL = 'source_meta_not_sight:'

// REGRESSION-FREEZE[photo-replace-wrong-1128]: AI(Gemini) 생성 사진 표시(출처 이름·주소) — manifest
const AI_SOURCE_RE = /gemini|imagen|ai[_ -]?gen|generated/i
export function photoSourceIsAiGenerated(p: { source?: unknown; url?: unknown; isGenerated?: unknown }): boolean {
  if (p.isGenerated === true) return true
  if (AI_SOURCE_RE.test(String(p.source ?? ''))) return true
  return /\/(?:gemini|ai-generated|imagen)[-_/]/i.test(String(p.url ?? ''))
}

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
    isGenerated?: boolean | null
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

const OUR_STORAGE_RE = /ncloudstorage\.com|objectstorage|\/photo-pool\//i
const STOCK_NOISE_RE = /\b(pexels|unsplash|pixabay|openverse|photo|photos|free|stock|image|images|com|www|https?|wiki|file|commons|wikipedia|upload)\b/gi

/** 저장 칸의 출처 메타만(원본 페이지·alt·title·tags). 우리 저장소 파일명은 증거로 쓰지 않는다. */
export function storedSourceEvidenceText(src: Record<string, unknown>, raw: Record<string, unknown>): string {
  const link = String(src.originalLink ?? raw.imageSourcePageUrl ?? '')
  const linkOk = link && !OUR_STORAGE_RE.test(link) ? link : ''
  const alt = typeof raw.imageAlt === 'string' ? raw.imageAlt : ''
  const title = typeof src.title === 'string' ? src.title : typeof src.alt === 'string' ? src.alt : ''
  const tags = Array.isArray(src.tags) ? src.tags.filter((x): x is string => typeof x === 'string').join(' ') : typeof src.tags === 'string' ? src.tags : ''
  return foldPhotoText(photoCandidateText([alt, title, tags, linkOk]).replace(STOCK_NOISE_RE, ' '))
}

function evidenceHasEnoughTokens(text: string): boolean {
  return text.split(' ').filter((t) => t.length >= 3 && !/^\d+$/.test(t)).length >= 2
}

function sourceMetaConflictsWithSights(evidence: string, sights: readonly string[], anchors: readonly string[]): boolean {
  if (!evidenceHasEnoughTokens(evidence)) return false
  return !sights.some((s) => sightMatchInText(sightProfile(s), evidence, anchors) != null)
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
    if (!locked && photoSourceIsAiGenerated({ source: cover.source, url: cover.url, isGenerated: cover.isGenerated })) {
      push({ kind: 'cover', day: null, reason: 'photo_ai_generated', detail: String(cover.source ?? 'generated').slice(0, 60) })
    }
    if (!locked) {
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
    const rows = days as Array<Record<string, unknown>>
    // REGRESSION-FREEZE[photo-replace-wrong-1128]: 상품 안 중복(대표·앞 일차와 같은 사진)도 교체 대상 — manifest
    const seenKeys = new Set<string>(cover && cover.url.trim() ? photoIdentityKeys({ url: cover.url, externalId: cover.externalId, originalLink: cover.originalLink }) : [])
    for (const [i, raw] of rows.entries()) {
      const url = String(raw?.imageUrl ?? '').trim()
      if (!url) continue
      const day = Math.floor(Number(raw.day)) > 0 ? Math.floor(Number(raw.day)) : i + 1
      const locked = raw.imageManualSelected === true
      measure('day', day, url, locked)
      const src = raw.imageSource && typeof raw.imageSource === 'object' ? (raw.imageSource as Record<string, unknown>) : {}
      const link = String(src.originalLink ?? raw.imageSourcePageUrl ?? '')
      const keys = photoIdentityKeys({ url, externalId: String(src.externalId ?? ''), originalLink: link })
      const dup = keys.some((k) => seenKeys.has(k))
      for (const k of keys) seenKeys.add(k)
      if (locked) continue
      if (dup) push({ kind: 'day', day, reason: 'photo_in_product_duplicate', detail: 'same photo as cover or an earlier day' })
      // 일차 사진은 다른 상품과 같아도 된다(사장님 12:01). 목록 카드 대표만 위에서 막는다.
      if (photoSourceIsAiGenerated({ source: src.source ?? raw.imageSourceType, url, isGenerated: raw.imageIsGenerated })) {
        push({ kind: 'day', day, reason: 'photo_ai_generated', detail: String(src.source ?? 'generated').slice(0, 60) })
      }
      if ([url, link, raw.imageAlt].some((t) => textHasMonochromeMarker(typeof t === 'string' ? t : ''))) {
        push({ kind: 'day', day, reason: 'photo_monochrome_text', detail: 'monochrome marker in photo text' })
      }
      const text = textOf(link)
      subject('day', day, text)
      const d = deriveDaySights(
        {
          title: typeof raw.title === 'string' ? raw.title : null,
          routeText: typeof raw.routeText === 'string' ? raw.routeText : null,
          description: typeof raw.description === 'string' ? raw.description : null,
          imageKeyword: typeof raw.imageKeyword === 'string' ? raw.imageKeyword : null,
          imageKeyword2: typeof raw.imageKeyword2 === 'string' ? raw.imageKeyword2 : null,
          // REGRESSION-FREEZE[photo-replace-wrong-1128]: 이미 든 사진도 그날 공급사 원문 명소로 판정(다른 일차 명소 키워드 사진은 불일치) — manifest
          supplierText: scheduleRowSupplierText(raw as never),
          otherDaysText: scheduleOtherDaysText(rows as never, day),
        },
        input.destinationTerms.join(' '),
      )
      const maxDay = Math.max(1, ...rows.map((r, i) => (Math.floor(Number(r.day)) > 0 ? Math.floor(Number(r.day)) : i + 1)))
      const plan = planDayPhotoSave(
        {
          day,
          title: typeof raw.title === 'string' ? raw.title : null,
          routeText: typeof raw.routeText === 'string' ? raw.routeText : null,
          description: typeof raw.description === 'string' ? raw.description : null,
          hotelText: typeof raw.hotelText === 'string' ? raw.hotelText : null,
          imageKeyword: typeof raw.imageKeyword === 'string' ? raw.imageKeyword : null,
          imageKeyword2: typeof raw.imageKeyword2 === 'string' ? raw.imageKeyword2 : null,
          supplierText: scheduleRowSupplierText(raw as never),
          otherDaysText: scheduleOtherDaysText(rows as never, day),
        },
        { destinationText: input.destinationTerms.join(' '), maxDay, allRows: rows as never },
      )
      if (plan.action === 'empty') {
        push({ kind: 'day', day, reason: 'photo_travel_day_empty', detail: plan.reason })
        continue
      }
      const expectedSights = (plan.action === 'search' ? plan.sights : []).filter((s) => !isCityOnlySight(s) && sightProfile(s).kind !== 'city')
      if (text.length >= 3 && photoSubjectIsTextOrMap(text, expectedSights.length ? expectedSights : d.sights)) {
        push({ kind: 'day', day, reason: 'photo_text_map', detail: text.slice(0, 80) })
      }
      // 정답 명소는 plan(원문 1순위·출국/귀국/이동일 대표명소). 잔여 imageKeyword 가 들어간 derive 만으로는 통과시키지 않는다.
      if (expectedSights.length === 0) continue
      const anchors = [...plan.derived.cityTerms, ...input.destinationTerms]
      const storedSight = String(src.sight ?? '').trim()
      const evidenceText = storedSourceEvidenceText(src, raw)
      const slotText = [raw.title, raw.routeText, raw.description].map((x) => (typeof x === 'string' ? x : '')).join(' ')
      const subjectBlock = photoSubjectBlockReason(evidenceText || text, {
        query: expectedSights[0] ?? null,
        destination: input.destinationTerms.join(' '),
        productText: slotText,
      })
      if (subjectBlock === 'interior_not_place' || subjectBlock === 'animal_not_in_itinerary' || subjectBlock === 'unrelated_object') {
        push({ kind: 'day', day, reason: 'photo_irrelevant_subject', detail: `${subjectBlock}: ${(evidenceText || text).slice(0, 60)}` })
        continue
      }
      const labelFits =
        storedSight !== '' &&
        !isCityOnlySight(storedSight) &&
        expectedSights.some((s) => {
          const p = sightProfile(s)
          return sightsOverlap(p, sightProfile(storedSight)) || foldPhotoText(p.name) === foldPhotoText(storedSight)
        })
      const metaConflicts = sourceMetaConflictsWithSights(evidenceText, expectedSights, anchors)
      // 저장 라벨이 그날 정답 명소가 아니면 그 사유를 우선(다른 날 키워드). 라벨은 맞는데 출처 메타가 다르면 이름-내용.
      if (!labelFits && storedSight !== '') {
        push({
          kind: 'day',
          day,
          reason: 'photo_sight_mismatch',
          detail: `${STORED_SIGHT_MISMATCH_DETAIL} "${storedSight.slice(0, 40)}" vs ${expectedSights.slice(0, 2).join(' / ').slice(0, 60)}`,
        })
        continue
      }
      if (metaConflicts) {
        push({
          kind: 'day',
          day,
          reason: 'photo_sight_mismatch',
          detail: `${SOURCE_META_MISMATCH_DETAIL} "${evidenceText.slice(0, 60)}" vs ${expectedSights.slice(0, 2).join(' / ').slice(0, 60)}`,
        })
        continue
      }
      if (labelFits) continue
      const textHit = evidenceText.length >= 3 && expectedSights.some((s) => sightMatchInText(sightProfile(s), evidenceText, anchors) != null)
      if (textHit) continue
      push({
        kind: 'day',
        day,
        reason: 'photo_sight_mismatch',
        detail:
          storedSight !== ''
            ? `${STORED_SIGHT_MISMATCH_DETAIL} "${storedSight.slice(0, 40)}" vs ${expectedSights.slice(0, 2).join(' / ').slice(0, 60)}`
            : evidenceText.length >= 3
              ? `no sight in "${evidenceText.slice(0, 60)}"`
              : 'unverified (no title/tags)',
      })
    }
  }
  return { ok: blocks.length === 0, blocks }
}

/** 상품 단위 등록 차단 사유 코드(중복 제거). 해상도·용량은 기존 검사의 사유와 같은 뜻이라 따로 올리지 않는다. */
export function registrationBlockCodes(
  blocks: readonly RegistrationPhotoBlock[],
): Array<'photo_sight_mismatch' | 'photo_public_duplicate' | 'photo_irrelevant_subject' | 'photo_wrong_kind'> {
  const out = new Set<'photo_sight_mismatch' | 'photo_public_duplicate' | 'photo_irrelevant_subject' | 'photo_wrong_kind'>()
  for (const b of blocks) {
    if (b.reason === 'photo_sight_mismatch' || b.reason === 'photo_public_duplicate' || b.reason === 'photo_irrelevant_subject' || b.reason === 'photo_travel_day_empty') {
      out.add(b.reason === 'photo_travel_day_empty' ? 'photo_sight_mismatch' : b.reason)
    }
    if (b.reason === 'photo_text_map' || b.reason === 'photo_ai_generated' || b.reason === 'photo_monochrome_text' || b.reason === 'photo_in_product_duplicate') out.add('photo_wrong_kind')
  }
  return [...out]
}
