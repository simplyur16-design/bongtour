/**
 * 잘못 채워진 사진 칸 교체(사장님 2026-11-28 00:03 '잘못 채워진 칸 교체 구조 고쳐서 검사 통과하면 병합·배포해').
 * - 빈칸만이 아니라 이미 든 사진도 판정한다: 그날 공급사 원문 명소와 다른 사진, 지도·간판·노선도 등 글 위주 사진,
 *   AI(Gemini) 생성 사진, 흑백 표시 사진, 상품 안 중복 사진.
 * - 교체는 실사진 경로(풀 → Pexels → Pixabay → Openverse cc0·pdm, Wikimedia 제외·Unsplash 자동 채움 제외: R03-25·R03-26)만 쓴다. 이미지 생성 없음.
 * - 실사진을 못 찾으면 기존 사진을 그대로 두고 예외 목록에 사유를 남긴다. 단 공개 단계의 Wikimedia 등 쓰지 않는 출처·확정 명소 불일치 칸은 비운다(shouldClearWhenUnreplaceable, 사장님 2026-11-29 00:14).
 * - 교체 전 값은 AssetUsageLog(heal-day / heal-cover, notes 의 prev)에 남는다(되돌림 가능).
 * - 공개 상품: 사진 칸만, 관리자가 고른 칸 제외, 저장 시 registered 상태·같은 일정일 때만 쓴다. 근거가 확실한 불일치만(저장된 명소가 그날 원문 명소에 없음).
 * - 칸 수 상한은 없다(17:16). 외부 검색 쿼터는 기존 호출 가드(Unsplash 900/h·Pixabay 60/분·Pexels 멈춤)가 지키고, 막히면 창이 풀릴 때까지 기다려 이어서 처리한다.
 * REGRESSION-FREEZE[photo-replace-wrong-1128]: 기존 사진 판정·교체, 못 찾으면 유지, 실행 상한 — manifest
 */
import { photoIsConfirmedWrong } from '@/lib/photo-banned-source-1129'
import {
  SOURCE_META_MISMATCH_DETAIL,
  STORED_SIGHT_MISMATCH_DETAIL,
  WRONG_PHOTO_REPLACE_REASONS,
  type RegistrationPhotoBlock,
} from '@/lib/register-photo-registration-gate'

/**
 * 사장님 2026-11-28 17:16 '제대로 자가힐이 되게 하는 게 목적' — 교체 칸 수 상한(12·6)과 상품 판정 수 상한(60)을 없앴다.
 * 틀린 칸은 한 실행에서 모두 고친다. 남는 제한은 외부 API 쿼터(Unsplash 900/h·Pixabay 60/분 등 기존 가드)뿐이고,
 * 쿼터에 막힌 칸은 창이 풀릴 때까지 같은 실행 안에서 기다렸다가 이어서 처리한다(다음 정기 실행으로 미루지 않음).
 * 시간 한도는 매시 :30 틱이 겹치지 않게 하는 안전 장치일 뿐이다. 넘기면 남은 칸을 같은 작업의 뒷단에서 한 번 더 이어서 처리한다.
 * REGRESSION-FREEZE[self-heal-no-cap-1128]: 교체·판정 칸 수 상한 없음, 쿼터 대기 후 재개 — manifest
 */
export const WRONG_PHOTO_REPLACE_TIME_BUDGET_MS = 45 * 60 * 1000
/**
 * 등록대기(pending) 틀린 칸 단계 전용 시간 한도. 공개 단계와 한도를 나누지 않으면(22:30 회차 2026-11-28) 공개 단계가 한도를 거의 다 써서
 * 등록대기 단계가 첫 상품 전에 time_budget 으로 끝나 43칸을 한 칸도 못 고쳤다. 공개 단계가 끝난 시각부터 새로 센다.
 * REGRESSION-FREEZE[photo-run-budget-judge-1129]: 등록대기 단계 전용 시간 한도 — manifest
 */
export const PENDING_WRONG_PHOTO_REPLACE_TIME_BUDGET_MS = 45 * 60 * 1000
/** 공개 단계를 시작하는 시각 기준 한도 끝(ms) */
export function publicWrongPhotoDeadlineAtMs(nowMs: number): number {
  return nowMs + WRONG_PHOTO_REPLACE_TIME_BUDGET_MS
}
/** 등록대기 단계를 시작하는 시각 기준 한도 끝(ms) — 공개 단계가 쓴 시간과 무관 */
export function pendingWrongPhotoDeadlineAtMs(nowMs: number): number {
  return nowMs + PENDING_WRONG_PHOTO_REPLACE_TIME_BUDGET_MS
}
/** 쿼터를 기다리다 한 번 더 시도하는 최대 횟수(무한 대기 방지) */
export const WRONG_PHOTO_REPLACE_MAX_ROUNDS = 6

export type WrongPhotoProductOutcome = {
  replaced: number
  /** 한도(Unsplash·Pixabay)에 막혀 이번에 못 고친 칸이 있음 */
  quotaLimited: boolean
}

export type WrongPhotoRoundsResult = {
  rounds: number
  /** 끝까지 처리한(더 할 일 없는) 상품 */
  settled: string[]
  /** 시간 한도·대기 한도로 이번 단계에서 못 한 상품 id */
  remaining: string[]
  waitedMs: number
  stopReason: 'done' | 'time_budget' | 'quota_wait_exceeds_budget' | 'max_rounds'
}

/**
 * 틀린 칸이 있는 상품을 모두 처리한다. 쿼터에 막힌 상품은 한도 창이 풀리는 시각까지 기다린 뒤 다시 처리한다.
 * 기다림이 deadline 을 넘을 때만 멈추고 남은 상품을 돌려준다.
 */
export async function runWrongPhotoRounds(input: {
  productIds: readonly string[]
  processOne: (productId: string) => Promise<WrongPhotoProductOutcome>
  quotaResumeAtMs: () => number | null
  now: () => number
  sleep: (ms: number) => Promise<void>
  deadlineAtMs: number
  maxRounds?: number
}): Promise<WrongPhotoRoundsResult> {
  const maxRounds = input.maxRounds ?? WRONG_PHOTO_REPLACE_MAX_ROUNDS
  let queue = [...input.productIds]
  const settled: string[] = []
  let waitedMs = 0
  let rounds = 0
  while (queue.length > 0) {
    rounds++
    const limited: string[] = []
    for (let i = 0; i < queue.length; i++) {
      if (input.now() >= input.deadlineAtMs) {
        return { rounds, settled, remaining: [...limited, ...queue.slice(i)], waitedMs, stopReason: 'time_budget' }
      }
      const id = queue[i]!
      const out = await input.processOne(id)
      if (out.quotaLimited) limited.push(id)
      else settled.push(id)
    }
    if (limited.length === 0) return { rounds, settled, remaining: [], waitedMs, stopReason: 'done' }
    const resumeAt = input.quotaResumeAtMs()
    if (resumeAt == null) {
      // 한도 탓이 아니라(이미 풀림·Pexels 월 한도) 기다려도 달라지지 않는다 — 한 번 더 돌지 않고 마친다
      settled.push(...limited)
      return { rounds, settled, remaining: [], waitedMs, stopReason: 'done' }
    }
    if (rounds >= maxRounds) return { rounds, settled, remaining: limited, waitedMs, stopReason: 'max_rounds' }
    const wait = Math.max(0, resumeAt - input.now()) + 1000
    if (input.now() + wait >= input.deadlineAtMs) return { rounds, settled, remaining: limited, waitedMs, stopReason: 'quota_wait_exceeds_budget' }
    await input.sleep(wait)
    waitedMs += wait
    queue = limited
  }
  return { rounds, settled, remaining: [], waitedMs, stopReason: 'done' }
}

/** 실행 상한 카운터 */
export function createRunBudget(max: number): { take: () => boolean; used: () => number } {
  let n = 0
  return {
    take: () => {
      if (n >= max) return false
      n++
      return true
    },
    used: () => n,
  }
}

/**
 * 공개 상품에서 교체할 칸만 남긴다.
 * - 그날 명소 불일치는 '저장된 명소가 그날 원문 명소에 없음' 또는 '출처 메타가 정답 명소와 다름'(이름-내용). 근거 없음(unverified)·글 없음은 건드리지 않는다.
 * - 대표 사진은 AI 생성만(목록 카드 보호). 인물·무관(제목 글 판정)은 공개 상품에서 제외.
 * - 용량·해상도·측정은 기존 야간·매시 점검 몫이라 여기서 다루지 않는다.
 */
export function publicWrongPhotoBlocks(blocks: readonly RegistrationPhotoBlock[]): RegistrationPhotoBlock[] {
  return blocks.filter((b) => {
    if (!WRONG_PHOTO_REPLACE_REASONS.has(b.reason)) return false
    // 인물·무관(제목 글)은 공개 상품에서 오탐이 많아 교체하지 않는다. 출처 메타의 동물·실내·점포는 이름-내용이 다른 틀린 사진이라 교체한다.
    if (b.reason === 'photo_irrelevant_subject') {
      return /^(animal_not_in_itinerary|interior_not_place|unrelated_object):/.test(b.detail)
    }
    // 일차 공개 중복은 틀린 사진이 아니다(사장님 12:01). 목록 카드 대표 중복만 대상이나, 공개 상품 대표는 AI만 교체.
    if (b.reason === 'photo_public_duplicate') return false
    if (b.kind === 'cover') return b.reason === 'photo_ai_generated' || b.reason === 'photo_banned_source'
    if (b.reason === 'photo_sight_mismatch') {
      return b.detail.startsWith(STORED_SIGHT_MISMATCH_DETAIL) || b.detail.startsWith(SOURCE_META_MISMATCH_DETAIL)
    }
    return true
  })
}

/**
 * 맞는 사진을 못 찾았을 때 칸을 비우는 대상(틀린·쓰지 않는 출처 사진을 공개 상품에 두지 않는다, 사장님 2026-11-29 00:14).
 * - Wikimedia·Wikipedia·Commons 출처(photo_banned_source)
 * - 저장된 명소 이름표가 그날 정답 명소에 없는 확정 불일치(STORED_SIGHT_MISMATCH)
 * - 91칸 재판정에서 확정된 기존 오답(CONFIRMED_WRONG_PHOTOS_1129: 상품·일차·사진이 같을 때만)
 * 출처 메타가 일반 단어뿐이라 확인이 안 되는 경우(SOURCE_META_MISMATCH)는 비우지 않고 기존대로 유지한다.
 * REGRESSION-FREEZE[photo-run-budget-judge-1129]: 맞는 사진이 없으면 빈칸 — manifest
 */
export function shouldClearWhenUnreplaceable(ctx: {
  productId: string
  day: number | null
  reasons: readonly string[]
  details: readonly string[]
  externalId?: unknown
}): boolean {
  if (ctx.reasons.includes('photo_banned_source')) return true
  if (ctx.details.some((d) => d.startsWith(STORED_SIGHT_MISMATCH_DETAIL))) return true
  return photoIsConfirmedWrong(ctx.productId, ctx.day, ctx.externalId)
}

/** 공개 상품 처리 순서: 시각마다 시작 위치를 돌려 시간 한도에 걸려도 같은 상품이 늘 뒤로 밀리지 않게 한다(전체 판정, 칸 수 상한 없음) */
export function rotateForHour<T>(rows: readonly T[], now: Date, take: number): T[] {
  if (rows.length === 0) return []
  const hour = Math.floor(now.getTime() / 3_600_000)
  const start = (hour * 37) % rows.length
  const out: T[] = []
  for (let i = 0; i < Math.min(take, rows.length); i++) out.push(rows[(start + i) % rows.length]!)
  return out
}

/**
 * 등록대기(pending) 상품에서 교체할 칸만 남긴다(17:16 지시 — 공개 경로와 같은 원칙).
 * 등록대기는 아직 공개 전이라 판정이 넓다(근거 없음·글 없음도 게이트가 막는 대로). 단 비우기 대상(이동일 빈칸)과
 * 일차 공개 중복(틀린 사진이 아님, 사장님 12:01)은 이 단계에서 다루지 않는다.
 * REGRESSION-FREEZE[self-heal-no-cap-1128]: 등록대기도 상한 없이 틀린 칸 상품을 먼저 처리 — manifest
 */
export function pendingWrongPhotoBlocks(blocks: readonly RegistrationPhotoBlock[]): RegistrationPhotoBlock[] {
  return blocks.filter((b) => {
    if (!WRONG_PHOTO_REPLACE_REASONS.has(b.reason)) return false
    if (b.reason === 'photo_travel_day_empty') return false
    if (b.reason === 'photo_public_duplicate') return false
    return true
  })
}
