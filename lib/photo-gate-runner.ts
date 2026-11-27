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
  deferred: number
}

/**
 * 공개 상품의 잘못 채워진 사진 칸 교체(사진 칸만, 관리자 선택 칸 제외, 못 찾으면 기존 유지).
 * REGRESSION-FREEZE[photo-replace-wrong-1128]: 공개 상품 교체는 registered·같은 일정일 때만 쓰기 — manifest
 */
export async function runPublicWrongPhotoReplaceLive(
  prisma: PrismaClient,
  probe: PhotoProbe,
  opts: { takeRunBudget: () => boolean; now?: Date; scanLimit?: number },
): Promise<PublicWrongPhotoReplaceResult> {
  const { publicWrongPhotoBlocks, rotateForHour, WRONG_PHOTO_REPLACE_PUBLIC_SCAN_PER_RUN } = await import('@/lib/photo-replace-wrong-1128')
  const out: PublicWrongPhotoReplaceResult = { scanned: 0, targets: 0, replaced: [], kept: [], deferred: 0 }
  const rows = (await prisma.product.findMany({
    where: { registrationStatus: 'registered' },
    select: PHOTO_FACTS_SELECT,
    orderBy: { id: 'asc' },
  })) as ProductPhotoFacts[]
  const usage = await loadPublicPhotoUsageCached(prisma)
  for (const p of rotateForHour(rows, opts.now ?? new Date(), opts.scanLimit ?? WRONG_PHOTO_REPLACE_PUBLIC_SCAN_PER_RUN)) {
    out.scanned++
    // 판정은 DB 글로만(사진 측정 없음) — 용량·해상도는 기존 점검 몫
    const blocks = publicWrongPhotoBlocks(evaluateRegistrationPhotos(buildRegistrationPhotoInput(p, usage, {})).blocks)
    if (blocks.length === 0) continue
    out.targets += blocks.length
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
        takeRunBudget: opts.takeRunBudget,
      },
    )
    for (const r of heal.replaced) out.replaced.push({ productId: p.id, ...r })
    for (const e of heal.exceptions) out.kept.push({ productId: p.id, kind: e.kind === 'cover' ? 'cover' : 'day', day: e.day ?? null, reason: String(e.reason) })
    out.deferred += heal.deferred ?? 0
    if (heal.replaced.length > 0) await revalidateAfterPhotoChange(p.id)
    if (heal.deferred) break
  }
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
