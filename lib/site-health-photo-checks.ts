/**
 * 매시 사진 점검 항목(공용 틀 lib/site-health-registry.ts 에 얹는다).
 * 데이터만 고친다: 문제 일차 사진 칸을 비우고 같은 실행의 자동 채움이 규칙대로 다시 채운다.
 * 일정 글·title·가격은 건드리지 않는다. 수동 선택 사진(imageManualSelected)은 비우지 않는다.
 * 비운 뒤 다시 채울 수 없는 일차(키워드 없음 등)는 비우지 않고 기록만 한다.
 * REGRESSION-FREEZE[site-health-hourly-1122]: 사진 점검 — 비우기는 재채움 가능 일차만, 대표사진은 기록만 — manifest
 */
import type { HealthCheck, HealthFinding } from '@/lib/site-health-registry'
import { missingDayFillAction, parseScheduleMissingDaySlots } from '@/lib/register-auto-photo-missing-day'

export const SITE_HEALTH_COVER_MAX_BYTES = 200_000
export const SITE_HEALTH_DAY_MAX_BYTES = 400_000

export type PhotoHealthProduct = { id: string; bgImageUrl: string | null; schedule: string | null }

export type PhotoProbe = { status: number; bytes: number | null }

export type PhotoHealthCtx = {
  products: PhotoHealthProduct[]
  /** HEAD 결과(간격·지터·캐시는 구현 쪽). 예산이 끝나면 null */
  probe(url: string): Promise<PhotoProbe | null>
  isMonochrome(url: string): Promise<boolean | null>
  /** 현재 값이 prevUrl 일 때만 비운다(낙관적 쓰기 + 되돌림 기록). 예산이 끝나면 false */
  clearDayPhoto(productId: string, day: number, prevUrl: string, reason: string): Promise<boolean>
  /** 같은 실행에서 다시 채울 상품 */
  refillIds: Set<string>
}

type RawDay = Record<string, unknown>

function rawDays(schedule: string | null): RawDay[] {
  if (!schedule?.trim()) return []
  try {
    const v = JSON.parse(schedule) as unknown
    return Array.isArray(v) ? (v.filter((x) => x && typeof x === 'object') as RawDay[]) : []
  } catch {
    return []
  }
}

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

export function normalizePhotoUrl(url: string): string {
  return url.trim().split('#')[0]!.split('?')[0]!.toLowerCase()
}

/** 공항·기내 사진 신호(키워드·대체문구·파일명). 이동일의 'airplane view'(창밖 풍경)는 제외 */
export const AIRPORT_INFLIGHT_RE = /\b(airport|terminal|boarding gate|departure hall|in[- ]?flight|aircraft cabin|airplane cabin|airplane seat|cabin interior)\b|공항|기내|탑승구|출국장/i

export function photoLooksAirportOrInflight(day: RawDay): boolean {
  const text = [day.imageKeyword, day.imageAlt, day.imageSourceQuery, day.imageQuery, day.imageUrl]
    .map(str)
    .join(' ')
    .replace(/[-_]+/g, ' ')
  return AIRPORT_INFLIGHT_RE.test(text)
}

export type DayPhotoRef = { productId: string; day: number; url: string; raw: RawDay; maxDay: number }

export function productDayPhotos(p: PhotoHealthProduct): DayPhotoRef[] {
  const days = rawDays(p.schedule)
  const maxDay = days.reduce((m, d) => Math.max(m, Math.floor(Number(d.day)) || 0), 0)
  const out: DayPhotoRef[] = []
  for (const raw of days) {
    const day = Math.floor(Number(raw.day))
    const url = str(raw.imageUrl)
    if (!Number.isFinite(day) || day < 1 || !url) continue
    out.push({ productId: p.id, day, url, raw, maxDay })
  }
  return out
}

/** 비운 뒤 자동 채움이 다시 채울 수 있는 일차인가(수동 선택·키워드 없음은 false) */
export function dayRefillableAfterClear(ref: DayPhotoRef): boolean {
  if (ref.raw.imageManualSelected === true) return false
  const slot = parseScheduleMissingDaySlots(JSON.stringify([{ ...ref.raw, imageUrl: '' }]))[0]
  if (!slot) return false
  return missingDayFillAction(slot, ref.maxDay || ref.day) === 'fill'
}

/** 한 상품 안에서 앞 일차와 같은 사진을 쓰는 뒤 일차 */
export function duplicateDaysInProduct(p: PhotoHealthProduct): DayPhotoRef[] {
  const seen = new Set<string>()
  const dups: DayPhotoRef[] = []
  for (const ref of productDayPhotos(p).sort((a, b) => a.day - b.day)) {
    const k = normalizePhotoUrl(ref.url)
    if (seen.has(k)) dups.push(ref)
    else seen.add(k)
  }
  return dups
}

function finding(checkId: string, ref: DayPhotoRef, detail: string): HealthFinding {
  return { checkId, target: ref.productId, productId: ref.productId, day: ref.day, detail: `${detail} ${ref.url}`.slice(0, 300) }
}

async function clearAndQueue(ctx: PhotoHealthCtx, f: HealthFinding, reason: string) {
  const p = ctx.products.find((x) => x.id === f.productId)
  const ref = p ? productDayPhotos(p).find((r) => r.day === f.day) : undefined
  if (!ref || !dayRefillableAfterClear(ref)) return { fixed: false, note: 'not-refillable' }
  const ok = await ctx.clearDayPhoto(ref.productId, ref.day, ref.url, reason)
  if (ok) ctx.refillIds.add(ref.productId)
  return { fixed: ok }
}

function dayProbeCheck(
  id: string,
  summary: string,
  bad: (ref: DayPhotoRef, ctx: PhotoHealthCtx) => Promise<string | null>,
): HealthCheck<PhotoHealthCtx> {
  return {
    id,
    area: 'photo',
    kind: 'data',
    summary,
    async find(ctx) {
      const out: HealthFinding[] = []
      for (const p of ctx.products) {
        for (const ref of productDayPhotos(p)) {
          const why = await bad(ref, ctx)
          if (why) out.push(finding(id, ref, why))
        }
      }
      return out
    },
    fix: (ctx, f) => clearAndQueue(ctx, f, id),
  }
}

export const PHOTO_HEALTH_CHECKS: HealthCheck<PhotoHealthCtx>[] = [
  {
    id: 'photo-empty-day',
    area: 'photo',
    kind: 'data',
    summary: '채울 수 있는 빈 일차 사진(같은 실행 자동 채움 대상)',
    find(ctx) {
      const out: HealthFinding[] = []
      for (const p of ctx.products) {
        const slots = parseScheduleMissingDaySlots(p.schedule)
        const maxDay = slots.reduce((m, d) => Math.max(m, d.day), 0)
        for (const s of slots) {
          if (missingDayFillAction(s, maxDay) === 'fill') out.push({ checkId: 'photo-empty-day', target: p.id, productId: p.id, day: s.day, detail: 'empty' })
        }
      }
      return out
    },
    async fix(ctx, f) {
      if (f.productId) ctx.refillIds.add(f.productId)
      return { fixed: false, note: 'queued-refill' }
    },
  },
  {
    id: 'photo-no-cover',
    area: 'photo',
    kind: 'data',
    summary: '대표사진 없는 공개 상품(같은 실행 자동 채움 대상)',
    find: (ctx) =>
      ctx.products.filter((p) => !str(p.bgImageUrl)).map((p) => ({ checkId: 'photo-no-cover', target: p.id, productId: p.id, detail: 'no cover' })),
    async fix(ctx, f) {
      if (f.productId) ctx.refillIds.add(f.productId)
      return { fixed: false, note: 'queued-refill' }
    },
  },
  {
    id: 'photo-dup-in-product',
    area: 'photo',
    kind: 'data',
    summary: '한 상품 안 일차 사진 중복(뒤 일차를 비우고 다시 채움)',
    find: (ctx) => ctx.products.flatMap((p) => duplicateDaysInProduct(p).map((r) => finding('photo-dup-in-product', r, 'same as earlier day'))),
    fix: (ctx, f) => clearAndQueue(ctx, f, 'photo-dup-in-product'),
  },
  {
    id: 'photo-airport-inflight',
    area: 'photo',
    kind: 'data',
    summary: '공항·기내 사진(비우고 규칙대로 다시 채움)',
    find: (ctx) =>
      ctx.products.flatMap((p) =>
        productDayPhotos(p)
          .filter((r) => photoLooksAirportOrInflight(r.raw))
          .map((r) => finding('photo-airport-inflight', r, 'airport/in-flight')),
      ),
    fix: (ctx, f) => clearAndQueue(ctx, f, 'photo-airport-inflight'),
  },
  dayProbeCheck('photo-broken-day', '깨진 일차 사진(HTTP 오류)', async (ref, ctx) => {
    const r = await ctx.probe(ref.url)
    return r && r.status >= 400 ? `http ${r.status}` : null
  }),
  dayProbeCheck('photo-oversize-day', `일차 사진 용량 초과(${SITE_HEALTH_DAY_MAX_BYTES}B)`, async (ref, ctx) => {
    const r = await ctx.probe(ref.url)
    return r && r.status < 400 && r.bytes != null && r.bytes > SITE_HEALTH_DAY_MAX_BYTES ? `bytes ${r.bytes}` : null
  }),
  dayProbeCheck('photo-monochrome-day', '흑백 일차 사진', async (ref, ctx) => ((await ctx.isMonochrome(ref.url)) ? 'monochrome' : null)),
  {
    id: 'photo-cover-problem',
    area: 'photo',
    kind: 'code',
    summary: `대표사진 깨짐·용량 초과(${SITE_HEALTH_COVER_MAX_BYTES}B) — 대표사진은 자동으로 비우지 않고 기록만`,
    async find(ctx) {
      const out: HealthFinding[] = []
      for (const p of ctx.products) {
        const url = str(p.bgImageUrl)
        if (!url) continue
        const r = await ctx.probe(url)
        if (!r) continue
        if (r.status >= 400) out.push({ checkId: 'photo-cover-problem', target: p.id, productId: p.id, detail: `cover http ${r.status}` })
        else if (r.bytes != null && r.bytes > SITE_HEALTH_COVER_MAX_BYTES)
          out.push({ checkId: 'photo-cover-problem', target: p.id, productId: p.id, detail: `cover bytes ${r.bytes}` })
      }
      return out
    },
  },
]
