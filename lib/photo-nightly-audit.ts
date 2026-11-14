/**
 * 야간 점검(기존 자동 등록 cron 의 야간 구간에 붙는 단계) — 공개 상품 사진의 HTTP 깨짐·중복을 다시 확인하고,
 * 같은 게이트를 통과한 후보로 사진 칸만 자동 교체한다.
 * - 공개 상품은 사진 칸만 바꾼다(title·가격·일정 글 불변). 관리자가 고른 칸은 건드리지 않는다.
 * - 교체 전 값은 AssetUsageLog 노트(photo-replace:…)로 남겨 되돌릴 수 있다.
 * - 한 번 실행당 교체 상한 NIGHTLY_MAX_REPLACEMENTS_PER_RUN. 넘는 건 다음 밤으로 미룬다(deferred).
 * - 끝내 못 고친 것만 예외 목록. 외부 호출: 순차·간격+지터·읽기 재시도 1회·외부 장애는 SKIP+사유.
 * REGRESSION-FREEZE[photo-nightly-audit]: 깨짐·중복 재확인·교체 상한·되돌리기 기록 — manifest
 */
import type { AcquireInput, AcquireResult } from '@/lib/photo-autofill-acquire'
import { buildPublicPhotoUsage, photoIdentityKeys, type PublicPhotoUsage } from '@/lib/photo-autofill-gate'
import { deriveDaySights, sightProfile } from '@/lib/photo-autofill-sight'
import { applyDayPhotoReplacement, coverReplacementData, replaceNote } from '@/lib/photo-slot-apply'
import type { PhotoException } from '@/lib/photo-exception-list'
import { mapDestination } from '@/lib/pexels-keyword'

export const NIGHTLY_MAX_REPLACEMENTS_PER_RUN = 10
export const NIGHTLY_MAX_PRODUCTS_PER_RUN = 60
export const NIGHTLY_HEAD_GAP_MS = 400
export const NIGHTLY_HEAD_JITTER_MS = 300

/** 한국 시간 22시~다음날 5시 59분 */
export function isNightlyAuditWindowKst(now: Date): boolean {
  const h = (now.getUTCHours() + 9) % 24
  return h >= 22 || h < 6
}

export type PublicProductPhotos = {
  id: string
  createdAt: Date | string
  bgImageUrl: string | null
  bgImageExternalId?: string | null
  bgImageSourceUrl?: string | null
  bgImageSource?: string | null
  bgImageRehostSearchLabel?: string | null
  destination: string | null
  primaryDestination?: string | null
  schedule: string | null
}

export type PhotoIssueReason = 'broken_http' | 'public_duplicate'

export type PhotoIssue = {
  productId: string
  kind: 'day' | 'cover'
  day: number | null
  reason: PhotoIssueReason
  url: string
  detail: string
}

type Slot = { kind: 'day' | 'cover'; day: number | null; url: string; keys: string[]; manual: boolean }

function parseRows(schedule: string | null): Array<Record<string, unknown>> {
  try {
    const v = schedule ? JSON.parse(schedule) : []
    return Array.isArray(v) ? (v as Array<Record<string, unknown>>) : []
  } catch {
    return []
  }
}

export function slotsOfProduct(p: PublicProductPhotos): Slot[] {
  const out: Slot[] = []
  const cover = String(p.bgImageUrl ?? '').trim()
  if (cover) {
    out.push({
      kind: 'cover',
      day: null,
      url: cover,
      manual: /manual|admin/i.test(String(p.bgImageSource ?? '')),
      keys: photoIdentityKeys({ url: cover, externalId: p.bgImageExternalId, originalLink: p.bgImageSourceUrl }),
    })
  }
  for (const [i, r] of parseRows(p.schedule).entries()) {
    const url = String(r.imageUrl ?? '').trim()
    if (!url) continue
    const s = r.imageSource && typeof r.imageSource === 'object' ? (r.imageSource as Record<string, unknown>) : {}
    out.push({
      kind: 'day',
      day: Math.floor(Number(r.day)) > 0 ? Math.floor(Number(r.day)) : i + 1,
      url,
      manual: r.imageManualSelected === true,
      keys: photoIdentityKeys({ url, externalId: String(s.externalId ?? ''), originalLink: String(s.originalLink ?? r.imageSourcePageUrl ?? '') }),
    })
  }
  return out
}

function ts(v: Date | string): number {
  return new Date(v).getTime()
}

/** 공개 상품 사이 같은 사진: 가장 먼저 만든 상품이 갖고, 나머지 상품의 칸이 중복. 같은 상품 안 재사용은 중복이 아니다. */
export function planDuplicateIssues(products: readonly PublicProductPhotos[]): PhotoIssue[] {
  const order = [...products].sort((a, b) => ts(a.createdAt) - ts(b.createdAt) || a.id.localeCompare(b.id))
  const rank = new Map(order.map((p, i) => [p.id, i]))
  const owners = new Map<string, string[]>()
  for (const p of order) {
    for (const s of slotsOfProduct(p)) {
      for (const k of s.keys) {
        const list = owners.get(k) ?? []
        if (!list.includes(p.id)) list.push(p.id)
        owners.set(k, list)
      }
    }
  }
  const issues: PhotoIssue[] = []
  for (const p of order) {
    for (const s of slotsOfProduct(p)) {
      const earlier = s.keys.map((k) => (owners.get(k) ?? []).find((o) => o !== p.id && (rank.get(o) ?? 0) < (rank.get(p.id) ?? 0))).find(Boolean)
      if (earlier) issues.push({ productId: p.id, kind: s.kind, day: s.day, reason: 'public_duplicate', url: s.url, detail: `same photo as ${earlier}` })
    }
  }
  return issues
}

export type HeadResult = { status: number | null; error?: string }

export type HeadOutcome = { url: string; outcome: 'ok' | 'broken' | 'skip'; status: number | null; reason: string }

/** HEAD 한 번 + 실패 시 재시도 1회. 404/410/403 등 4xx 는 깨짐, 5xx·429·시간초과는 외부 장애로 SKIP. */
export async function checkPhotoUrl(
  url: string,
  head: (url: string) => Promise<HeadResult>,
  pause: () => Promise<void>,
): Promise<HeadOutcome> {
  if (!/^https:\/\//i.test(url)) return { url, outcome: 'skip', status: null, reason: 'not_https' }
  let last: HeadResult = { status: null, error: 'no_attempt' }
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) await pause()
    try {
      last = await head(url)
    } catch (e) {
      last = { status: null, error: e instanceof Error ? e.name : 'Error' }
    }
    if (last.status != null && last.status >= 200 && last.status < 400) return { url, outcome: 'ok', status: last.status, reason: 'ok' }
    if (last.status != null && last.status >= 400 && last.status < 500 && last.status !== 429) {
      if (attempt === 1) return { url, outcome: 'broken', status: last.status, reason: `http_${last.status}` }
    }
  }
  return { url, outcome: 'skip', status: last.status, reason: last.status != null ? `http_${last.status}` : (last.error ?? 'error') }
}

/** 이번 밤 점검할 상품: id 순 회전 */
export function nightlyProductWindow<T extends { id: string }>(products: readonly T[], now: Date, size = NIGHTLY_MAX_PRODUCTS_PER_RUN): T[] {
  const sorted = [...products].sort((a, b) => a.id.localeCompare(b.id))
  if (sorted.length <= size) return sorted
  const dayIndex = Math.floor((now.getTime() + 9 * 3600_000) / 86_400_000)
  const start = (dayIndex * size) % sorted.length
  return Array.from({ length: size }, (_, i) => sorted[(start + i) % sorted.length]!)
}

export type NightlyDeps = {
  listProducts: () => Promise<PublicProductPhotos[]>
  head: (url: string) => Promise<HeadResult>
  pause: () => Promise<void>
  acquire: (input: AcquireInput) => Promise<AcquireResult>
  writeSchedule: (productId: string, expected: string | null, next: string) => Promise<boolean>
  writeCover: (productId: string, expectedUrl: string | null, data: Record<string, unknown>) => Promise<boolean>
  recordException: (e: PhotoException) => Promise<void>
  recordReplace: (input: { productId: string; day: number; assetPath: string; sourceType: string; notes: string }) => Promise<void>
  afterChange?: (productId: string) => Promise<void>
  now?: () => Date
}

export type NightlyResult = {
  products: number
  scanned: number
  headChecked: number
  broken: number
  headSkipped: Array<{ url: string; reason: string }>
  duplicates: number
  replaced: Array<{ productId: string; kind: 'day' | 'cover'; day: number | null; reason: PhotoIssueReason }>
  deferred: number
  exceptions: PhotoException[]
}

function coverSight(p: PublicProductPhotos, destTerms: string): string[] {
  const label = String(p.bgImageRehostSearchLabel ?? '').trim()
  if (label && ['sight', 'generic'].includes(sightProfile(label).kind)) return [label]
  for (const r of parseRows(p.schedule)) {
    const d = deriveDaySights(
      {
        title: typeof r.title === 'string' ? r.title : null,
        routeText: typeof r.routeText === 'string' ? r.routeText : null,
        description: typeof r.description === 'string' ? r.description : null,
        imageKeyword: typeof r.imageKeyword === 'string' ? r.imageKeyword : null,
        imageKeyword2: typeof r.imageKeyword2 === 'string' ? r.imageKeyword2 : null,
      },
      destTerms,
    )
    if (d.sights[0]) return [d.sights[0]]
  }
  return []
}

export async function runPublicPhotoNightlyAudit(deps: NightlyDeps): Promise<NightlyResult> {
  const now = deps.now?.() ?? new Date()
  const at = now.toISOString()
  const all = await deps.listProducts()
  const result: NightlyResult = { products: all.length, scanned: 0, headChecked: 0, broken: 0, headSkipped: [], duplicates: 0, replaced: [], deferred: 0, exceptions: [] }
  const byId = new Map(all.map((p) => [p.id, { ...p }]))

  const dupIssues = planDuplicateIssues(all)
  result.duplicates = dupIssues.length

  const windowProducts = nightlyProductWindow(all, now)
  result.scanned = windowProducts.length
  const brokenIssues: PhotoIssue[] = []
  const headCache = new Map<string, HeadOutcome>()
  for (const p of windowProducts) {
    for (const s of slotsOfProduct(p)) {
      let o = headCache.get(s.url)
      if (!o) {
        await deps.pause()
        o = await checkPhotoUrl(s.url, deps.head, deps.pause)
        headCache.set(s.url, o)
        result.headChecked++
        if (o.outcome === 'skip') result.headSkipped.push({ url: s.url, reason: o.reason })
      }
      if (o.outcome === 'broken') {
        result.broken++
        brokenIssues.push({ productId: p.id, kind: s.kind, day: s.day, reason: 'broken_http', url: s.url, detail: o.reason })
      }
    }
  }

  const seenSlots = new Set<string>()
  const issues = [...brokenIssues, ...dupIssues].filter((i) => {
    const k = `${i.productId}:${i.kind}:${i.day}`
    if (seenSlots.has(k)) return false
    seenSlots.add(k)
    return true
  })

  const usage: PublicPhotoUsage = buildPublicPhotoUsage(
    [...byId.values()].map((p) => ({ productId: p.id, bgImageUrl: p.bgImageUrl, bgImageExternalId: p.bgImageExternalId, bgImageSourceUrl: p.bgImageSourceUrl, schedule: p.schedule })),
  )
  const addException = async (e: PhotoException) => {
    result.exceptions.push(e)
    await deps.recordException(e)
  }

  for (const issue of issues) {
    if (result.replaced.length >= NIGHTLY_MAX_REPLACEMENTS_PER_RUN) {
      result.deferred++
      continue
    }
    const p = byId.get(issue.productId)
    if (!p) continue
    const destTerms = [p.destination, p.primaryDestination, mapDestination(p.destination ?? null), mapDestination(p.primaryDestination ?? null)].filter(Boolean).join(' ')
    const cityTerms = [mapDestination(p.destination ?? null), mapDestination(p.primaryDestination ?? null)].filter((x): x is string => Boolean(x)).map((x) => String(x))
    const exclude = new Set<string>()
    for (const s of slotsOfProduct(p)) for (const k of s.keys) exclude.add(k)
    const cur = slotsOfProduct(p).find((s) => s.kind === issue.kind && s.day === issue.day)
    if (cur?.manual) continue

    if (issue.kind === 'cover') {
      const res = await deps.acquire({ productId: p.id, kind: 'cover', day: null, sights: coverSight(p, destTerms), cityTerms, destinationText: destTerms, usage, exclude, origin: 'nightly' })
      if (!res.ok) {
        await addException({ ...res.exception, detail: `${issue.reason}; ${res.exception.detail}` })
        continue
      }
      const ok = await deps.writeCover(p.id, p.bgImageUrl, coverReplacementData(res.photo))
      if (!ok) {
        await addException({ productId: p.id, day: null, kind: 'cover', sight: res.photo.sight, query: res.photo.query, reason: 'write_failed', detail: issue.reason, origin: 'nightly', at })
        continue
      }
      await deps.recordReplace({
        productId: p.id,
        day: 1,
        assetPath: res.photo.url,
        sourceType: 'nightly-cover',
        notes: replaceNote({
          reason: issue.reason,
          slot: 'cover',
          origin: 'nightly',
          prev: {
            bgImageUrl: p.bgImageUrl,
            bgImageExternalId: p.bgImageExternalId ?? null,
            bgImageSource: p.bgImageSource ?? null,
            bgImagePhotographer: null,
            bgImageSourceUrl: p.bgImageSourceUrl ?? null,
          },
        }),
      })
      p.bgImageUrl = res.photo.url
      p.bgImageExternalId = res.photo.externalId ?? null
      p.bgImageSourceUrl = res.photo.originalLink
      usage.add(p.id, 'cover', photoIdentityKeys({ url: res.photo.url, externalId: res.photo.externalId, originalLink: res.photo.originalLink }))
      await deps.afterChange?.(p.id)
      result.replaced.push({ productId: p.id, kind: 'cover', day: null, reason: issue.reason })
      continue
    }

    const row = parseRows(p.schedule).find((r, i) => (Math.floor(Number(r.day)) > 0 ? Math.floor(Number(r.day)) : i + 1) === issue.day)
    if (!row) continue
    const res = await deps.acquire({
      productId: p.id,
      kind: 'day',
      day: issue.day,
      dayFacts: {
        title: typeof row.title === 'string' ? row.title : null,
        routeText: typeof row.routeText === 'string' ? row.routeText : null,
        description: typeof row.description === 'string' ? row.description : null,
        imageKeyword: typeof row.imageKeyword === 'string' ? row.imageKeyword : null,
        imageKeyword2: typeof row.imageKeyword2 === 'string' ? row.imageKeyword2 : null,
      },
      cityTerms,
      destinationText: destTerms,
      usage,
      exclude,
      origin: 'nightly',
    })
    if (!res.ok) {
      await addException({ ...res.exception, detail: `${issue.reason}; ${res.exception.detail}` })
      continue
    }
    const applied = applyDayPhotoReplacement(p.schedule, issue.day as number, res.photo, 'nightly')
    if ('error' in applied) {
      await addException({ productId: p.id, day: issue.day, kind: 'day', sight: res.photo.sight, query: res.photo.query, reason: `apply_${applied.error}`, detail: issue.reason, origin: 'nightly', at })
      continue
    }
    const wrote = await deps.writeSchedule(p.id, p.schedule, applied.schedule)
    if (!wrote) {
      await addException({ productId: p.id, day: issue.day, kind: 'day', sight: res.photo.sight, query: res.photo.query, reason: 'write_conflict', detail: issue.reason, origin: 'nightly', at })
      continue
    }
    await deps.recordReplace({
      productId: p.id,
      day: issue.day as number,
      assetPath: res.photo.url,
      sourceType: 'nightly-day',
      notes: replaceNote({ reason: issue.reason, slot: 'day', origin: 'nightly', prev: applied.previous }),
    })
    p.schedule = applied.schedule
    usage.add(p.id, 'day', photoIdentityKeys({ url: res.photo.url, externalId: res.photo.externalId, originalLink: res.photo.originalLink }))
    await deps.afterChange?.(p.id)
    result.replaced.push({ productId: p.id, kind: 'day', day: issue.day, reason: issue.reason })
  }
  return result
}
