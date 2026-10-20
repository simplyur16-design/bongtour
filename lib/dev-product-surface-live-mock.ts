/**
 * /dev/product-surface-preview — 등록 상품 DB → 목업 뷰모델.
 * REGRESSION-FREEZE[bongtour-route-map-gemini-v1]: loadDevProductSurfaceLiveMock — manifest
 */

import { prisma } from '@/lib/prisma'
import { getScheduleFromProduct } from '@/lib/schedule-from-product'
import { buildBongtourRouteMapChain } from '@/lib/bongtour-route-map-chain-ssot'
import { composeBongtourHeroDisplayTitle } from '@/lib/bongtour-product-display-title-ssot'
import { buildBongtourRouteMapGeminiFallback } from '@/lib/bongtour-route-map-gemini-fallback'
import { generateBongtourRouteMapGemini } from '@/lib/bongtour-route-map-gemini-generate'
import { collectBongtourRouteMapSourceText } from '@/lib/bongtour-route-map-source-text'
import type { BongtourRouteMapGeminiDraft } from '@/lib/bongtour-route-map-gemini-types'
import { formatMealDisplay } from '@/lib/hotel-meal-display'
import { formatOriginSourceForDisplay } from '@/lib/supplier-origin'
import { publicProductPath } from '@/lib/product-public-path'
import {
  inferBongtourBenefitIconKeys,
  type BongtourBenefitIconKey,
} from '@/lib/bongtour-benefit-icon-ssot'
import { readBongtourRouteMapPersisted } from '@/lib/bongtour-route-map-persist-ssot'

export const DEV_PRODUCT_SURFACE_DEFAULT_ID = 'cmtegbf0y02uygh464waiwcza'
export const DEV_PRODUCT_SURFACE_DEFAULT_SLUG = 'pkg-vg-0025'

export type DevProductSurfaceDay = {
  day: number
  title: string
  routeText: string
  description: string
  /** 숙소명 — 식사만 적힌 hotelText는 null */
  hotelLine: string | null
  mealLines: string[]
}

export type DevProductSurfaceLiveMock = {
  productId: string
  slug: string | null
  publicPath: string
  originSource: string
  supplierLabelKo: string
  heroShortTitle: string | null
  heroSubtitle: string | null
  originalTitle: string
  duration: string | null
  priceFrom: number | null
  priceLabel: string
  chips: string[]
  /** 직항·국내선·노쇼핑 등 pastel 아이콘 키 */
  benefitIcons: BongtourBenefitIconKey[]
  usp: Array<{ strong: string; body: string }>
  included: string[]
  excluded: string[]
  schedule: DevProductSurfaceDay[]
  cities: string[]
  showMapTab: boolean
  mapDraft: BongtourRouteMapGeminiDraft
  /** 등록 시 저장된 동선지도 URL (클릭 생성 금지) */
  mapImageUrl: string | null
  mapPersistStatus: 'ready' | 'failed' | 'generating' | 'missing'
  mapImageFailReason?: string
  mapSource: 'gemini' | 'fallback' | 'deterministic' | 'persisted'
  mapModel?: string
  mapAttempts?: number
  mapFailReason?: string
}

function splitLines(raw: string | null | undefined, max = 8): string[] {
  if (!raw?.trim()) return []
  const parts = raw
    .split(/\r?\n/)
    .map((l) => l.replace(/^[-•·∙※*]+\s*/u, '').trim())
    .filter((l) => l.length >= 2 && !l.startsWith('※') && !l.startsWith('국외여행'))

  const merged: string[] = []
  for (const line of parts) {
    const cont =
      merged.length > 0 &&
      (/^[（(]/.test(line) ||
        (/^[가-힣A-Za-z].*[:：]/.test(line) && line.length <= 40 && merged[merged.length - 1]!.length < 80))
    if (cont) {
      merged[merged.length - 1] = `${merged[merged.length - 1]} ${line}`
    } else {
      merged.push(line)
    }
  }
  return merged.slice(0, max)
}

function oneLine(s: string): string {
  return s.replace(/\s+/g, ' ').trim()
}

/** 일정 본문 — 줄바꿈·길이 유지 (한 줄 압축·절단 금지) */
function keepScheduleDescription(s: string): string {
  return String(s || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** hotelText에 식사만 들어 있으면 숙소 아님 */
function hotelLineFromDay(hotelText: string | null | undefined, title: string): string | null {
  const t = oneLine(String(hotelText || ''))
  if (!t) return null
  if (/숙박\s*없음|귀국/.test(t) || /숙박\s*없음|귀국/.test(title)) return null
  if (/^(조식|아침|중식|점심|석식|저녁|기내식|호텔식)\b/u.test(t) && !/호텔\s*명|투숙|숙박/.test(t)) {
    return null
  }
  return t
}

function uspFromHighlights(highlightPoints: string | null | undefined): Array<{ strong: string; body: string }> {
  const lines = splitLines(highlightPoints, 6)
  if (lines.length === 0) return []
  return lines.slice(0, 4).map((line, i) => {
    const parts = line.split(/[:：\-–—]/u)
    if (parts.length >= 2 && parts[0]!.trim().length <= 28) {
      return { strong: parts[0]!.trim(), body: parts.slice(1).join('—').trim() || line }
    }
    return { strong: `포인트 ${String(i + 1).padStart(2, '0')}`, body: line }
  })
}

function formatPrice(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n) || n <= 0) return '요금 문의'
  return `${Math.round(n).toLocaleString('ko-KR')}원~`
}

export async function loadDevProductSurfaceLiveMock(opts?: {
  idOrSlug?: string | null
  callGemini?: boolean
  /** true면 Imagen 동기 호출 생략 (페이지 SSR / API가 따로 그림) */
  skipMapImage?: boolean
}): Promise<DevProductSurfaceLiveMock | null> {
  const key = (opts?.idOrSlug || '').trim() || DEV_PRODUCT_SURFACE_DEFAULT_ID
  const callGemini = opts?.callGemini !== false
  const skipMapImage = opts?.skipMapImage !== false

  const row = await prisma.product.findFirst({
    where: {
      registrationStatus: 'registered',
      OR: [{ id: key }, { slug: key }],
    },
    select: {
      id: true,
      slug: true,
      title: true,
      originalTitle: true,
      duration: true,
      destination: true,
      primaryDestination: true,
      destinationRaw: true,
      originSource: true,
      priceFrom: true,
      includedText: true,
      excludedText: true,
      highlightPoints: true,
      highlightPointsRaw: true,
      summary: true,
      rawMeta: true,
      schedule: true,
      country: true,
    },
  })
  if (!row) return null

  const sourceText = collectBongtourRouteMapSourceText({
    includedText: row.includedText,
    excludedText: row.excludedText,
    highlightPoints: row.highlightPoints,
    highlightPointsRaw: row.highlightPointsRaw,
    summary: row.summary,
    rawMeta: row.rawMeta,
  })

  const scheduleRaw = getScheduleFromProduct(row)
  const schedule: DevProductSurfaceDay[] = scheduleRaw.map((d) => {
    const title = oneLine(String(d.title || `${d.day}일차`))
    const routeText = oneLine(String(d.routeText || title))
    const description = keepScheduleDescription(String(d.description || ''))
    return {
      day: d.day,
      title,
      routeText,
      description,
      hotelLine: hotelLineFromDay(d.hotelText, title),
      mealLines: formatMealDisplay({
        breakfastText: d.breakfastText,
        lunchText: d.lunchText,
        dinnerText: d.dinnerText,
        mealSummaryText: d.mealSummaryText,
        mealsLegacy: d.meals,
      }),
    }
  })

  const chain = buildBongtourRouteMapChain({
    schedule: schedule.map((d) => ({
      day: d.day,
      title: d.title,
      routeText: d.routeText,
    })),
    destination: row.primaryDestination || row.destination,
  })

  const haystack = [row.title, row.originalTitle, row.destination, row.primaryDestination, ...chain.cities]
    .filter(Boolean)
    .join(' ')

  const display = composeBongtourHeroDisplayTitle({
    duration: row.duration,
    countryLabel: row.country || row.primaryDestination || row.destination,
    cities: chain.cities.slice(0, 3),
    haystack,
  })

  const geminiInput = {
    productId: row.id,
    heroShortTitle: display.heroShortTitle || row.title.slice(0, 40),
    cities: chain.cities,
    schedule: schedule.map((d) => ({
      day: d.day,
      title: d.title,
      routeText: d.routeText,
      // mode 보강용 힌트만 — 화면 description은 원문 전체 유지
      description: d.description.slice(0, 600) || undefined,
    })),
  }

  let mapDraft =
    buildBongtourRouteMapGeminiFallback(chain.cities, {
      schedule: geminiInput.schedule,
      sourceText,
    }) ?? null
  let mapSource: DevProductSurfaceLiveMock['mapSource'] = 'deterministic'
  let mapModel: string | undefined
  let mapAttempts: number | undefined
  let mapFailReason: string | undefined

  if (callGemini && chain.cities.length >= 2) {
    const gen = await generateBongtourRouteMapGemini(geminiInput)
    mapAttempts = gen.attempts
    if (gen.ok) {
      // 결정론 육상 교통(대형버스 등)을 Gemini transfer가 덮어쓰지 않게 병합
      const det = mapDraft
      if (det) {
        const mergedEdges = gen.draft.edges.map((e) => {
          const d = det.edges.find((x) => x.from === e.from)
          if (d && d.mode !== 'transfer' && e.mode === 'transfer') return d
          // 결정론 fallback edge에는 inferredFromSchedule이 없음 — coach/국내선 등 육상 mode면 유지
          if (
            d &&
            d.mode !== 'transfer' &&
            (d.mode === 'coach' || d.mode === 'private_car' || d.mode === 'domestic_flight')
          ) {
            return d
          }
          return e
        })
        mapDraft = {
          ...gen.draft,
          edges: mergedEdges,
          routeSummary: gen.draft.routeSummary,
        }
      } else {
        mapDraft = gen.draft
      }
      mapSource = gen.model === 'deterministic' ? 'deterministic' : 'gemini'
      mapModel = gen.model
    } else {
      mapFailReason = `${gen.reason}${gen.detail ? `:${gen.detail}` : ''}`
      mapModel = gen.model
      if (gen.fallback) mapDraft = gen.fallback
      mapSource = 'fallback'
    }
  }

  if (!mapDraft) {
    mapDraft = {
      version: 'route-map-gemini-v1',
      layout: 'geographic',
      nodes: chain.cities.map((city, i) => ({ order: i + 1, city })),
      edges: [],
      routeSummary: chain.cities.join(' · ') || '동선 정보 없음',
    }
  }

  // 결정론 sourceText 재적용 — Gemini가 전용차량으로 바꿔도 원문 대형버스 우선
  const grounded = buildBongtourRouteMapGeminiFallback(chain.cities, {
    schedule: geminiInput.schedule,
    sourceText,
  })
  if (grounded && mapDraft) {
    mapDraft = {
      ...mapDraft,
      edges: grounded.edges.map((ge, i) => {
        const cur = mapDraft!.edges[i]
        if (ge.mode !== 'transfer') return ge
        return cur ?? ge
      }),
      routeSummary: grounded.routeSummary,
    }
  }

  const persisted = readBongtourRouteMapPersisted(row.rawMeta)
  const mapImageUrl = persisted?.status === 'ready' ? persisted.imageUrl : null
  const mapPersistStatus: DevProductSurfaceLiveMock['mapPersistStatus'] = persisted?.status ?? 'missing'
  const mapImageFailReason =
    persisted?.status === 'failed'
      ? persisted.failReason
      : persisted?.status === 'generating'
        ? 'generating'
        : persisted
          ? undefined
          : 'not_persisted_at_register'

  // 지도 캡션 = 저장된 도시 동선 (대형버스 문구 노출 금지)
  if (mapDraft) {
    const citiesOnly =
      (persisted?.routeSummary && !/대형버스|버스|전용차량/.test(persisted.routeSummary)
        ? persisted.routeSummary
        : null) ||
      mapDraft.nodes
        .slice()
        .sort((a, b) => a.order - b.order)
        .map((n) => n.city)
        .join(' → ')
    mapDraft = { ...mapDraft, routeSummary: citiesOnly }
  }

  void skipMapImage // 등록 시 저장이 SSOT — SSR 이미지 동기 호출 안 함

  const supplierLabelKo = formatOriginSourceForDisplay(row.originSource)
  const chips = [
    row.duration?.trim() || null,
    supplierLabelKo || null,
    chain.cities[0] || null,
    chain.cities.length >= 2 ? `${chain.cities.length}도시` : null,
  ].filter((x): x is string => Boolean(x))

  const benefitHay = [
    row.title,
    row.originalTitle,
    row.includedText,
    row.highlightPoints,
    row.highlightPointsRaw,
    sourceText,
    ...mapDraft.edges.map((e) => e.label),
  ]
    .filter(Boolean)
    .join('\n')
  const benefitIcons = inferBongtourBenefitIconKeys(benefitHay).slice(0, 8)

  return {
    productId: row.id,
    slug: row.slug,
    publicPath: publicProductPath(row),
    originSource: row.originSource,
    supplierLabelKo: supplierLabelKo || row.originSource,
    heroShortTitle: display.heroShortTitle,
    heroSubtitle: display.heroSubtitle,
    originalTitle: row.originalTitle || row.title,
    duration: row.duration,
    priceFrom: row.priceFrom,
    priceLabel: formatPrice(row.priceFrom),
    chips: chips.slice(0, 5),
    benefitIcons,
    usp: uspFromHighlights(row.highlightPoints),
    included: splitLines(row.includedText, 6),
    excluded: splitLines(row.excludedText, 5),
    schedule,
    cities: chain.cities,
    showMapTab: chain.showMapTab,
    mapDraft,
    mapImageUrl,
    mapPersistStatus,
    mapImageFailReason,
    mapSource: mapImageUrl ? 'persisted' : mapSource,
    mapModel,
    mapAttempts,
    mapFailReason,
  }
}
