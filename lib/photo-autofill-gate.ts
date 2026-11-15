/**
 * 사진 자동 채움 — 후보 채택 관문(순수 함수, 네트워크·DB 없음).
 * 모두 통과해야 채택:
 *  (a) 사진 제목·설명·alt·태그에 그날 명소 이름(또는 별칭)이 있어야 한다. 도시 이름만 맞으면 탈락.
 *  (b) 사람이 주인공인 사진(portrait·woman·man·person·selfie·model 등 태그·제목) 탈락. 풍경 속 작은 사람·간판은 허용.
 *  (c) 목록 카드 대표 사진만 공개 중복을 본다. 다른 공개 상품의 대표와 출처 id·주소가 겹치면 탈락. 일차 사진은 다른 상품과 같아도 탈락하지 않는다. 같은 상품 안 재사용은 허용.
 *  (d) 가로 1200px 이상·가로형, 저장본은 대표 200,000B(카드)·일차 400,000B 미만(기존 상수 재사용).
 * 기존 관문(photoMatchGate)의 인물·차량·사물·실내·타국 명소 판정을 그대로 더해 쓴다(완화 없음).
 * REGRESSION-FREEZE[photo-autofill-gate]: 명소 이름 일치·인물 탈락·공개 중복 탈락·크기 기준 — manifest
 */
import { photoMatchGate, type MatchGateReason } from '@/lib/register-photo-match-gate'
import { photoCandidateText } from '@/lib/register-photo-subject-filter'
import { IMAGE_MIN_WIDTH } from '@/lib/product-image-source-policy'
import { DAY_PHOTO_DETAIL_MAX_BYTES } from '@/lib/register-day-photo-policy'
import { foldPhotoText, sightMatchInText, type SightProfile } from '@/lib/photo-autofill-sight'

export const AUTOFILL_MAX_CANDIDATES_PER_SLOT = 5
export const AUTOFILL_MIN_WIDTH = IMAGE_MIN_WIDTH
export const AUTOFILL_COVER_MAX_BYTES = 200_000
export const AUTOFILL_DAY_MAX_BYTES = DAY_PHOTO_DETAIL_MAX_BYTES

export type AutofillSlotKind = 'day' | 'cover'

export type AutofillCandidate = {
  /** 출처 사진 id (Pexels 숫자 id / Unsplash id) */
  id: string
  source: string
  url: string
  width: number
  height: number
  photographer?: string | null
  originalLink?: string | null
  altText?: string | null
  title?: string | null
  description?: string | null
  tags?: readonly string[] | null
  pageUrl?: string | null
  /** Unsplash: 고른 사진마다 download_location 호출(가이드라인) */
  downloadLocation?: string | null
  /** 사진 풀에 이미 있는 저장본 용량. 있으면 다시 받지 않고 이 값으로 용량 관문을 본다. */
  storedBytes?: number | null
  /** 생성 이미지 원본. 관문을 통과한 뒤에만 풀에 올린다. */
  generatedBuffer?: Buffer
}

export type AutofillRejectReason =
  | 'low_res'
  | 'portrait_orientation'
  | 'no_description'
  | 'missing_attribution'
  | 'no_sight_match'
  | 'city_only_match'
  | 'person_subject'
  | 'irrelevant_subject'
  | 'other_place'
  | 'public_duplicate'

const PERSON_PORTRAIT_RE =
  /\b(portrait|portraits|selfie|selfies|headshot|headshots|model|models|posing|poses|posed|fashion|bride|groom|wedding)\b/
const PERSON_TAG_RE = /\b(portrait|portraits|selfie|selfies|headshot|model|models|woman|women|man|men|girl|girls|boy|boys|person|persons|human|face|lady|guy)\b/
const PERSON_LEAD_RE =
  /^(a |an |the |two |three |young |old |elderly |smiling |happy |asian |beautiful |stylish |pretty |handsome |senior |little )*(man|men|woman|women|girl|girls|boy|boys|guy|lady|person|couple|child|children|kid|kids|baby|tourist|tourists|traveler|traveller|family|friends|people)\b/
const SCENE_AFTER_PERSON_RE =
  /\b(bridge|temple|pagoda|shrine|church|cathedral|mosque|palace|castle|fort|tower|ruins|monument|plaza|square|street|alley|market|harbor|harbour|pier|park|garden|cave|canyon|gorge|cliff|mountain|hill|valley|glacier|beach|bay|coast|island|lake|river|canal|waterfall|falls|forest|landscape|skyline|view|panorama)\b/
// 한 사람이 주어인 문장(a woman standing on …): 배경이 명소여도 주인공이 사람이면 탈락. 무리(people·tourists)는 풍경 속 작은 사람으로 보고 허용.
const PERSON_ACTION_RE =
  /\b(man|woman|person|girl|boy|couple|lady|guy|hiker|traveler|traveller|tourist|photographer|backpacker|child|kid)\s+(?:is |was )?(standing|sitting|walking|looking|posing|enjoying|wearing|holding|admiring|taking|overlooking|watching|exploring|gazing|stands|sits|walks|relaxing|resting|hiking|smiling|dancing|running|riding|capturing|dressed)\b/
const IRRELEVANT_RE =
  /\b(office|offices|meeting|meetings|conference|boardroom|business|desk|workspace|coworking|laptop|computer|logo|logos|watermark|banner|poster|illustration|illustrations|vector|icon|icons|screenshot|infographic|mockup|template|presentation|whiteboard|classroom)\b/

export function photoSubjectIsPerson(parts: { title: string; tags: string }): boolean {
  const title = foldPhotoText(parts.title)
  const tags = foldPhotoText(parts.tags)
  if (PERSON_PORTRAIT_RE.test(title) || PERSON_PORTRAIT_RE.test(tags)) return true
  if (tags && PERSON_TAG_RE.test(tags)) return true
  const head = title.split(' ').slice(0, 6).join(' ')
  if (PERSON_ACTION_RE.test(title)) return true
  if (PERSON_LEAD_RE.test(head) && !SCENE_AFTER_PERSON_RE.test(title)) return true
  return false
}

export function photoSubjectIsIrrelevant(text: string): boolean {
  return IRRELEVANT_RE.test(foldPhotoText(text))
}

export function candidateText(c: AutofillCandidate): string {
  return photoCandidateText([c.altText, c.title, c.description, (c.tags ?? []).join(' '), c.pageUrl ?? c.originalLink])
}

/** 같은 사진을 가리키는 식별 키(출처 id·주소). 공개 사용 색인과 후보 비교에 같이 쓴다. */
export function photoIdentityKeys(p: { url?: string | null; externalId?: string | null; originalLink?: string | null }): string[] {
  const keys: string[] = []
  const id = String(p.externalId ?? '').trim()
  if (id) keys.push(`id:${id}`)
  const link = String(p.originalLink ?? '').trim()
  const slug = /\/photo\/[^/]*?-(\d+)\/?(?:[?#].*)?$/.exec(link)
  if (slug) keys.push(`id:${slug[1]}`)
  const url = String(p.url ?? '').trim()
  const cdn = /\/photos\/(\d+)\//.exec(url)
  if (cdn) keys.push(`id:${cdn[1]}`)
  if (url) {
    try {
      const u = new URL(url)
      u.search = ''
      keys.push(`url:${u.href.toLowerCase()}`)
    } catch {
      keys.push(`url:${url.toLowerCase()}`)
    }
  }
  return [...new Set(keys)]
}

export type PhotoUseRole = 'cover' | 'day'

export class PublicPhotoUsage {
  private readonly byKey = new Map<string, Map<string, Set<PhotoUseRole>>>()

  add(productId: string, role: PhotoUseRole, keys: readonly string[]): void {
    for (const k of keys) {
      let owners = this.byKey.get(k)
      if (!owners) this.byKey.set(k, (owners = new Map()))
      let roles = owners.get(productId)
      if (!roles) owners.set(productId, (roles = new Set()))
      roles.add(role)
    }
  }

  /** 다른 상품이 이미 쓰고 있으면 그 상품과 용도. 같은 상품의 재사용은 충돌이 아니다. */
  conflict(keys: readonly string[], productId: string): { productId: string; role: PhotoUseRole } | null {
    for (const k of keys) {
      const owners = this.byKey.get(k)
      if (!owners) continue
      for (const [pid, roles] of owners) {
        if (pid === productId) continue
        return { productId: pid, role: roles.has('cover') ? 'cover' : 'day' }
      }
    }
    return null
  }

  /** 목록 카드 대표끼리만 충돌. 다른 상품의 일차 사진과 같은 것은 충돌이 아니다. */
  coverConflict(keys: readonly string[], productId: string): { productId: string; role: 'cover' } | null {
    for (const k of keys) {
      const owners = this.byKey.get(k)
      if (!owners) continue
      for (const [pid, roles] of owners) {
        if (pid === productId || !roles.has('cover')) continue
        return { productId: pid, role: 'cover' }
      }
    }
    return null
  }

  get size(): number {
    return this.byKey.size
  }
}

export type PublicUsageRow = {
  productId: string
  bgImageUrl?: string | null
  bgImageExternalId?: string | null
  bgImageSourceUrl?: string | null
  schedule?: string | null
}

type SlotLike = {
  imageUrl?: unknown
  imageUrl2?: unknown
  imageSourcePageUrl?: unknown
  imageSource?: unknown
  imageSource2?: unknown
}

function srcOf(v: unknown): { externalId: string; originalLink: string } {
  const o = v && typeof v === 'object' ? (v as Record<string, unknown>) : {}
  return { externalId: String(o.externalId ?? '').trim(), originalLink: String(o.originalLink ?? '').trim() }
}

/** 공개 상품 행들로 사용 색인을 만든다. poolIdByUrl 은 재호스팅 주소 → 원 출처 id(PhotoPool.sourcePhotoId). */
export function buildPublicPhotoUsage(rows: readonly PublicUsageRow[], poolIdByUrl?: ReadonlyMap<string, string>): PublicPhotoUsage {
  const usage = new PublicPhotoUsage()
  const withPool = (url: string, externalId: string) => (externalId || (poolIdByUrl?.get(url) ?? ''))
  for (const r of rows) {
    const cover = String(r.bgImageUrl ?? '').trim()
    if (cover) {
      usage.add(
        r.productId,
        'cover',
        photoIdentityKeys({ url: cover, externalId: withPool(cover, String(r.bgImageExternalId ?? '').trim()), originalLink: r.bgImageSourceUrl }),
      )
    }
    let days: unknown
    try {
      days = r.schedule ? JSON.parse(r.schedule) : []
    } catch {
      days = []
    }
    if (!Array.isArray(days)) continue
    for (const d of days as SlotLike[]) {
      const u1 = String(d?.imageUrl ?? '').trim()
      if (u1) {
        const s = srcOf(d.imageSource)
        usage.add(
          r.productId,
          'day',
          photoIdentityKeys({ url: u1, externalId: withPool(u1, s.externalId), originalLink: s.originalLink || String(d.imageSourcePageUrl ?? '') }),
        )
      }
      const u2 = String(d?.imageUrl2 ?? '').trim()
      if (u2) {
        const s = srcOf(d.imageSource2)
        usage.add(r.productId, 'day', photoIdentityKeys({ url: u2, externalId: withPool(u2, s.externalId), originalLink: s.originalLink }))
      }
    }
  }
  return usage
}

/** 같은 이름 다른 곳(예: Yerevan 의 Blue Mosque)을 거르는 보조 목록 [영문, 한글]. 그날 글·목적지에 있으면 허용한다. */
const FOREIGN_CITY_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ['yerevan', '예레반'], ['tbilisi', '트빌리시'], ['baku', '바쿠'], ['warsaw', '바르샤바'], ['krakow', '크라쿠프'],
  ['tallinn', '탈린'], ['riga', '리가'], ['vilnius', '빌뉴스'], ['bratislava', '브라티슬라바'], ['ljubljana', '류블랴나'],
  ['zagreb', '자그레브'], ['sarajevo', '사라예보'], ['belgrade', '베오그라드'], ['bucharest', '부쿠레슈티'], ['kyiv', '키이우'],
  ['minsk', '민스크'], ['tehran', '테헤란'], ['isfahan', '이스파한'], ['cairo', '카이로'], ['marrakech', '마라케시'],
  ['tunis', '튀니스'], ['damascus', '다마스쿠스'], ['beirut', '베이루트'], ['amman', '암만'], ['jerusalem', '예루살렘'],
  ['dubai', '두바이'], ['doha', '도하'], ['muscat', '무스카트'], ['kuala lumpur', '쿠알라룸푸르'], ['jakarta', '자카르타'],
  ['manila', '마닐라'], ['hanoi', '하노이'], ['yangon', '양곤'], ['kathmandu', '카트만두'], ['colombo', '콜롬보'],
  ['delhi', '델리'], ['mumbai', '뭄바이'], ['lima', '리마'], ['bogota', '보고타'], ['havana', '아바나'],
]

export function foreignCityInText(foldedText: string, contextRaw: string): string | null {
  const padded = ` ${foldedText} `
  const ctx = ` ${foldPhotoText(contextRaw)} `
  const ctxKo = contextRaw.replace(/\s+/g, '')
  for (const [en, ko] of FOREIGN_CITY_PAIRS) {
    if (padded.includes(` ${en} `) && !ctx.includes(` ${en} `) && !ctxKo.includes(ko)) return en
  }
  return null
}
export type AutofillGateInput = {
  candidate: AutofillCandidate
  sight: SightProfile
  /** 후보 글에 같이 있어야 하는 도시 낱말(일반 명사뿐인 명소용) + 도시만 일치 판정용 */
  cityTerms: readonly string[]
  /** 그날 일정 글 + 목적지 — 다른 도시·나라 판정의 허용 범위 */
  slotText: string
  slotKind: AutofillSlotKind
  productId: string
  usage: PublicPhotoUsage
}

export type AutofillGateResult = { ok: boolean; reasons: AutofillRejectReason[]; matched: string | null }

const GATE_REASON_MAP: Partial<Record<MatchGateReason, AutofillRejectReason>> = {
  person: 'person_subject',
  medical: 'irrelevant_subject',
  vehicle: 'irrelevant_subject',
  promo: 'irrelevant_subject',
  unrelated_object: 'irrelevant_subject',
  interior_not_place: 'irrelevant_subject',
  animal_not_in_itinerary: 'irrelevant_subject',
  other_place_landmark: 'other_place',
  city_mismatch: 'other_place',
  missing_attribution: 'missing_attribution',
  no_description: 'no_description',
}

export function evaluateAutofillCandidate(input: AutofillGateInput): AutofillGateResult {
  const { candidate: c } = input
  const reasons = new Set<AutofillRejectReason>()
  const text = candidateText(c)
  const folded = foldPhotoText(text)

  if (!(c.width >= AUTOFILL_MIN_WIDTH)) reasons.add('low_res')
  if (c.width > 0 && c.height > c.width) reasons.add('portrait_orientation')
  if (!String(c.id ?? '').trim() || !(String(c.photographer ?? '').trim() || String(c.originalLink ?? '').trim())) {
    reasons.add('missing_attribution')
  }
  if (folded.length < 3) reasons.add('no_description')

  const matched = sightMatchInText(input.sight, text, input.cityTerms)
  if (!matched && folded.length >= 3) {
    const cityHit = input.cityTerms.map(foldPhotoText).filter(Boolean).some((t) => ` ${folded} `.includes(` ${t} `))
    reasons.add(cityHit ? 'city_only_match' : 'no_sight_match')
  }

  if (photoSubjectIsPerson({ title: [c.altText, c.title, c.description, c.pageUrl].filter(Boolean).join(' '), tags: (c.tags ?? []).join(' ') })) {
    reasons.add('person_subject')
  }
  if (photoSubjectIsIrrelevant(`${text} ${(c.tags ?? []).join(' ')}`)) reasons.add('irrelevant_subject')

  if (folded.length >= 3) {
    const g = photoMatchGate(
      {
        altText: folded,
        width: c.width,
        height: c.height,
        photographer: c.photographer,
        originalLink: c.originalLink,
        externalId: c.id,
      },
      {
        placeTerms: [...input.sight.phraseTerms],
        destinationTerms: [],
        slotText: `${input.slotText} ${input.cityTerms.join(' ')} ${input.sight.name}`,
        slot: 'day',
      },
    )
    if (!g.ok && g.reason && g.reason !== 'no_place_match' && g.reason !== 'low_res' && g.reason !== 'portrait_orientation') {
      const mapped = GATE_REASON_MAP[g.reason]
      if (mapped) reasons.add(mapped)
    }
  }

  if (folded.length >= 3 && foreignCityInText(folded, `${input.slotText} ${input.cityTerms.join(' ')} ${input.sight.name}`)) reasons.add('other_place')

  if (input.slotKind === 'cover') {
    const conflict = input.usage.coverConflict(photoIdentityKeys({ url: c.url, externalId: c.id, originalLink: c.originalLink }), input.productId)
    if (conflict) reasons.add('public_duplicate')
  }

  return { ok: reasons.size === 0, reasons: [...reasons], matched }
}

export type StoredPhotoSizeReason = 'not_measured' | 'low_res' | 'over_bytes'

/** 업로드 뒤 저장본 측정값 기준. 대표는 카드 200,000B, 일차는 상세 400,000B 미만. */
export function evaluateStoredPhotoSize(input: {
  kind: AutofillSlotKind
  bytes: number | null | undefined
  width: number | null | undefined
}): StoredPhotoSizeReason[] {
  const out: StoredPhotoSizeReason[] = []
  if (input.bytes == null || input.width == null) return ['not_measured']
  if (input.width < AUTOFILL_MIN_WIDTH) out.push('low_res')
  const max = input.kind === 'cover' ? AUTOFILL_COVER_MAX_BYTES : AUTOFILL_DAY_MAX_BYTES
  if (input.bytes >= max) out.push('over_bytes')
  return out
}

/** 가로형·큰 그림·이름 일치가 구체적인 후보를 먼저. */
export function rankAutofillCandidates<T extends { candidate: AutofillCandidate; matched: string | null }>(items: readonly T[]): T[] {
  return [...items]
    .map((x, i) => ({
      x,
      i,
      s:
        (x.candidate.width >= x.candidate.height ? 4 : 0) +
        Math.min(3, Math.floor(x.candidate.width / 800)) +
        (x.matched && x.matched.includes(' ') ? 1 : 0),
    }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map((z) => z.x)
}
