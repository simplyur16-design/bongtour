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
import { isAutoRegisterReviewPassed } from '@/lib/register-auto-register-review-pass'
import { prisma } from '@/lib/prisma'
import { getAdminServiceBearerSecret } from '@/lib/admin-secrets'
import { REGISTER_PRE_PHOTO_PENDING_QUEUE_WHERE } from '@/lib/register-pre-photo-pending-queue-query'
import { refreshRegisterPrePhotoQueueFlagsForProductId } from '@/lib/register-pre-photo-queue-flags'
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
  }

  const ids = await prisma.product.findMany({
    where: REGISTER_PRE_PHOTO_PENDING_QUEUE_WHERE,
    select: { id: true, registerPhotosReady: true, bgImageUrl: true },
    orderBy: { updatedAt: 'asc' },
    take: limit,
  })

  for (const { id, registerPhotosReady, bgImageUrl } of ids) {
    result.scanned++
    // 03·04: 사진 채움(기존 process-images 재사용, 서비스 Bearer)
    // 대표 사진이 이미 있는 상품은 자동 채움으로 덮어쓰지 않음(사장님 10/31: 기존 대표사진 보호)
    const hasMainPhoto = String(bgImageUrl ?? '').trim() !== ''
    if (sw.fill && !registerPhotosReady && !hasMainPhoto) {
      const secret = getAdminServiceBearerSecret()
      if (!secret) {
        result.fillFailed++
      } else {
        try {
          const res = await f(`${appOrigin(env)}/api/travel/process-images`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secret}` },
            body: JSON.stringify({ productId: id, photoChain: 'v2' }),
          })
          const j = (await res.json().catch(() => ({}))) as { success?: boolean }
          if (res.ok && j.success) result.filled++
          else result.fillFailed++
        } catch {
          result.fillFailed++
        }
        await refreshRegisterPrePhotoQueueFlagsForProductId(id).catch(() => {})
      }
      await sleep(gapMs)
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
        destination: true,
        primaryDestination: true,
        title: true,
        countryKey: true,
        bgImageUrl: true,
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
    // 가격 값은 메모리로도 읽지 않고 '있는지'만 센다
    const priceRows = await prisma.product.count({ where: { id, minBookableAdultPrice: { not: null } } })
    const urls = [String(p.bgImageUrl ?? '').trim(), ...scheduleImageUrls(p.schedule)].filter(Boolean)
    const probes: Record<string, ProbedImage> = {}
    for (const u of [...new Set(urls)]) probes[u] = await probeStoredImage(u, f)
    const gate = evaluateAutoRegisterGate({
      ...p,
      sportsThemeTag: p.sportsThemeTag ?? null,
      departureCount: p._count.departures,
      itineraryDayCount: p._count.itineraryDays,
      // 가격 값 자체는 쓰지 않고 '있음' 여부만
      hasBookablePrice: p.hasBookableDepartures === true && priceRows === 1,
      probes,
    })

    // 문과장 사진 검수 통과 목록 밖이면 자동 검사를 통과해도 등록 전환하지 않음 (REGRESSION-FREEZE[auto-register-review-pass])
    const reviewPassed = isAutoRegisterReviewPassed(id)
    if (!reviewPassed && !gate.reasons.includes('photo_review_pending')) gate.reasons.push('photo_review_pending')
    if (gate.ok && reviewPassed) {
      if (sw.flip) {
        const upd = await prisma.product.updateMany({
          where: { id, OR: [{ registrationStatus: null }, { registrationStatus: '' }, { registrationStatus: 'pending' }] },
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
          autoRegisterBlockReason: formatAutoRegisterBlockReasons(gate.reasons).slice(0, 500),
          autoRegisterCheckedAt: new Date(),
          ...(photoReason ? { needsImageReview: true } : {}),
        },
      })
    }
  }
  return result
}
