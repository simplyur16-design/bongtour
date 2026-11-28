/**
 * 자가 힐 — 등록 전 사진 게이트가 막은 칸을 다음 후보로 교체하고, 칸당 후보 5개 안에 못 고치면 예외 목록에 올린다.
 * 일차 사진의 공개 중복만으로는 바꾸지 않는다(대표 사진 중복만 교체 대상).
 * (그 상품만 보류 — 상품 단위 보류는 호출부의 자동 등록 검사가 그대로 한다).
 * 바꾸는 것은 막힌 칸의 사진 필드뿐. 외부 호출은 acquireVerifiedPhoto(순차·간격+지터·재시도 1회)만 쓴다.
 * REGRESSION-FREEZE[photo-heal]: 막힌 칸만 교체·5개 상한·못 고치면 예외 — manifest
 */
import type { AcquireInput, AcquireResult } from '@/lib/photo-autofill-acquire'
import { photoIdentityKeys, type PublicPhotoUsage } from '@/lib/photo-autofill-gate'
import type { RegistrationPhotoBlock, RegistrationPhotoReason } from '@/lib/register-photo-registration-gate'
import { scheduleOtherDaysText, scheduleRowSupplierText } from '@/lib/photo-autofill-sight'
import { applyDayPhotoClear, applyDayPhotoReplacement, coverReplacementData, replaceNote, type ReplacementPhoto } from '@/lib/photo-slot-apply'
import { planDayPhotoSave } from '@/lib/photo-day-save-gate-1128'
import type { PhotoException } from '@/lib/photo-exception-list'

export const HEAL_MAX_SLOTS_PER_PRODUCT = 8

const HEALABLE: ReadonlySet<RegistrationPhotoReason> = new Set([
  'photo_sight_mismatch',
  'photo_public_duplicate',
  'photo_irrelevant_subject',
  'photo_low_res',
  'photo_over_bytes',
  // REGRESSION-FREEZE[photo-replace-wrong-1128]: 지도·간판·AI 생성·흑백 표시·상품 안 중복도 실사진으로 교체(못 찾으면 기존 유지 + 예외 사유) — manifest
  'photo_text_map',
  'photo_ai_generated',
  'photo_monochrome_text',
  'photo_in_product_duplicate',
  'photo_travel_day_empty',
])

export type HealDeps = {
  acquire: (input: AcquireInput) => Promise<AcquireResult>
  /** schedule 이 expected 와 같을 때만 쓴다. 다르면 false(동시 수정 보호). */
  writeSchedule: (productId: string, expected: string | null, next: string) => Promise<boolean>
  writeCover: (productId: string, data: Record<string, unknown>) => Promise<boolean>
  recordException: (e: PhotoException) => Promise<void>
  /** 되돌리기용 기록(교체 전 값) */
  recordReplace: (input: { productId: string; day: number; assetPath: string; sourceType: string; notes: string }) => Promise<void>
  usage: PublicPhotoUsage
  now?: () => Date
  /** 한 실행 전체 교체 상한(외부 검색 쿼터 보호). false 면 이 칸은 다음 실행으로 미룬다(기존 사진 유지). */
  takeRunBudget?: () => boolean
}

export type HealCover = {
  url: string
  externalId?: string | null
  originalLink?: string | null
  source?: string | null
  photographer?: string | null
  sourceUrl?: string | null
  placeLabel?: string | null
}

export type HealInput = {
  productId: string
  destinationTerms: readonly string[]
  /** 영문 도시 낱말(검색어 보강·도시 일치) */
  cityTerms: readonly string[]
  schedule: string | null
  cover: HealCover | null
  blocks: readonly RegistrationPhotoBlock[]
}

export type HealResult = {
  replaced: Array<{ kind: 'day' | 'cover'; day: number | null; reason: string }>
  exceptions: PhotoException[]
  schedule: string | null
  /** 실행 상한으로 미룬 칸(기존 사진 그대로) */
  deferred?: number
}

function slotKey(b: RegistrationPhotoBlock): string {
  return b.kind === 'cover' ? 'cover' : `day:${b.day}`
}

function parseRows(schedule: string | null): Array<Record<string, unknown>> {
  try {
    const v = schedule ? JSON.parse(schedule) : []
    return Array.isArray(v) ? (v as Array<Record<string, unknown>>) : []
  } catch {
    return []
  }
}

function keysOfSchedule(schedule: string | null, exceptDay: number | null): Set<string> {
  const out = new Set<string>()
  for (const [i, r] of parseRows(schedule).entries()) {
    const day = Math.floor(Number(r.day)) > 0 ? Math.floor(Number(r.day)) : i + 1
    if (day === exceptDay) continue
    const u = String(r.imageUrl ?? '').trim()
    if (!u) continue
    const s = r.imageSource && typeof r.imageSource === 'object' ? (r.imageSource as Record<string, unknown>) : {}
    for (const k of photoIdentityKeys({ url: u, externalId: String(s.externalId ?? ''), originalLink: String(s.originalLink ?? '') })) out.add(k)
  }
  return out
}

export async function healBlockedSlots(input: HealInput, deps: HealDeps): Promise<HealResult> {
  const at = (deps.now?.() ?? new Date()).toISOString()
  const result: HealResult = { replaced: [], exceptions: [], schedule: input.schedule }
  const byKey = new Map<string, { block: RegistrationPhotoBlock; reasons: string[] }>()
  for (const b of input.blocks) {
    if (!HEALABLE.has(b.reason)) continue
    // REGRESSION-FREEZE[photo-wrong-path-1128]: 다른 상품과 같은 파일도 교체·비움 대상 — manifest
    const k = slotKey(b)
    const cur = byKey.get(k)
    if (cur) cur.reasons.push(b.reason)
    else byKey.set(k, { block: b, reasons: [b.reason] })
  }
  let healed = 0
  const addException = async (e: PhotoException) => {
    result.exceptions.push(e)
    await deps.recordException(e)
  }
  const dest = input.destinationTerms.join(' ')

  for (const { block, reasons } of byKey.values()) {
    if (healed >= HEAL_MAX_SLOTS_PER_PRODUCT) {
      await addException({ productId: input.productId, day: block.day, kind: block.kind, sight: null, query: null, reason: 'heal_cap', detail: `max ${HEAL_MAX_SLOTS_PER_PRODUCT} slots per product`, origin: 'heal', at })
      continue
    }
    if (deps.takeRunBudget && !deps.takeRunBudget()) {
      result.deferred = (result.deferred ?? 0) + 1
      continue
    }
    healed++
    const reasonText = reasons.join(',')

    if (block.kind === 'cover') {
      const cover = input.cover
      const exclude = keysOfSchedule(result.schedule, null)
      if (cover) for (const k of photoIdentityKeys({ url: cover.url, externalId: cover.externalId, originalLink: cover.originalLink })) exclude.add(k)
      const res = await deps.acquire({
        productId: input.productId,
        kind: 'cover',
        day: null,
        sights: cover?.placeLabel ? [cover.placeLabel] : [],
        cityTerms: input.cityTerms,
        destinationText: dest,
        usage: deps.usage,
        exclude,
        origin: 'heal',
      })
      if (!res.ok) {
        await addException({ ...res.exception, detail: `${reasonText}; ${res.exception.detail}` })
        continue
      }
      const photo: ReplacementPhoto = res.photo
      const ok = await deps.writeCover(input.productId, coverReplacementData(photo))
      if (!ok) {
        await addException({ productId: input.productId, day: null, kind: 'cover', sight: res.photo.sight, query: res.photo.query, reason: 'write_failed', detail: reasonText, origin: 'heal', at })
        continue
      }
      deps.usage.add(input.productId, 'cover', photoIdentityKeys({ url: photo.url, externalId: photo.externalId, originalLink: photo.originalLink }))
      await deps.recordReplace({
        productId: input.productId,
        day: 1,
        assetPath: photo.url,
        sourceType: 'heal-cover',
        notes: replaceNote({
          reason: reasonText,
          slot: 'cover',
          origin: 'heal',
          prev: {
            bgImageUrl: cover?.url ?? null,
            bgImageExternalId: cover?.externalId ?? null,
            bgImageSource: cover?.source ?? null,
            bgImagePhotographer: cover?.photographer ?? null,
            bgImageSourceUrl: cover?.sourceUrl ?? cover?.originalLink ?? null,
          },
        }),
      })
      result.replaced.push({ kind: 'cover', day: null, reason: reasonText })
      continue
    }

    const day = block.day as number
    const row = parseRows(result.schedule).find((r, i) => (Math.floor(Number(r.day)) > 0 ? Math.floor(Number(r.day)) : i + 1) === day)
    if (!row) {
      await addException({ productId: input.productId, day, kind: 'day', sight: null, query: null, reason: 'day_not_found', detail: reasonText, origin: 'heal', at })
      continue
    }
    if (row.imageManualSelected === true) continue
    const rowsNow = parseRows(result.schedule)
    const maxDay = Math.max(1, ...rowsNow.map((r, i) => (Math.floor(Number(r.day)) > 0 ? Math.floor(Number(r.day)) : i + 1)))
    const plan = planDayPhotoSave(
      {
        day,
        title: typeof row.title === 'string' ? row.title : null,
        routeText: typeof row.routeText === 'string' ? row.routeText : null,
        description: typeof row.description === 'string' ? row.description : null,
        hotelText: typeof row.hotelText === 'string' ? row.hotelText : null,
        imageKeyword: typeof row.imageKeyword === 'string' ? row.imageKeyword : null,
        imageKeyword2: typeof row.imageKeyword2 === 'string' ? row.imageKeyword2 : null,
        supplierText: scheduleRowSupplierText(row as never),
        otherDaysText: scheduleOtherDaysText(rowsNow as never, day),
      },
      { destinationText: dest, maxDay, allRows: rowsNow as never },
    )
    if (plan.action === 'empty' || reasons.includes('photo_travel_day_empty')) {
      const applied = applyDayPhotoClear(result.schedule, day)
      if ('error' in applied) {
        await addException({ productId: input.productId, day, kind: 'day', sight: null, query: null, reason: `apply_${applied.error}`, detail: reasonText, origin: 'heal', at })
        continue
      }
      const wrote = await deps.writeSchedule(input.productId, result.schedule, applied.schedule)
      if (!wrote) {
        await addException({ productId: input.productId, day, kind: 'day', sight: null, query: null, reason: 'write_conflict', detail: reasonText, origin: 'heal', at })
        continue
      }
      result.schedule = applied.schedule
      await deps.recordReplace({
        productId: input.productId,
        day,
        assetPath: '',
        sourceType: 'heal-clear',
        notes: replaceNote({ reason: reasonText, slot: 'day', origin: 'heal', prev: applied.previous }),
      })
      result.replaced.push({ kind: 'day', day, reason: reasonText })
      continue
    }
    const exclude = keysOfSchedule(result.schedule, day)
    const curSrc = row.imageSource && typeof row.imageSource === 'object' ? (row.imageSource as Record<string, unknown>) : {}
    for (const k of photoIdentityKeys({ url: String(row.imageUrl ?? ''), externalId: String(curSrc.externalId ?? ''), originalLink: String(curSrc.originalLink ?? '') })) exclude.add(k)
    if (input.cover) for (const k of photoIdentityKeys({ url: input.cover.url, externalId: input.cover.externalId, originalLink: input.cover.originalLink })) exclude.add(k)
    const res = await deps.acquire({
      productId: input.productId,
      kind: 'day',
      day,
      dayFacts: {
        title: typeof row.title === 'string' ? row.title : null,
        routeText: typeof row.routeText === 'string' ? row.routeText : null,
        description: typeof row.description === 'string' ? row.description : null,
        imageKeyword: typeof row.imageKeyword === 'string' ? row.imageKeyword : null,
        imageKeyword2: typeof row.imageKeyword2 === 'string' ? row.imageKeyword2 : null,
        // REGRESSION-FREEZE[photo-replace-wrong-1128]: 교체 검색도 그날 공급사 원문·다른 일차 글로 명소 판정 — manifest
        supplierText: scheduleRowSupplierText(row as never),
        otherDaysText: scheduleOtherDaysText(parseRows(result.schedule) as never, day),
      },
      cityTerms: input.cityTerms,
      destinationText: dest,
      usage: deps.usage,
      exclude,
      origin: 'heal',
    })
    if (!res.ok) {
      await addException({ ...res.exception, detail: `${reasonText}; ${res.exception.detail}` })
      continue
    }
    const applied = applyDayPhotoReplacement(result.schedule, day, res.photo, 'heal')
    if ('error' in applied) {
      await addException({ productId: input.productId, day, kind: 'day', sight: res.photo.sight, query: res.photo.query, reason: `apply_${applied.error}`, detail: reasonText, origin: 'heal', at })
      continue
    }
    const wrote = await deps.writeSchedule(input.productId, result.schedule, applied.schedule)
    if (!wrote) {
      await addException({ productId: input.productId, day, kind: 'day', sight: res.photo.sight, query: res.photo.query, reason: 'write_conflict', detail: reasonText, origin: 'heal', at })
      continue
    }
    result.schedule = applied.schedule
    deps.usage.add(input.productId, 'day', photoIdentityKeys({ url: res.photo.url, externalId: res.photo.externalId, originalLink: res.photo.originalLink }))
    await deps.recordReplace({
      productId: input.productId,
      day,
      assetPath: res.photo.url,
      sourceType: 'heal-day',
      notes: replaceNote({ reason: reasonText, slot: 'day', origin: 'heal', prev: applied.previous }),
    })
    result.replaced.push({ kind: 'day', day, reason: reasonText })
  }
  return result
}
