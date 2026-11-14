/**
 * 사진 자동 채움·자가 힐·야간 점검이 같이 쓰는 후보 찾기(외부 호출은 주입).
 * 순서: 명소 이름 검색 → Pexels → Unsplash. AI 생성은 호출하지 않는다.
 * 호출 규칙: 동시 호출 없음(순차), 호출마다 간격+지터(pause), 읽기 재시도 최대 1회, 외부 장애·한도는 사유만 남기고 다음으로.
 * 칸당 확인하는 후보는 AUTOFILL_MAX_CANDIDATES_PER_SLOT(5)개까지 — 넘으면 예외 목록으로.
 * REGRESSION-FREEZE[photo-autofill-acquire]: 순차·재시도 1회·후보 5개 상한·AI 없음 — manifest
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
  sightProfile,
  sightSearchQueries,
  type DaySightInput,
} from '@/lib/photo-autofill-sight'
import type { PhotoException, PhotoExceptionOrigin } from '@/lib/photo-exception-list'

export type StockTier = 'pexels' | 'unsplash'

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
  /** 사진 풀(NCLOUD)에 올리고 저장본을 측정한다. DB 쓰기는 이 안에서만 일어난다. */
  commit: (c: AutofillCandidate, ctx: { kind: AutofillSlotKind; day: number | null; label: string }) => Promise<AcquireCommitResult>
  /** 외부 호출 전 간격+지터 */
  pause: () => Promise<void>
  now?: () => Date
}

export type AcquireTried = { tier: StockTier; query: string; id: string; outcome: 'rejected' | 'commit_failed' | 'stored_rejected' | 'adopted'; reasons: string[] }

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
  /** 이미 쓰고 있거나(같은 상품) 방금 막힌 사진의 식별 키 */
  exclude?: ReadonlySet<string>
  maxCandidates?: number
  origin: PhotoExceptionOrigin
}

export type AcquireOk = {
  ok: true
  photo: AcquireCommitOk & { sight: string; matched: string; query: string }
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
  if (sights.length === 0 && input.dayFacts) {
    const d = deriveDaySights(input.dayFacts, input.destinationText)
    sights = d.sights
    if (cityTerms.length === 0) cityTerms = d.cityTerms
    if (sights.length === 0) return fail(`no_sight:${d.reason}`, 'no visited sight in itinerary text', null, null, true)
  }
  if (sights.length === 0) return fail('no_sight:no_sight', 'no sight given', null, null, true)
  if (cityTerms.length === 0 && input.dayFacts) cityTerms = deriveDaySights(input.dayFacts, input.destinationText).cityTerms
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

  outer: for (const sight of sights.slice(0, MAX_SIGHTS_PER_SLOT)) {
    const profile = sightProfile(sight)
    if (profile.kind !== 'sight' && profile.kind !== 'generic') continue
    lastSight = sight
    for (const query of sightSearchQueries(sight, cityTerms)) {
      lastQuery = query
      for (const tier of ['pexels', 'unsplash'] as const) {
        if (deps.stockStopped(tier)) {
          limitNotes.add(`${tier}_limit`)
          continue
        }
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
        for (const p of rankAutofillCandidates(passing)) {
          if (evaluated >= max) {
            limitNotes.add('candidate_cap')
            break outer
          }
          evaluated++
          const res = await deps.commit(p.candidate, { kind: input.kind, day: input.day, label: sight.slice(0, 80) })
          if (!res.ok) {
            bump(`commit_${res.reason}`)
            tried.push({ tier, query, id: p.candidate.id, outcome: 'commit_failed', reasons: [res.reason] })
            continue
          }
          const size = evaluateStoredPhotoSize({ kind: input.kind, bytes: res.bytes, width: res.width })
          if (size.length > 0) {
            for (const r of size) bump(`stored_${r}`)
            tried.push({ tier, query, id: p.candidate.id, outcome: 'stored_rejected', reasons: size })
            continue
          }
          tried.push({ tier, query, id: p.candidate.id, outcome: 'adopted', reasons: [] })
          return { ok: true, tried, photo: { ...res, sight, matched: p.matched ?? sight, query } }
        }
      }
    }
  }

  const limit = [...limitNotes].find((n) => n !== 'candidate_cap') ?? null
  const reason = !anyCandidate
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
