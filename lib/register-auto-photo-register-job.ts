/**
 * 등록대기 → 사진 자동 채움(03·04) → 자동 검사(05) → 등록 완료 — 끊긴 사슬 재연결.
 * - 셀프힐(02)과 분리된 작업: REGRESSION-FREEZE[register-pre-photo-self-heal] "셀프힐 cron 사진 생성 금지" 유지.
 * - 사진 채움은 기존 /api/travel/process-images 를 photoChain:'v2'(Pexels → Unsplash → AI 표시) 로 부른다.
 * - 스위치 3개, 모두 기본 꺼짐(사장님 실행 승인 전에는 읽기·보고만):
 *   BONGTOUR_AUTO_PHOTO_FILL=1        사진 없는 등록대기 상품에 process-images 실행
 *   BONGTOUR_AUTO_REGISTER_FLIP=1     자동 검사 통과 상품만 registered 로 전환
 *   BONGTOUR_AUTO_REGISTER_RECORD=1   실패 사유를 관리자 화면용 칸에 기록(FLIP=1 이면 함께 기록)
 * - 가격은 읽지도 쓰지도 않음(예약 가능 가격이 '있는지'만 hasBookableDepartures/minBookableAdultPrice IS NOT NULL 로 확인).
 * - 공급사 원문 칸은 쓰지 않음. 쓰는 칸: registrationStatus·autoUnpublished*·autoRegisterBlockReason·autoRegisterCheckedAt·needsImageReview.
 * REGRESSION-FREEZE[register-auto-register-gate]: 기본 꺼짐, 통과만 registered, 실패는 사유만 — manifest
 */
import { logAutoPhotoAttempt, providerErrorClass } from '@/lib/auto-photo-attempt-log'
import { isAutoRegisterReviewPassed } from '@/lib/register-auto-register-review-pass'
import { autoPhotoFillRequest, scheduleHasMissingEligiblePhotoSlot } from '@/lib/register-auto-photo-missing-day'
import { prisma } from '@/lib/prisma'
import { getAdminServiceBearerSecret } from '@/lib/admin-secrets'
import { REGISTER_PRE_PHOTO_PENDING_QUEUE_WHERE } from '@/lib/register-pre-photo-pending-queue-query'
import { refreshRegisterPrePhotoQueueFlagsForProductId } from '@/lib/register-pre-photo-queue-flags'
import { loadRegisterPublishFacts } from '@/lib/register-publish-facts'
import { loadPublicPhotoUsageCached } from '@/lib/photo-autofill-public-usage'
import { buildRegistrationPhotoInput, runPhotoHealForProduct, runPublicPhotoNightlyAuditLive } from '@/lib/photo-gate-runner'
import { isNightlyAuditWindowKst } from '@/lib/photo-nightly-audit'
import { summarizePhotoExceptions, type PhotoException } from '@/lib/photo-exception-list'
import { evaluateRegistrationPhotos, registrationBlockCodes } from '@/lib/register-photo-registration-gate'
import {
  evaluateAutoRegisterGate,
  formatAutoRegisterBlockReasons,
  type ProbedImage,
} from '@/lib/register-auto-register-gate'

export const AUTO_PHOTO_FILL_ENV = 'BONGTOUR_AUTO_PHOTO_FILL'
export const AUTO_REGISTER_FLIP_ENV = 'BONGTOUR_AUTO_REGISTER_FLIP'
export const AUTO_REGISTER_RECORD_ENV = 'BONGTOUR_AUTO_REGISTER_RECORD'

type Env = Record<string, string | undefined>
const on = (env: Env, k: string) => (env[k] ?? '').trim() === '1'

export function autoRegisterSwitches(env: Env = process.env) {
  const flip = on(env, AUTO_REGISTER_FLIP_ENV)
  return {
    fill: on(env, AUTO_PHOTO_FILL_ENV),
    flip,
    record: flip || on(env, AUTO_REGISTER_RECORD_ENV),
  }
}

/** 저장된 사진 주소만 측정(https 만). 앞부분만 받고 용량은 Content-Length / Content-Range 로 읽음 */
export async function probeStoredImage(url: string, fetchImpl: typeof fetch = fetch): Promise<ProbedImage> {
  const out: ProbedImage = { url, bytes: null, width: null }
  if (!/^https:\/\//i.test(url)) return out
  try {
    const ac = new AbortController()
    const t = setTimeout(() => ac.abort(), 15000)
    const head = await fetchImpl(url, { method: 'HEAD', signal: ac.signal }).finally(() => clearTimeout(t))
    const len = Number(head.headers.get('content-length') ?? '')
    if (head.ok && Number.isFinite(len) && len > 0) out.bytes = len
  } catch {
    /* 측정 실패 = 보류 */
  }
  const { probeImageDimensions } = await import('@/lib/image-dimension-probe')
  const dim = await probeImageDimensions(url, { fetchImpl })
  if (dim) out.width = dim.width
  return out
}

function scheduleImageUrls(schedule: string | null): string[] {
  if (!schedule) return []
  try {
    const v = JSON.parse(schedule) as unknown
    if (!Array.isArray(v)) return []
    return v
      .map((r) => String((r as Record<string, unknown>)?.imageUrl ?? '').trim())
      .filter(Boolean)
  } catch {
    return []
  }
}

function appOrigin(env: Env): string {
  const base =
    env.BONGTOUR_API_BASE?.trim() ||
    env.NEXT_PUBLIC_APP_URL?.trim() ||
    env.NEXT_PUBLIC_SITE_URL?.trim() ||
    env.NEXTAUTH_URL?.trim() ||
    'http://localhost:3000'
  return base.replace(/\/$/, '')
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export type AutoPhotoRegisterRunResult = {
  switches: ReturnType<typeof autoRegisterSwitches>
  scanned: number
  filled: number
  fillFailed: number
  registered: number
  held: number
  heldByReason: Record<string, number>
  /** 등록 전 사진 게이트가 막아 자가 힐로 교체한 칸 수 / 못 고쳐 예외 목록에 오른 칸 수 */
  healed: number
  photoExceptions: number
  nightly: { ran: boolean; replaced: number; broken: number; duplicates: number; deferred: number; exceptions: number } | null
}

export async function runAutoPhotoRegisterJob(opts?: {
  limit?: number
  env?: Env
  fetchImpl?: typeof fetch
  /** 상품 사이 간격(ms) — Pexels·서버 부하를 사람처럼 */
  gapMs?: number
}): Promise<AutoPhotoRegisterRunResult> {
  const env = opts?.env ?? process.env
  const f = opts?.fetchImpl ?? fetch
  const sw = autoRegisterSwitches(env)
  const limit = Math.max(1, Math.min(50, opts?.limit ?? 20))
  const gapMs = opts?.gapMs ?? 1500
  const result: AutoPhotoRegisterRunResult = {
    switches: sw,
    scanned: 0,
    filled: 0,
    fillFailed: 0,
    registered: 0,
    held: 0,
    heldByReason: {},
    healed: 0,
    photoExceptions: 0,
    nightly: null,
  }

  const ids = await prisma.product.findMany({
    where: REGISTER_PRE_PHOTO_PENDING_QUEUE_WHERE,
    select: { id: true, bgImageUrl: true, schedule: true },
    orderBy: { updatedAt: 'asc' },
    take: limit,
  })

  for (const { id, bgImageUrl, schedule } of ids) {
    result.scanned++
    // 03·04: 사진 채움. 대표가 있어도 당일 키워드가 있는 빈 일차만 채운다.
    // pre_photo_blocked 는 위 큐 조건에서 빠진다. queueReady 는 여기서 바꾸지 않는다.
    // REGRESSION-FREEZE[auto-photo-missing-day-fill]: missing-day-only — manifest
    const hasMainPhoto = String(bgImageUrl ?? '').trim() !== ''
    const missingDay = scheduleHasMissingEligiblePhotoSlot(schedule)
    if (sw.fill && missingDay) {
      const attemptAt = new Date().toISOString()
      const secret = getAdminServiceBearerSecret()
      if (!secret) {
        logAutoPhotoAttempt({
          productId: id,
          day: null,
          gate: 'service-auth',
          providerErrorClass: 'MissingServiceAuth',
          attemptAt,
          result: 'failed',
        })
        result.fillFailed++
      } else {
        try {
          const res = await f(`${appOrigin(env)}/api/travel/process-images`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secret}` },
            body: JSON.stringify({ productId: id, ...autoPhotoFillRequest(hasMainPhoto) }),
          })
          const j = (await res.json().catch(() => ({}))) as { success?: boolean; filled?: number; reason?: string }
          const filledCount = typeof j.filled === 'number' && Number.isFinite(j.filled) ? Math.max(0, Math.floor(j.filled)) : 0
          // REGRESSION-FREEZE[photo-fill-route-sight-1114]: 응답의 실제 채움 수만 성공으로 센다 — manifest
          if (res.ok && j.success === true && filledCount > 0) {
            logAutoPhotoAttempt({
              productId: id,
              day: null,
              gate: 'process-images',
              providerErrorClass: null,
              attemptAt,
              result: 'filled',
              filled: filledCount,
            })
            result.filled += filledCount
          } else {
            logAutoPhotoAttempt({
              productId: id,
              day: null,
              gate: 'process-images',
              providerErrorClass: j.reason || (res.ok ? 'FillRejected' : `Http${res.status}`),
              attemptAt,
              result: 'failed',
              filled: filledCount,
            })
            result.fillFailed++
          }
        } catch (err) {
          logAutoPhotoAttempt({
            productId: id,
            day: null,
            gate: 'process-images',
            providerErrorClass: providerErrorClass(err),
            attemptAt,
            result: 'failed',
          })
          result.fillFailed++
        }
        await refreshRegisterPrePhotoQueueFlagsForProductId(id).catch((err) => {
          logAutoPhotoAttempt({
            productId: id,
            day: null,
            gate: 'queue-flag-refresh',
            providerErrorClass: providerErrorClass(err),
            attemptAt: new Date().toISOString(),
            result: 'failed',
          })
        })
      }
      await sleep(gapMs)
    }

    // 04b: 등록 전 사진 게이트가 막은 칸은 다음 후보(칸당 5개)로 자가 힐. 못 고친 칸은 예외 목록 + 이 상품만 보류.
    // REGRESSION-FREEZE[photo-registration-gate-wiring]: 힐 → 게이트 → 보류 사유 기록 — manifest
    let healExceptions: PhotoException[] = []
    if (sw.fill) {
      try {
        const healed = await runPhotoHealForProduct(prisma, id, (u) => probeStoredImage(u, f))
        result.healed += healed.heal?.replaced.length ?? 0
        result.photoExceptions += healed.exceptions.length
        healExceptions = healed.exceptions
      } catch (err) {
        logAutoPhotoAttempt({
          productId: id,
          day: null,
          gate: 'photo-heal',
          providerErrorClass: providerErrorClass(err),
          attemptAt: new Date().toISOString(),
          result: 'failed',
        })
      }
    }

    // 05: 자동 검사
    const p = await prisma.product.findUnique({
      where: { id },
      select: {
        registrationStatus: true,
        listingKind: true,
        productType: true,
        sportsThemeTag: true,
        schedule: true,
        rawMeta: true,
        destination: true,
        primaryDestination: true,
        title: true,
        duration: true,
        countryKey: true,
        bgImageUrl: true,
        bgImageExternalId: true,
        bgImageStoragePath: true,
        originSource: true,
        originCode: true,
        originUrl: true,
        bgImageSource: true,
        bgImageIsGenerated: true,
        bgImageAiPrompt: true,
        bgImagePhotographer: true,
        bgImageSourceUrl: true,
        bgImageCityName: true,
        bgImagePlaceName: true,
        bgImageRehostSearchLabel: true,
        hasBookableDepartures: true,
        _count: { select: { departures: true, itineraryDays: true } },
      },
    })
    if (!p) continue
    const publishFacts = await loadRegisterPublishFacts(id, p)
    // 가격 값은 메모리로도 읽지 않고 '있는지'만 센다
    const priceRows = await prisma.product.count({ where: { id, minBookableAdultPrice: { not: null } } })
    const urls = [String(p.bgImageUrl ?? '').trim(), ...scheduleImageUrls(p.schedule)].filter(Boolean)
    const probes: Record<string, ProbedImage> = {}
    for (const u of [...new Set(urls)]) probes[u] = await probeStoredImage(u, f)
    const gate = evaluateAutoRegisterGate({
      ...p,
      sportsThemeTag: p.sportsThemeTag ?? null,
      departureCount: p._count.departures,
      futureDepartureCount: publishFacts.futureDepartureCount,
      fitItinerary: publishFacts.fitItinerary,
      itineraryDayCount: p._count.itineraryDays,
      // 가격 값 자체는 쓰지 않고 '있음' 여부만
      hasBookablePrice: p.hasBookableDepartures === true && priceRows === 1,
      probes,
    })

    // 등록 전 사진 게이트(방문지 불일치·공개 상품과 중복·무관 사진·저화질·용량): 기존 검사에 더하기만 한다.
    try {
      const usage = await loadPublicPhotoUsageCached(prisma)
      const photoGate = evaluateRegistrationPhotos(buildRegistrationPhotoInput({ ...p, id }, usage, probes))
      for (const code of registrationBlockCodes(photoGate.blocks)) {
        if (!gate.reasons.includes(code)) gate.reasons.push(code)
      }
      if (photoGate.blocks.length > 0) gate.ok = false
    } catch {
      if (!gate.reasons.includes('photo_review_pending')) gate.reasons.push('photo_review_pending')
      gate.ok = false
    }

    // 문과장 사진 검수 통과 목록 밖이면 자동 검사를 통과해도 등록 전환하지 않음 (REGRESSION-FREEZE[auto-register-review-pass])
    const reviewPassed = isAutoRegisterReviewPassed(id, {
      rawMeta: p.rawMeta,
      schedule: p.schedule,
      row: {
        id,
        schedule: p.schedule ?? null,
        rawMeta: p.rawMeta ?? null,
        originSource: p.originSource ?? null,
        originCode: p.originCode ?? null,
        originUrl: p.originUrl ?? null,
        bgImageUrl: p.bgImageUrl ?? null,
        bgImageExternalId: p.bgImageExternalId ?? null,
        bgImageStoragePath: p.bgImageStoragePath ?? null,
        bgImageSourceUrl: p.bgImageSourceUrl ?? null,
      },
    })
    if (!reviewPassed && !gate.reasons.includes('photo_review_pending')) gate.reasons.push('photo_review_pending')
    if (gate.ok && reviewPassed) {
      if (sw.flip) {
        const upd = await prisma.product.updateMany({
          // 문과장 1106: 검수 판단에 쓴 일정·rawMeta 그대로일 때만 전환 (판단 후 remat 커밋되면 count0)
          where: {
            id,
            OR: [{ registrationStatus: null }, { registrationStatus: '' }, { registrationStatus: 'pending' }],
            schedule: p.schedule ?? null,
            rawMeta: p.rawMeta ?? null,
            // v3: 판단 후 대표사진이 바뀌면 전환 금지
            bgImageUrl: p.bgImageUrl ?? null,
            bgImageExternalId: p.bgImageExternalId ?? null,
            bgImageStoragePath: p.bgImageStoragePath ?? null,
            bgImageSourceUrl: p.bgImageSourceUrl ?? null,
          },
          data: {
            registrationStatus: 'registered',
            autoUnpublishedAt: null,
            autoUnpublishedReason: null,
            autoRegisterBlockReason: null,
            autoRegisterCheckedAt: new Date(),
          },
        })
        if (upd.count === 1) {
          result.registered++
          await refreshRegisterPrePhotoQueueFlagsForProductId(id).catch(() => {})
          const { revalidateProductDetailCaches } = await import('@/lib/revalidate-product-detail-caches')
          const { revalidateProductListingCaches } = await import('@/lib/revalidate-product-listing-caches')
          await revalidateProductDetailCaches(id).catch(() => {})
          try {
            revalidateProductListingCaches()
          } catch {
            /* 캐시 무효화 실패는 다음 갱신 때 반영 */
          }
        }
      }
      continue
    }

    result.held++
    for (const r of gate.reasons) result.heldByReason[r] = (result.heldByReason[r] ?? 0) + 1
    if (sw.record) {
      const photoReason = gate.reasons.some((r) => r.startsWith('photo') || r.startsWith('cover') || r.startsWith('day_'))
      await prisma.product.update({
        where: { id },
        data: {
          autoRegisterBlockReason: [formatAutoRegisterBlockReasons(gate.reasons), summarizePhotoExceptions(healExceptions, 200)]
            .filter(Boolean)
            .join(' | ')
            .slice(0, 500),
          autoRegisterCheckedAt: new Date(),
          ...(photoReason ? { needsImageReview: true } : {}),
        },
      })
    }
  }

  // 야간 점검: 기존 스케줄(KST 22시~06시 구간 실행)에 붙는 단계. 공개 상품은 사진 칸만 교체하고, 외부 장애는 건너뛴다.
  // REGRESSION-FREEZE[photo-nightly-audit]: 야간 구간에서만, 실패해도 job 은 계속 — manifest
  if (sw.fill && isNightlyAuditWindowKst(new Date())) {
    try {
      const n = await runPublicPhotoNightlyAuditLive(prisma, (u) => probeStoredImage(u, f), f)
      result.photoExceptions += n.exceptions.length
      result.nightly = {
        ran: true,
        replaced: n.replaced.length,
        broken: n.broken,
        duplicates: n.duplicates,
        deferred: n.deferred,
        exceptions: n.exceptions.length,
      }
    } catch (err) {
      logAutoPhotoAttempt({
        productId: 'nightly',
        day: null,
        gate: 'photo-nightly-audit',
        providerErrorClass: providerErrorClass(err),
        attemptAt: new Date().toISOString(),
        result: 'failed',
      })
    }
  }
  return result
}
