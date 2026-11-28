/**
 * 사진 자동 채움·자가 힐·야간 점검이 같이 쓰는 후보 찾기(외부 호출은 주입).
 * 순서(R03-06·R03-17): 풀 → Pexels → 출처불필요 CC0·PD → Unsplash → (Pixabay는 Pexels 멈춤 때 R03-17). iStock 신규 연동 없음(기존 구매분만). 공공누리 연동 없음. Gemini·AI 금지, 못 찾으면 비움.
 * 호출 규칙: 동시 호출 없음(순차), 호출마다 간격+지터(pause), 읽기 재시도 최대 1회, 외부 장애·한도는 사유만 남기고 다음으로.
 * 칸당 확인하는 후보는 AUTOFILL_MAX_CANDIDATES_PER_SLOT(5)개까지 — 넘으면 예외 목록으로.
 * 흑백 사진은 대표·일차 모두 저장 전에 버린다(deps.isMonochrome, 사장님 11/22).
 * REGRESSION-FREEZE[photo-monochrome-all-slots-1122]: 자동 채움 후보는 대표·일차 모두 흑백 판정 후 저장 — manifest
 * REGRESSION-FREEZE[photo-autofill-acquire]: 순차·재시도 1회·후보 5개 상한·생성 금지(못 찾으면 비움) — manifest
 */
import {
  AUTOFILL_MAX_CANDIDATES_PER_SLOT,
  evaluateAutofillCandidate,
  evaluateStoredPhotoSize,
  photoIdentityKeys,
  rankAutofillCandidates,
  type AutofillCandidate,
  type AutofillSlotKind,
  type PublicPhotoUsage,
} from '@/lib/photo-autofill-gate'
import {
  deriveDaySights,
  sightCoreQuery,
  sightProfile,
  sightSearchQueries,
  sightsOverlap,
  type DaySightInput,
} from '@/lib/photo-autofill-sight'
import { planDayPhotoSave } from '@/lib/photo-day-save-gate-1128'
import type { PhotoException, PhotoExceptionOrigin } from '@/lib/photo-exception-list'
import { orderThumbnailCandidates } from '@/lib/thumbnail-pick'

export type StockTier = 'pexels' | 'unsplash' | 'pixabay'

export type AcquireCommitOk = {
  ok: true
  url: string
  bytes: number | null
  width: number | null
  source: string
  photographer: string
  originalLink: string
  externalId?: string
}
export type AcquireCommitResult = AcquireCommitOk | { ok: false; reason: string }

export type AcquireDeps = {
  search: (tier: StockTier, query: string, perPage: number) => Promise<AutofillCandidate[]>
  stockStopped: (tier: StockTier) => boolean
  /** 출처를 아예 건너뛸 사유(키 없음 등). 있으면 그 사유를 notes 에 남기고 부르지 않는다 */
  stockOffReason?: (tier: StockTier) => string | null
  /** 사진 풀(NCLOUD)에 올리고 저장본을 측정한다. DB 쓰기는 이 안에서만 일어난다. */
  commit: (c: AutofillCandidate, ctx: { kind: AutofillSlotKind; day: number | null; label: string }) => Promise<AcquireCommitResult>
  /** 외부 호출 전 간격+지터 */
  pause: () => Promise<void>
  /** 새로 찾기 전에 사진 풀에서 같은 방문지 사진을 읽는다. 없으면 빈 배열. 도시 이름만 맞는 행은 관문이 버린다. */
  lookupPool?: (sight: string, cityTerms: readonly string[]) => Promise<AutofillCandidate[]>
  /** 표기 의무 없는 CC0·퍼블릭도메인. 없으면 이 단계는 건너뛴다. */
  searchCc0?: (query: string, perPage: number) => Promise<AutofillCandidate[]>
  /** 재고가 하나도 없을 때만 1장. null 이면 예외 '생성 대상'. */
  generate?: (input: { sight: string; cityTerms: readonly string[] }) => Promise<AutofillCandidate | null>
  /** 흑백 판정(사장님 11/22: 대표·일차 모두 흑백 금지). true 면 저장 전에 버린다. 판정 실패는 false(막지 않음). */
  isMonochrome?: (c: AutofillCandidate) => Promise<boolean>
  now?: () => Date
}

/** 실사진 출처를 모두 돌고도 못 찾은 칸(생성 없음) — 오늘 우선 상한 뒤로 보내는 표시 */
export const NO_REAL_PHOTO_NOTE = 'no_real_photo'

export type AcquireTried = { tier: StockTier | 'pool' | 'cc0' | 'generate'; query: string; id: string; outcome: 'rejected' | 'commit_failed' | 'stored_rejected' | 'adopted'; reasons: string[] }

export type AcquireInput = {
  productId: string
  kind: AutofillSlotKind
  day: number | null
  /** 일차 사실(명소 추출용). sights 가 있으면 그것을 우선 */
  dayFacts?: DaySightInput
  sights?: readonly string[]
  /** 도시 낱말(영문) — 검색어 보강·도시 일치 판정. 없으면 dayFacts 에서 읽는다 */
  cityTerms?: readonly string[]
  destinationText: string
  usage: PublicPhotoUsage
  /** 일정 마지막 일차(출국·귀국 판정). 없으면 day */
  maxDay?: number
  /** 이미 쓰고 있거나(같은 상품) 방금 막힌 사진의 식별 키 */
  exclude?: ReadonlySet<string>
  maxCandidates?: number
  origin: PhotoExceptionOrigin
}

export type AcquireOk = {
  ok: true
  photo: AcquireCommitOk & { sight: string; matched: string; query: string; via: AcquireTried['tier'] }
  tried: AcquireTried[]
}
export type AcquireFail = {
  ok: false
  /** 명소가 없는 날(검색 대상 아님) — 예외 목록 대상이 아니다 */
  skipped: boolean
  exception: PhotoException
  tried: AcquireTried[]
}
export type AcquireResult = AcquireOk | AcquireFail

const MAX_SIGHTS_PER_SLOT = 2
const PER_PAGE = 15

function topReason(counts: Record<string, number>): string | null {
  let best: [string, number] | null = null
  for (const [k, n] of Object.entries(counts)) if (!best || n > best[1]) best = [k, n]
  return best ? best[0] : null
}

export async function acquireVerifiedPhoto(input: AcquireInput, deps: AcquireDeps): Promise<AcquireResult> {
  const at = (deps.now?.() ?? new Date()).toISOString()
  const max = Math.max(1, input.maxCandidates ?? AUTOFILL_MAX_CANDIDATES_PER_SLOT)
  const tried: AcquireTried[] = []
  const fail = (reason: string, detail: string, sight: string | null, query: string | null, skipped = false): AcquireFail => ({
    ok: false,
    skipped,
    tried,
    exception: { productId: input.productId, day: input.day, kind: input.kind, sight, query, reason, detail, origin: input.origin, at },
  })

  let sights: string[] = [...(input.sights ?? [])]
  let cityTerms: string[] = [...(input.cityTerms ?? [])]
  const derived = input.dayFacts ? deriveDaySights(input.dayFacts, input.destinationText) : null
  if (input.kind === 'day' && input.dayFacts) {
    const plan = planDayPhotoSave(
      { ...input.dayFacts, day: input.day },
      { destinationText: input.destinationText, maxDay: input.maxDay ?? (Number(input.day) || 1) },
    )
    if (plan.action === 'empty') return fail(plan.reason, 'travel/airport-only day must stay empty', null, null, true)
    if (plan.action === 'search') {
      if (sights.length === 0) sights = plan.sights
      else {
        const kept = sights.filter((s) => plan.sights.some((a) => sightsOverlap(sightProfile(s), sightProfile(a))))
        sights = kept.length > 0 ? kept : plan.sights
      }
    } else if (sights.length === 0) return fail(`no_sight:${plan.reason}`, 'no visited sight in itinerary text', null, null, true)
  } else if (sights.length === 0 && derived) {
    sights = derived.sights
    if (sights.length === 0) return fail(`no_sight:${derived.reason}`, 'no visited sight in itinerary text', null, null, true)
  }
  if (sights.length === 0) return fail('no_sight:no_sight', 'no sight given', null, null, true)
  if (derived) cityTerms = [...new Set([...cityTerms, ...derived.cityTerms])]
  const slotText = [input.dayFacts?.routeText, input.dayFacts?.title, input.dayFacts?.description, input.destinationText].filter(Boolean).join(' ')

  const exclude = input.exclude ?? new Set<string>()
  const seen = new Set<string>()
  const rejectCounts: Record<string, number> = {}
  const limitNotes = new Set<string>()
  let evaluated = 0
  let anyCandidate = false
  let lastSight: string | null = null
  let lastQuery: string | null = null
  const bump = (k: string) => {
    rejectCounts[k] = (rejectCounts[k] ?? 0) + 1
  }

  const consider = async (
    cands: readonly AutofillCandidate[],
    tier: AcquireTried['tier'],
    query: string,
    profile: ReturnType<typeof sightProfile>,
    sightLabel: string,
  ): Promise<AcquireOk | 'cap' | null> => {
    const passing: Array<{ candidate: AutofillCandidate; matched: string | null }> = []
    for (const c of cands) {
      const keys = photoIdentityKeys({ url: c.url, externalId: c.id, originalLink: c.originalLink })
      const seenKey = `${c.source}:${c.id}`
      if (seen.has(seenKey)) continue
      seen.add(seenKey)
      anyCandidate = true
      if (keys.some((k) => exclude.has(k))) {
        bump('excluded')
        continue
      }
      const verdict = evaluateAutofillCandidate({
        candidate: c,
        sight: profile,
        cityTerms,
        slotText,
        slotKind: input.kind,
        productId: input.productId,
        usage: input.usage,
      })
      if (!verdict.ok) {
        for (const r of verdict.reasons) bump(r)
        tried.push({ tier, query, id: c.id, outcome: 'rejected', reasons: verdict.reasons })
        continue
      }
      passing.push({ candidate: c, matched: verdict.matched })
    }
    const ranked = rankAutofillCandidates(passing)
    const ordered =
      input.kind === 'cover'
        ? orderThumbnailCandidates(ranked, input.productId, (p) =>
            input.usage.coverUseCount(
              photoIdentityKeys({ url: p.candidate.url, externalId: p.candidate.id, originalLink: p.candidate.originalLink }),
              input.productId,
            ),
          )
        : ranked
    for (const p of ordered) {
      if (evaluated >= max) {
        limitNotes.add('candidate_cap')
        return 'cap'
      }
      evaluated++
      if (deps.isMonochrome && (await deps.isMonochrome(p.candidate).catch(() => false))) {
        bump('monochrome')
        tried.push({ tier, query, id: p.candidate.id, outcome: 'rejected', reasons: ['monochrome'] })
        continue
      }
      const res = await deps.commit(p.candidate, { kind: input.kind, day: input.day, label: sightLabel.slice(0, 80) })
      if (!res.ok) {
        bump(`commit_${res.reason}`)
        tried.push({ tier, query, id: p.candidate.id, outcome: 'commit_failed', reasons: [res.reason] })
        continue
      }
      // REGRESSION-FREEZE[autofill-commit-own-dup-1122]: 저장 단계가 같은 원본의 기존 풀 파일을 돌려주면 주소가 바뀐다 — 저장본으로 같은 상품 중복을 다시 거른다 — manifest
      if (photoIdentityKeys({ url: res.url, externalId: res.externalId, originalLink: res.originalLink }).some((k) => exclude.has(k))) {
        bump('excluded')
        tried.push({ tier, query, id: p.candidate.id, outcome: 'stored_rejected', reasons: ['excluded_after_commit'] })
        continue
      }
      const size = evaluateStoredPhotoSize({ kind: input.kind, bytes: res.bytes, width: res.width })
      if (size.length > 0) {
        for (const r of size) bump(`stored_${r}`)
        tried.push({ tier, query, id: p.candidate.id, outcome: 'stored_rejected', reasons: size })
        continue
      }
      tried.push({ tier, query, id: p.candidate.id, outcome: 'adopted', reasons: [] })
      return { ok: true, tried, photo: { ...res, sight: sightLabel, matched: p.matched ?? sightLabel, query, via: tier } }
    }
    return null
  }

  for (const sight of sights.slice(0, MAX_SIGHTS_PER_SLOT)) {
    const profile = sightProfile(sight)
    if (profile.kind !== 'sight' && profile.kind !== 'generic') continue
    lastSight = sight
    if (deps.lookupPool) {
      let pool: AutofillCandidate[] = []
      try {
        pool = await deps.lookupPool(sight, cityTerms)
        // REGRESSION-FREEZE[photo-sight-core-1127]: 풀도 고유명 축약 이름으로 한 번 더 찾는다 — manifest
        const core = sightCoreQuery(sight)
        if (core) pool = [...pool, ...(await deps.lookupPool(core, cityTerms))]
      } catch {
        limitNotes.add('pool_error')
      }
      lastQuery = sight
      const pooled = await consider(pool, 'pool', sight, profile, sight)
      if (pooled === 'cap') break
      if (pooled) return pooled
    }
    // REGRESSION-FREEZE[photo-source-order-1127]: 풀 → Pexels → Openverse/Wikimedia CC0·PD → Unsplash(→ Pixabay). Pexels 멈춤 중엔 free-src-1128(R03-17). AI 생성 없음 — manifest
    const queries = sightSearchQueries(sight)
    const stockRound = async (tier: StockTier): Promise<AcquireOk | 'cap' | null> => {
      const off = deps.stockOffReason?.(tier) ?? null
      if (off) {
        limitNotes.add(off)
        return null
      }
      for (const query of queries) {
        if (deps.stockStopped(tier)) {
          limitNotes.add(`${tier}_limit`)
          return null
        }
        lastQuery = query
        await deps.pause()
        let cands: AutofillCandidate[]
        try {
          cands = await deps.search(tier, query, PER_PAGE)
        } catch {
          await deps.pause()
          try {
            cands = await deps.search(tier, query, PER_PAGE)
          } catch {
            limitNotes.add(`${tier}_error`)
            continue
          }
        }
        if (deps.stockStopped(tier)) limitNotes.add(`${tier}_limit`)
        const picked = await consider(cands, tier, query, profile, sight)
        if (picked) return picked
      }
      return null
    }
    const cc0Round = async (): Promise<AcquireOk | 'cap' | null> => {
      if (!deps.searchCc0) return null
      let cc0Hit: AcquireOk | 'cap' | null = null
      for (const query of queries) {
        lastQuery = query
        await deps.pause()
        let cands: AutofillCandidate[]
        try {
          cands = await deps.searchCc0(query, PER_PAGE)
        } catch {
          await deps.pause()
          try {
            cands = await deps.searchCc0(query, PER_PAGE)
          } catch {
            limitNotes.add('cc0_error')
            continue
          }
        }
        cc0Hit = await consider(cands, 'cc0', query, profile, sight)
        if (cc0Hit) break
      }
      return cc0Hit
    }
    // REGRESSION-FREEZE[free-src-1128]: 사장님 11/28 08:08·08:10 — Pexels 가 멈춘 동안(잔여 0) 풀 → Unsplash → Pixabay → Openverse/Wikimedia CC0·PD.
    // Pexels 가 살아 있으면 풀 → Pexels → CC0·PD → Unsplash → Pixabay (R03-06). 멈춤 중엔 풀 → Unsplash → Pixabay → Openverse (R03-17). iStock·공공누리 연동 없음. AI 없음 — manifest
    const pexelsOff = deps.stockStopped('pexels')
    if (pexelsOff) limitNotes.add('pexels_limit')
    const order: Array<'pexels' | 'unsplash' | 'pixabay' | 'cc0'> = pexelsOff
      ? ['unsplash', 'pixabay', 'cc0']
      : ['pexels', 'cc0', 'unsplash', 'pixabay']
    let capped = false
    for (const step of order) {
      let hit: AcquireOk | 'cap' | null = null
      if (step === 'pexels') {
        const pexels = await stockRound('pexels')
        hit = pexels
      } else if (step === 'unsplash') {
        const unsplash = await stockRound('unsplash')
        hit = unsplash
      } else if (step === 'pixabay') {
        hit = await stockRound('pixabay')
      } else {
        hit = await cc0Round()
      }
      if (hit === 'cap') {
        capped = true
        break
      }
      if (hit) return hit
    }
    if (capped) break
  }

  // REGRESSION-FREEZE[no-ai-photo-1127] / PHOTO-RULES 5: Gemini·AI 생성 금지. 실사진을 다 돌고도 못 찾으면 빈칸(no_real_photo) — manifest
  if (lastSight && input.kind !== 'cover') limitNotes.add(NO_REAL_PHOTO_NOTE)

  const limit = [...limitNotes].find((n) => n !== 'candidate_cap' && n !== '생성 대상' && n !== NO_REAL_PHOTO_NOTE) ?? null
  const reason = limitNotes.has('생성 대상')
    ? '생성 대상'
    : !anyCandidate
      ? (limit ?? 'no_candidates')
      : limitNotes.has('candidate_cap') && evaluated >= max
        ? 'candidate_cap'
        : (topReason(rejectCounts) ?? 'no_verified_candidate')
  const detail = [
    `rejects=${Object.entries(rejectCounts).map(([k, n]) => `${k}:${n}`).join(',') || '-'}`,
    `evaluated=${evaluated}/${max}`,
    limitNotes.size ? `notes=${[...limitNotes].join(',')}` : '',
  ]
    .filter(Boolean)
    .join(' ')
  return fail(reason, detail, lastSight, lastQuery)
}
