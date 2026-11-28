/**
 * 사진 게이트·자가 힐·야간 점검의 DB 연결부(자동 등록 job 과 관리자 등록 전환이 함께 쓴다).
 * 판단은 순수 모듈(register-photo-registration-gate / photo-heal / photo-nightly-audit)이 하고, 여기서는 읽기·쓰기만 이어 붙인다.
 * 쓰는 칸: 막힌 칸의 사진 필드(schedule 의 사진 5개 필드 · 대표 bgImage*)뿐. title·가격·일정 글은 읽기만.
 * REGRESSION-FREEZE[photo-registration-gate-wiring]: 등록 전 사진 게이트·힐·야간 점검 연결 — manifest
 */
import type { PrismaClient } from '@prisma/client'
import { acquireVerifiedPhoto } from '@/lib/photo-autofill-acquire'
import { createLiveAcquireDeps } from '@/lib/photo-autofill-live-deps'
import { loadPublicPhotoUsage, loadPublicPhotoUsageCached } from '@/lib/photo-autofill-public-usage'
import { healBlockedSlots, type HealResult } from '@/lib/photo-heal'
import {
  NIGHTLY_HEAD_GAP_MS,
  NIGHTLY_HEAD_JITTER_MS,
  runPublicPhotoNightlyAudit,
  type NightlyResult,
} from '@/lib/photo-nightly-audit'
import { recordPhotoException, type PhotoException } from '@/lib/photo-exception-list'
import { evaluateRegistrationPhotos, type RegistrationPhotoBlock, type RegistrationPhotoInput } from '@/lib/register-photo-registration-gate'
import type { PublicPhotoUsage } from '@/lib/photo-autofill-gate'
import { mapDestination } from '@/lib/pexels-keyword'

export type PhotoProbe = (url: string) => Promise<{ bytes: number | null; width: number | null }>

export type ProductPhotoFacts = {
  id: string
  destination: string | null
  primaryDestination: string | null
  schedule: string | null
  bgImageUrl: string | null
  bgImageExternalId: string | null
  bgImageSource: string | null
  bgImagePhotographer: string | null
  bgImageSourceUrl: string | null
  bgImageRehostSearchLabel: string | null
  bgImagePlaceName: string | null
  bgImageIsGenerated?: boolean | null
}

export const PHOTO_FACTS_SELECT = {
  id: true,
  destination: true,
  primaryDestination: true,
  schedule: true,
  bgImageUrl: true,
  bgImageExternalId: true,
  bgImageSource: true,
  bgImagePhotographer: true,
  bgImageSourceUrl: true,
  bgImageRehostSearchLabel: true,
  bgImagePlaceName: true,
  bgImageIsGenerated: true,
} as const

export function destinationTermsOf(p: Pick<ProductPhotoFacts, 'destination' | 'primaryDestination'>): { terms: string[]; cityTerms: string[] } {
  const en = [mapDestination(p.destination ?? null), mapDestination(p.primaryDestination ?? null)].filter(Boolean)
  const terms = [p.destination, p.primaryDestination, ...en].map((x) => String(x ?? '').trim()).filter(Boolean)
  return { terms: [...new Set(terms)], cityTerms: [...new Set(en.map(String))] }
}

export function buildRegistrationPhotoInput(
  p: ProductPhotoFacts,
  usage: PublicPhotoUsage,
  probes: RegistrationPhotoInput['probes'],
): RegistrationPhotoInput {
  const cover = String(p.bgImageUrl ?? '').trim()
  return {
    productId: p.id,
    destinationTerms: destinationTermsOf(p).terms,
    cover: cover
      ? {
          url: cover,
          externalId: p.bgImageExternalId,
          originalLink: p.bgImageSourceUrl,
          source: p.bgImageSource,
          placeLabel: p.bgImageRehostSearchLabel || p.bgImagePlaceName || null,
          isGenerated: p.bgImageIsGenerated ?? null,
        }
      : null,
    schedule: p.schedule,
    usage,
    probes,
  }
}

export function photoUrlsOf(p: Pick<ProductPhotoFacts, 'bgImageUrl' | 'schedule'>): string[] {
  const out: string[] = []
  const cover = String(p.bgImageUrl ?? '').trim()
  if (cover) out.push(cover)
  try {
    const rows = p.schedule ? JSON.parse(p.schedule) : []
    if (Array.isArray(rows)) {
      for (const r of rows as Array<Record<string, unknown>>) {
        for (const k of ['imageUrl', 'imageUrl2'] as const) {
          const u = String(r?.[k] ?? '').trim()
          if (u) out.push(u)
        }
      }
    }
  } catch {
    /* 일정 JSON 이 아니면 대표만 */
  }
  return [...new Set(out)]
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

/** 사진 측정은 순차 + 간격 + 지터(사람처럼) */
export async function probePhotoUrls(urls: readonly string[], probe: PhotoProbe, opts?: { gapMs?: number; jitterMs?: number; sleepFn?: (ms: number) => Promise<void> }): Promise<RegistrationPhotoInput['probes']> {
  const out: RegistrationPhotoInput['probes'] = {}
  const gap = opts?.gapMs ?? 250
  const jitter = opts?.jitterMs ?? 250
  const wait = opts?.sleepFn ?? sleep
  for (const [i, u] of urls.entries()) {
    if (i > 0) await wait(gap + Math.floor(Math.random() * jitter))
    out[u] = await probe(u)
  }
  return out
}

export async function evaluateProductPhotos(
  prisma: PrismaClient,
  p: ProductPhotoFacts,
  probe: PhotoProbe,
  opts?: { fresh?: boolean },
): Promise<{ ok: boolean; blocks: RegistrationPhotoBlock[]; usage: PublicPhotoUsage }> {
  const usage = opts?.fresh ? await loadPublicPhotoUsage(prisma) : await loadPublicPhotoUsageCached(prisma)
  const probes = await probePhotoUrls(photoUrlsOf(p), probe)
  const r = evaluateRegistrationPhotos(buildRegistrationPhotoInput(p, usage, probes))
  return { ...r, usage }
}

/** 관리자 등록 전환용: 저장될 대표·일정 값을 덮어 쓴 채로 같은 게이트를 돌린다(읽기 전용). */
export async function evaluateStoredProductPhotosForRegistration(
  prisma: PrismaClient,
  productId: string,
  next: { bgImageUrl: string | null; schedule: string | null },
  probe: PhotoProbe,
): Promise<{ ok: boolean; blocks: RegistrationPhotoBlock[] } | null> {
  const p = (await prisma.product.findUnique({ where: { id: productId }, select: PHOTO_FACTS_SELECT })) as ProductPhotoFacts | null
  if (!p) return null
  const coverChanged = next.bgImageUrl != null && next.bgImageUrl !== p.bgImageUrl
  const merged: ProductPhotoFacts = {
    ...p,
    bgImageUrl: next.bgImageUrl ?? p.bgImageUrl,
    schedule: next.schedule ?? p.schedule,
    ...(coverChanged ? { bgImageExternalId: null, bgImageSource: null, bgImagePhotographer: null, bgImageSourceUrl: null, bgImageRehostSearchLabel: null, bgImagePlaceName: null } : {}),
  }
  const r = await evaluateProductPhotos(prisma, merged, probe, { fresh: true })
  return { ok: r.ok, blocks: r.blocks }
}

function recordReplaceLive(input: { productId: string; day: number; assetPath: string; sourceType: string; notes: string }): Promise<void> {
  return import('@/lib/asset-usage-log').then((m) =>
    m.recordAssetUsage({
      productId: input.productId,
      day: input.day,
      assetPath: input.assetPath,
      selectionMode: 'auto',
      sourceType: input.sourceType,
      actorType: 'system',
      notes: input.notes,
    }),
  )
}

async function revalidateAfterPhotoChange(productId: string): Promise<void> {
  try {
    const { revalidateProductDetailCaches } = await import('@/lib/revalidate-product-detail-caches')
    const { revalidateProductListingCaches } = await import('@/lib/revalidate-product-listing-caches')
    await revalidateProductDetailCaches(productId).catch(() => {})
    revalidateProductListingCaches()
  } catch {
    /* 캐시 무효화 실패는 다음 갱신 때 반영 */
  }
}

/** 막힌 칸을 다음 후보로 교체(칸당 후보 5개). 못 고친 칸은 예외 목록에 남고 그 상품은 자동 등록 검사에서 보류된다. */
export async function runPhotoHealForProduct(
  prisma: PrismaClient,
  productId: string,
  probe: PhotoProbe,
  takeRunBudget?: () => boolean,
  healOpts?: { maxSlotsPerProduct?: number; allowClear?: boolean },
): Promise<{ blocks: number; heal: HealResult | null; exceptions: PhotoException[] }> {
  const p = (await prisma.product.findUnique({ where: { id: productId }, select: PHOTO_FACTS_SELECT })) as ProductPhotoFacts | null
  if (!p) return { blocks: 0, heal: null, exceptions: [] }
  const evald = await evaluateProductPhotos(prisma, p, probe)
  if (evald.ok) return { blocks: 0, heal: null, exceptions: [] }
  const { terms, cityTerms } = destinationTermsOf(p)
  const live = createLiveAcquireDeps({ prisma, destination: terms.join(' '), probe })
  const heal = await healBlockedSlots(
    {
      productId,
      destinationTerms: terms,
      cityTerms,
      schedule: p.schedule,
      cover: p.bgImageUrl
        ? {
            url: p.bgImageUrl,
            externalId: p.bgImageExternalId,
            originalLink: p.bgImageSourceUrl,
            source: p.bgImageSource,
            photographer: p.bgImagePhotographer,
            sourceUrl: p.bgImageSourceUrl,
            placeLabel: p.bgImageRehostSearchLabel || p.bgImagePlaceName || null,
          }
        : null,
      blocks: evald.blocks,
    },
    {
      acquire: (input) => acquireVerifiedPhoto(input, live),
      writeSchedule: async (id, expected, next) => (await prisma.product.updateMany({ where: { id, schedule: expected }, data: { schedule: next } })).count === 1,
      writeCover: async (id, data) => (await prisma.product.updateMany({ where: { id, bgImageUrl: p.bgImageUrl ?? null }, data: data as never })).count === 1,
      recordException: (e) => recordPhotoException(e),
      recordReplace: recordReplaceLive,
      usage: evald.usage,
      takeRunBudget,
      ...(healOpts?.maxSlotsPerProduct != null ? { maxSlotsPerProduct: healOpts.maxSlotsPerProduct } : {}),
      ...(healOpts?.allowClear != null ? { allowClear: healOpts.allowClear } : {}),
    },
  )
  if (heal.replaced.length > 0) await revalidateAfterPhotoChange(productId)
  return { blocks: evald.blocks.length, heal, exceptions: heal.exceptions }
}

export type PublicWrongPhotoReplaceResult = {
  scanned: number
  targets: number
  replaced: Array<{ productId: string; kind: 'day' | 'cover'; day: number | null; reason: string }>
  kept: Array<{ productId: string; kind: 'day' | 'cover'; day: number | null; reason: string }>
  /** 쿼터·시간 한도로 이번 단계에서 못 한 상품 수(기존 사진 그대로) */
  deferred: number
  remainingProductIds: string[]
  rounds: number
  waitedMs: number
  stopReason: 'done' | 'time_budget' | 'quota_wait_exceeds_budget' | 'max_rounds'
}

/** 한도(Unsplash·Pixabay)에 막혀 못 고친 칸이 있었는지 — acquire 예외 detail 의 notes 로 판정 */
export function exceptionsHitStockQuota(exceptions: ReadonlyArray<{ detail?: string | null }>): boolean {
  return exceptions.some((e) => /\b(unsplash|pixabay)_limit\b/.test(String(e.detail ?? '')))
}

/**
 * 공개 상품의 잘못 채워진 사진 칸 교체(사진 칸만, 관리자 선택 칸 제외, 못 찾으면 기존 유지).
 * 전 공개 상품을 판정하고(DB 글만) 틀린 칸은 칸 수 상한 없이 한 실행에서 모두 처리한다.
 * 쿼터에 막힌 칸은 한도 창이 풀릴 때까지 같은 실행에서 기다린 뒤 이어서 처리한다.
 * REGRESSION-FREEZE[photo-replace-wrong-1128]: 공개 상품 교체는 registered·같은 일정일 때만 쓰기 — manifest
 * REGRESSION-FREEZE[self-heal-no-cap-1128]: 교체·판정 칸 수 상한 없음, 쿼터 대기 후 재개 — manifest
 */
export async function runPublicWrongPhotoReplaceLive(
  prisma: PrismaClient,
  probe: PhotoProbe,
  opts: { now?: Date; deadlineAtMs?: number; onlyProductIds?: readonly string[]; sleep?: (ms: number) => Promise<void> } = {},
): Promise<PublicWrongPhotoReplaceResult> {
  const { publicWrongPhotoBlocks, rotateForHour, runWrongPhotoRounds, WRONG_PHOTO_REPLACE_TIME_BUDGET_MS } = await import('@/lib/photo-replace-wrong-1128')
  const { stockQuotaResumeAtMs } = await import('@/lib/register-photo-stock-rate-guard')
  const out: PublicWrongPhotoReplaceResult = {
    scanned: 0,
    targets: 0,
    replaced: [],
    kept: [],
    deferred: 0,
    remainingProductIds: [],
    rounds: 0,
    waitedMs: 0,
    stopReason: 'done',
  }
  const rows = (await prisma.product.findMany({
    where: { registrationStatus: 'registered' },
    select: PHOTO_FACTS_SELECT,
    orderBy: { id: 'asc' },
  })) as ProductPhotoFacts[]
  const usage = await loadPublicPhotoUsageCached(prisma)
  const only = opts.onlyProductIds ? new Set(opts.onlyProductIds) : null
  const targetIds: string[] = []
  // 전 상품 판정(사진 측정 없음, DB 글만) — 상한 없음. 틀린 칸이 있는 상품만 모은다.
  for (const p of rotateForHour(rows, opts.now ?? new Date(), rows.length)) {
    if (only && !only.has(p.id)) continue
    out.scanned++
    const blocks = publicWrongPhotoBlocks(evaluateRegistrationPhotos(buildRegistrationPhotoInput(p, usage, {})).blocks)
    if (blocks.length === 0) continue
    out.targets += blocks.length
    targetIds.push(p.id)
  }
  const processOne = async (productId: string) => {
    // 이전 라운드에서 일정이 바뀌었을 수 있어 매번 새로 읽어 판정한다(이미 고친 칸은 빠진다)
    const p = (await prisma.product.findFirst({ where: { id: productId, registrationStatus: 'registered' }, select: PHOTO_FACTS_SELECT })) as ProductPhotoFacts | null
    if (!p) return { replaced: 0, quotaLimited: false }
    const blocks = publicWrongPhotoBlocks(evaluateRegistrationPhotos(buildRegistrationPhotoInput(p, usage, {})).blocks)
    if (blocks.length === 0) return { replaced: 0, quotaLimited: false }
    const { terms, cityTerms } = destinationTermsOf(p)
    const live = createLiveAcquireDeps({ prisma, destination: terms.join(' '), probe })
    const heal = await healBlockedSlots(
      {
        productId: p.id,
        destinationTerms: terms,
        cityTerms,
        schedule: p.schedule,
        cover: p.bgImageUrl
          ? {
              url: p.bgImageUrl,
              externalId: p.bgImageExternalId,
              originalLink: p.bgImageSourceUrl,
              source: p.bgImageSource,
              photographer: p.bgImagePhotographer,
              sourceUrl: p.bgImageSourceUrl,
              placeLabel: p.bgImageRehostSearchLabel || p.bgImagePlaceName || null,
            }
          : null,
        blocks,
      },
      {
        acquire: (input) => acquireVerifiedPhoto(input, live),
        writeSchedule: async (id, expected, next) =>
          (await prisma.product.updateMany({ where: { id, schedule: expected, registrationStatus: 'registered' }, data: { schedule: next } })).count === 1,
        writeCover: async (id, data) =>
          (await prisma.product.updateMany({ where: { id, bgImageUrl: p.bgImageUrl ?? null, registrationStatus: 'registered' }, data: data as never })).count === 1,
        recordException: (e) => recordPhotoException(e),
        recordReplace: recordReplaceLive,
        usage,
        // 칸 수 상한 없음: 한 상품의 틀린 칸도 모두 고친다
        maxSlotsPerProduct: Number.POSITIVE_INFINITY,
      },
    )
    for (const r of heal.replaced) out.replaced.push({ productId: p.id, ...r })
    for (const e of heal.exceptions) out.kept.push({ productId: p.id, kind: e.kind === 'cover' ? 'cover' : 'day', day: e.day ?? null, reason: String(e.reason) })
    if (heal.replaced.length > 0) await revalidateAfterPhotoChange(p.id)
    return { replaced: heal.replaced.length, quotaLimited: exceptionsHitStockQuota(heal.exceptions) }
  }
  const r = await runWrongPhotoRounds({
    productIds: targetIds,
    processOne,
    quotaResumeAtMs: stockQuotaResumeAtMs,
    now: () => Date.now(),
    sleep: opts.sleep ?? sleep,
    deadlineAtMs: opts.deadlineAtMs ?? Date.now() + WRONG_PHOTO_REPLACE_TIME_BUDGET_MS,
  })
  out.rounds = r.rounds
  out.waitedMs = r.waitedMs
  out.stopReason = r.stopReason
  out.remainingProductIds = r.remaining
  out.deferred = r.remaining.length
  return out
}

export type PendingWrongPhotoReplaceResult = {
  scanned: number
  targets: number
  targetProducts: number
  replaced: number
  kept: number
  deferred: number
  remainingProductIds: string[]
  rounds: number
  waitedMs: number
  stopReason: 'done' | 'time_budget' | 'quota_wait_exceeds_budget' | 'max_rounds'
}

/**
 * 등록대기(pending·pre_photo_blocked) 상품의 틀린 사진 칸 교체 — 공개 경로와 같은 구조.
 * 전 등록대기 상품을 판정(DB 글만)하고, 틀린 칸이 있는 상품을 먼저·상한 없이 처리한다(50상품 창·교체 예산 12 없음).
 * 외부 가드(Unsplash·Pixabay)에 막히면 창이 풀릴 때까지 같은 실행에서 기다린 뒤 이어서 처리한다. 칸을 비우지 않는다.
 * auto_unpublished 는 범위 밖(건드리지 않음). 국내여행 등록대기 제외는 기존 규칙 그대로.
 * REGRESSION-FREEZE[self-heal-no-cap-1128]: 등록대기도 상한 없이 틀린 칸 상품 우선·쿼터 대기 후 재개·비우기 0 — manifest
 */
export async function runPendingWrongPhotoReplaceLive(
  prisma: PrismaClient,
  probe: PhotoProbe,
  opts: {
    now?: Date
    deadlineAtMs?: number
    onlyProductIds?: readonly string[]
    sleep?: (ms: number) => Promise<void>
    /** 테스트용: 상품 하나를 고치는 함수. 기본은 runPhotoHealForProduct(무제한·비우기 금지). */
    healOne?: (productId: string) => Promise<{ replaced: number; exceptions: ReadonlyArray<{ detail?: string | null }> }>
    quotaResumeAtMs?: () => number | null
  } = {},
): Promise<PendingWrongPhotoReplaceResult> {
  const { pendingWrongPhotoBlocks, rotateForHour, runWrongPhotoRounds, WRONG_PHOTO_REPLACE_TIME_BUDGET_MS } = await import('@/lib/photo-replace-wrong-1128')
  const { stockQuotaResumeAtMs } = await import('@/lib/register-photo-stock-rate-guard')
  const { REGISTER_PRE_PHOTO_PENDING_QUEUE_WHERE } = await import('@/lib/register-pre-photo-pending-queue-query')
  const { isRegisterIngestDomesticKoreaProduct } = await import('@/lib/register-ingest-reject-domestic-korea')
  const out: PendingWrongPhotoReplaceResult = {
    scanned: 0,
    targets: 0,
    targetProducts: 0,
    replaced: 0,
    kept: 0,
    deferred: 0,
    remainingProductIds: [],
    rounds: 0,
    waitedMs: 0,
    stopReason: 'done',
  }
  const rows = (await prisma.product.findMany({
    // 기존 매시 작업의 등록대기 조회와 같은 조건(auto_unpublished 는 들어 있지 않다)
    where: { OR: [REGISTER_PRE_PHOTO_PENDING_QUEUE_WHERE, { registrationStatus: 'pending' }, { registrationStatus: 'pre_photo_blocked' }] },
    select: { ...PHOTO_FACTS_SELECT, title: true, countryKey: true },
    orderBy: { id: 'asc' },
  })) as Array<ProductPhotoFacts & { title: string | null; countryKey: string | null }>
  const usage = await loadPublicPhotoUsageCached(prisma)
  const only = opts.onlyProductIds ? new Set(opts.onlyProductIds) : null
  const targetIds: string[] = []
  for (const p of rotateForHour(rows, opts.now ?? new Date(), rows.length)) {
    if (only && !only.has(p.id)) continue
    if (isRegisterIngestDomesticKoreaProduct(p.title, p.destination, p.countryKey)) continue
    out.scanned++
    const blocks = pendingWrongPhotoBlocks(evaluateRegistrationPhotos(buildRegistrationPhotoInput(p, usage, {})).blocks)
    if (blocks.length === 0) continue
    out.targets += blocks.length
    targetIds.push(p.id)
  }
  out.targetProducts = targetIds.length
  const healOne =
    opts.healOne ??
    (async (id: string) => {
      const h = await runPhotoHealForProduct(prisma, id, probe, undefined, { maxSlotsPerProduct: Number.POSITIVE_INFINITY, allowClear: false })
      return { replaced: h.heal?.replaced.length ?? 0, exceptions: h.exceptions }
    })
  const r = await runWrongPhotoRounds({
    productIds: targetIds,
    processOne: async (id) => {
      const h = await healOne(id)
      out.replaced += h.replaced
      out.kept += h.exceptions.length
      if (h.replaced > 0) await revalidateAfterPhotoChange(id)
      return { replaced: h.replaced, quotaLimited: exceptionsHitStockQuota(h.exceptions) }
    },
    quotaResumeAtMs: opts.quotaResumeAtMs ?? stockQuotaResumeAtMs,
    now: () => Date.now(),
    sleep: opts.sleep ?? sleep,
    deadlineAtMs: opts.deadlineAtMs ?? Date.now() + WRONG_PHOTO_REPLACE_TIME_BUDGET_MS,
  })
  out.rounds = r.rounds
  out.waitedMs = r.waitedMs
  out.stopReason = r.stopReason
  out.remainingProductIds = r.remaining
  out.deferred = r.remaining.length
  return out
}

export async function headStatus(url: string, fetchImpl: typeof fetch = fetch): Promise<{ status: number | null; error?: string }> {
  const ac = new AbortController()
  const t = setTimeout(() => ac.abort(), 15000)
  try {
    const res = await fetchImpl(url, { method: 'HEAD', signal: ac.signal })
    return { status: res.status }
  } catch (e) {
    return { status: null, error: e instanceof Error ? e.name : 'Error' }
  } finally {
    clearTimeout(t)
  }
}

export async function runPublicPhotoNightlyAuditLive(prisma: PrismaClient, probe: PhotoProbe, fetchImpl: typeof fetch = fetch): Promise<NightlyResult> {
  return runPublicPhotoNightlyAudit({
    listProducts: async () =>
      (await prisma.product.findMany({
        where: { registrationStatus: 'registered' },
        select: { ...PHOTO_FACTS_SELECT, createdAt: true },
      })) as never,
    head: (url) => headStatus(url, fetchImpl),
    pause: () => sleep(NIGHTLY_HEAD_GAP_MS + Math.floor(Math.random() * NIGHTLY_HEAD_JITTER_MS)),
    acquire: (input) => acquireVerifiedPhoto(input, createLiveAcquireDeps({ prisma, destination: input.destinationText, probe })),
    writeSchedule: async (id, expected, next) => (await prisma.product.updateMany({ where: { id, schedule: expected, registrationStatus: 'registered' }, data: { schedule: next } })).count === 1,
    writeCover: async (id, expectedUrl, data) => (await prisma.product.updateMany({ where: { id, bgImageUrl: expectedUrl, registrationStatus: 'registered' }, data: data as never })).count === 1,
    recordException: (e) => recordPhotoException(e),
    recordReplace: recordReplaceLive,
    afterChange: revalidateAfterPhotoChange,
  })
}
