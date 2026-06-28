'use client'

import { useState, useRef, useMemo, useEffect, useCallback } from 'react'
import Link from 'next/link'
import type { RegisterPreviewFingerprintInput } from '@/lib/register-preview-content-fingerprint-hanatour'
import { buildRegisterPreviewCanonicalString as buildRegisterCanonH } from '@/lib/register-preview-content-fingerprint-hanatour'
import { buildRegisterPreviewCanonicalString as buildRegisterCanonM } from '@/lib/register-preview-content-fingerprint-modetour'
import { buildRegisterPreviewCanonicalString as buildRegisterCanonV } from '@/lib/register-preview-content-fingerprint-verygoodtour'
import { buildRegisterPreviewCanonicalString as buildRegisterCanonY } from '@/lib/register-preview-content-fingerprint-ybtour'
import { buildRegisterPreviewCanonicalString as buildRegisterCanonKw } from '@/lib/register-preview-content-fingerprint-kyowontour'
import { buildRegisterPreviewCanonicalString as buildRegisterCanonLt } from '@/lib/register-preview-content-fingerprint-lottetour'
import { buildRegisterPreviewCanonicalString as buildRegisterCanonNt } from '@/lib/register-preview-content-fingerprint-naeiltour'
import { registerPreviewSsotBadgeLabel as registerPreviewSsotBadgeLabelH } from '@/lib/register-preview-ssot-hanatour'
import { registerPreviewSsotBadgeLabel as registerPreviewSsotBadgeLabelM } from '@/lib/register-preview-ssot-modetour'
import { registerPreviewSsotBadgeLabel as registerPreviewSsotBadgeLabelV } from '@/lib/register-preview-ssot-verygoodtour'
import { registerPreviewSsotBadgeLabel as registerPreviewSsotBadgeLabelY } from '@/lib/register-preview-ssot-ybtour'
import { registerPreviewSsotBadgeLabel as registerPreviewSsotBadgeLabelKw } from '@/lib/register-preview-ssot-kyowontour'
import { registerPreviewSsotBadgeLabel as registerPreviewSsotBadgeLabelLt } from '@/lib/register-preview-ssot-lottetour'
import { registerPreviewSsotBadgeLabel as registerPreviewSsotBadgeLabelNt } from '@/lib/register-preview-ssot-naeiltour'
import type { RegisterParsed as RegisterParsedH, RegisterScheduleDay as RegisterScheduleDayH } from '@/lib/register-llm-schema-hanatour'
import type { RegisterParsed as RegisterParsedM, RegisterScheduleDay as RegisterScheduleDayM } from '@/lib/register-llm-schema-modetour'
import type { RegisterParsed as RegisterParsedV, RegisterScheduleDay as RegisterScheduleDayV } from '@/lib/register-llm-schema-verygoodtour'
import type { RegisterParsed as RegisterParsedY, RegisterScheduleDay as RegisterScheduleDayY } from '@/lib/register-llm-schema-ybtour'
import type { RegisterParsed as RegisterParsedKw, RegisterScheduleDay as RegisterScheduleDayKw } from '@/lib/register-llm-schema-kyowontour'
import type { RegisterParsed as RegisterParsedLt, RegisterScheduleDay as RegisterScheduleDayLt } from '@/lib/register-llm-schema-lottetour'
import type { RegisterParsed as RegisterParsedNt, RegisterScheduleDay as RegisterScheduleDayNt } from '@/lib/register-llm-schema-naeiltour'
import type { RegisterPreviewPayload as RegisterPreviewPayloadH } from '@/lib/register-preview-payload-hanatour'
import type { RegisterPreviewPayload as RegisterPreviewPayloadM } from '@/lib/register-preview-payload-modetour'
import type { RegisterPreviewPayload as RegisterPreviewPayloadV } from '@/lib/register-preview-payload-verygoodtour'
import type { RegisterPreviewPayload as RegisterPreviewPayloadY } from '@/lib/register-preview-payload-ybtour'
import type { RegisterPreviewPayload as RegisterPreviewPayloadKw } from '@/lib/register-preview-payload-kyowontour'
import type { RegisterPreviewPayload as RegisterPreviewPayloadLt } from '@/lib/register-preview-payload-lottetour'
import type { RegisterPreviewPayload as RegisterPreviewPayloadNt } from '@/lib/register-preview-payload-naeiltour'
import type { BongtourProductTitlePreviewFields } from '@/lib/bongtour-product-title-register-bridge'
import { buildPexelsKeyword } from '@/lib/pexels-keyword'
import { normalizeToPlaceName } from '@/lib/pexels-place-name-keyword'
import {
  finalizeRegisterScheduleImageKeywords,
  ScheduleImageKeywordPersistError,
  tryPersistScheduleImageKeyword,
} from '@/lib/schedule-image-keyword-persist'
import {
  applyRegisterScheduleImageKeywordsForPreview,
  overlayPreviewScheduleImageKeywords,
} from '@/lib/register-schedule-image-keywords-preview'
import type { DetailBodyParseSnapshot } from '@/lib/detail-body-parser-types'
import { resolveHanatourRegisterScheduleSectionByDay, enrichHanatourRegisterPreviewScheduleRowsFromSection } from '@/lib/hanatour-schedule-section-by-day'
import { parseOptionalTourNamesFromStructuredJson } from '@/lib/register-schedule-llm-image-keyword-fallback'
import { enforceRegisterScheduleTripUniqueImageKeywords } from '@/lib/register-schedule-trip-image-keyword-dedupe'
import { sanitizeModetourRegisterScheduleRouteRows } from '@/lib/modetour-register-api-schedule'
import { isRegisterAirtelListing } from '@/lib/register-admin-airtel-listing'
import { buildAirtelRegisterPexelsUiScheduleRows } from '@/lib/register-airtel-pexels-ui-rows'
import { formatImageKeywordError } from '@/lib/image-keyword-error-messages'
import {
  CONTINENT_ID_TO_PRIMARY_REGION_KR,
  inferBrowseGeoFromDestinationText,
} from '@/lib/register-infer-browse-geo'
import SafeImage from '@/app/components/SafeImage'
import AdminPageHeader from '../components/AdminPageHeader'
import SportsThemeTagMultiSelect from '../components/SportsThemeTagMultiSelect'
import RegisterCorrectionDrawer from './components/RegisterCorrectionDrawer'
import RegisterVerificationPanel from './components/RegisterVerificationPanel'
import RegisterAdminFinalParsedSummaryCard from './components/RegisterAdminFinalParsedSummaryCard'
import type { RegisterAdminFinalParsedSummary } from './components/RegisterAdminFinalParsedSummaryCard'
import {
  applyRegisterCorrectionOverlayToParsed as applyRegisterCorrectionOverlayH,
  inferCorrectionKeyFromIssueField,
  type RegisterCorrectionOverlayV1,
  type RegisterCorrectionFieldKey,
  type RegisterCorrectionShoppingFieldV1,
  type RegisterCorrectionIssueHintDetailV1,
} from '@/lib/register-correction-types-hanatour'
import { applyRegisterCorrectionOverlayToParsed as applyRegisterCorrectionOverlayM } from '@/lib/register-correction-types-modetour'
import { applyRegisterCorrectionOverlayToParsed as applyRegisterCorrectionOverlayV } from '@/lib/register-correction-types-verygoodtour'
import { applyRegisterCorrectionOverlayToParsed as applyRegisterCorrectionOverlayY } from '@/lib/register-correction-types-ybtour'
import { applyRegisterCorrectionOverlayToParsed as applyRegisterCorrectionOverlayKw } from '@/lib/register-correction-types-kyowontour'
import { applyRegisterCorrectionOverlayToParsed as applyRegisterCorrectionOverlayLt } from '@/lib/register-correction-types-lottetour'
import { applyRegisterCorrectionOverlayToParsed as applyRegisterCorrectionOverlayNt } from '@/lib/register-correction-types-naeiltour'
import type { RegisterVerificationV1 as RegisterVerificationV1H } from '@/lib/admin-register-verification-meta-hanatour'
import type { RegisterVerificationV1 as RegisterVerificationV1M } from '@/lib/admin-register-verification-meta-modetour'
import type { RegisterVerificationV1 as RegisterVerificationV1V } from '@/lib/admin-register-verification-meta-verygoodtour'
import type { RegisterVerificationV1 as RegisterVerificationV1Y } from '@/lib/admin-register-verification-meta-ybtour'
import type { RegisterVerificationV1 as RegisterVerificationV1Kw } from '@/lib/admin-register-verification-meta-kyowontour'
import type { RegisterVerificationV1 as RegisterVerificationV1Lt } from '@/lib/admin-register-verification-meta-lottetour'
import type { RegisterVerificationV1 as RegisterVerificationV1Nt } from '@/lib/admin-register-verification-meta-naeiltour'
import {
  getRegisterPastePlaceholders,
  getSupplierInputFrameSpec,
} from '@/lib/admin-register-supplier-input-frames'
import {
  LOCAL_DEPARTURE_TAG_LABELS,
  LOCAL_DEPARTURE_TAG_VALUES,
  SPORTS_THEME_TAG_LABELS,
  SPORTS_THEME_TAG_VALUES,
  type LocalDepartureTag,
  type SportsThemeTag,
} from '@/lib/product-listing-kind'
import { isSingleDepartureAdminCheckboxDisabled } from '@/lib/single-departure-product-ssot'
import {
  CANONICAL_OVERSEAS_SUPPLIER_KEYS,
  type CanonicalOverseasSupplierKey,
} from '@/lib/overseas-supplier-canonical-keys'
import type { SupplierRegisterFactBundle } from '@/lib/register-facts/types'
import { registerFactBundleToPasteText } from '@/lib/register-facts-to-paste-text'
import { inferCanonicalSupplierFromOriginUrl } from '@/lib/infer-supplier-from-origin-url'
import {
  homeDepartureAirportDisplayText,
  inferDepartureAirportFromRegisterFactFlights,
  type HomeDepartureAirportLabel,
} from '@/lib/infer-home-departure-airport'
import { adminSupplierPrimaryDisplayLabel } from '@/lib/admin-product-supplier-derivatives'
import type { KyowontourFinalParsed } from '@/lib/kyowontour-admin-preview-card-types'

const REGISTER_FACT_FETCH_SUPPLIERS = new Set<CanonicalOverseasSupplierKey>([
  'modetour',
  'hanatour',
  'ybtour',
  'verygoodtour',
  'lottetour',
  'kyowontour',
  'naeiltour',
])

function formatRegisterFactBundleSummary(bundle: SupplierRegisterFactBundle): string {
  const parts: string[] = []
  if (bundle.title) parts.push(`제목: ${bundle.title}`)
  if (bundle.originCode) parts.push(`코드: ${bundle.originCode}`)
  if (bundle.scheduleDays.length > 0) parts.push(`일정 ${bundle.scheduleDays.length}일차`)
  if (bundle.flights.length > 0) parts.push(`항공 ${bundle.flights.length}편`)
  if (bundle.priceRows.length > 0) {
    const row = bundle.priceRows[0]
    const priceBits = [
      row?.departureDate ? `출발 ${row.departureDate}` : null,
      row?.adultPrice != null ? `성인 ${row.adultPrice.toLocaleString('ko-KR')}원` : null,
    ].filter(Boolean)
    parts.push(`가격 ${priceBits.join(' · ') || `${bundle.priceRows.length}행`}`)
  }
  return parts.join(' · ') || '구조화 사실 수집 완료'
}

const LOADING_STATUS = '봉투어 형식으로 변환 중…' as const

function draftPrimaryRegionKr(
  d: { primaryDestination?: string | null; destinationRaw?: string | null; title?: string | null } | null | undefined,
): string | null {
  if (!d) return null
  const g = inferBrowseGeoFromDestinationText({
    primaryDestination: d.primaryDestination,
    destinationRaw: d.destinationRaw,
    title: d.title,
  })
  return g ? CONTINENT_ID_TO_PRIMARY_REGION_KR[g.continent] ?? null : null
}

/** 브라우저·프록시 무한 대기 방지(LLM·다중 호출로 길어질 수 있음) */
const REGISTER_PREVIEW_FETCH_TIMEOUT_MS = 15 * 60 * 1000
const REGISTER_CONFIRM_FETCH_TIMEOUT_MS = 10 * 60 * 1000

function isAbortError(e: unknown): boolean {
  return e instanceof Error && e.name === 'AbortError'
}

type Brand = { id: string; brandKey: CanonicalOverseasSupplierKey; displayName: string; sortOrder: number }

/** 관리자 상품등록 메뉴에서만 선택 — canonical SSOT와 동일 키만 (`lib/overseas-supplier-canonical-keys.json`). */
type AdminRegisterSupplierKey = CanonicalOverseasSupplierKey

type RegisterParsed = RegisterParsedH | RegisterParsedM | RegisterParsedV | RegisterParsedY | RegisterParsedKw | RegisterParsedLt | RegisterParsedNt
type RegisterScheduleDay =
  | RegisterScheduleDayH
  | RegisterScheduleDayM
  | RegisterScheduleDayV
  | RegisterScheduleDayY
  | RegisterScheduleDayKw
  | RegisterScheduleDayLt
  | RegisterScheduleDayNt
type AdminRegisterPreviewPayload = (
  | RegisterPreviewPayloadH
  | RegisterPreviewPayloadM
  | RegisterPreviewPayloadV
  | RegisterPreviewPayloadY
  | RegisterPreviewPayloadKw
  | RegisterPreviewPayloadLt
  | RegisterPreviewPayloadNt
) &
  Partial<BongtourProductTitlePreviewFields>
type RegisterVerificationV1 =
  | RegisterVerificationV1H
  | RegisterVerificationV1M
  | RegisterVerificationV1V
  | RegisterVerificationV1Y
  | RegisterVerificationV1Kw
  | RegisterVerificationV1Lt
  | RegisterVerificationV1Nt

/** 교원이지·롯데관광·6공급사 공통 미리보기 `data` — 응답에 포함될 때만 카드에 사용한다. */
function previewFinalParsedSummaryFromPayload(p: AdminRegisterPreviewPayload | null): RegisterAdminFinalParsedSummary | null {
  if (!p) return null
  const d = (p as { data?: RegisterAdminFinalParsedSummary | null }).data
  return d ?? null
}

function buildRegisterCanonForSupplier(
  k: AdminRegisterSupplierKey,
  input: RegisterPreviewFingerprintInput
): string {
  switch (k) {
    case 'hanatour':
      return buildRegisterCanonH(input)
    case 'modetour':
      return buildRegisterCanonM(input)
    case 'verygoodtour':
      return buildRegisterCanonV(input)
    case 'ybtour':
      return buildRegisterCanonY(input)
    case 'kyowontour':
      return buildRegisterCanonKw(input)
    case 'lottetour':
      return buildRegisterCanonLt(input as Parameters<typeof buildRegisterCanonLt>[0])
    case 'naeiltour':
      return buildRegisterCanonNt(input as Parameters<typeof buildRegisterCanonNt>[0])
    default: {
      const _e: never = k
      return _e
    }
  }
}

function registerPreviewSsotBadgeLabelForSupplier(
  k: AdminRegisterSupplierKey,
  b: Parameters<typeof registerPreviewSsotBadgeLabelH>[0]
): string {
  switch (k) {
    case 'hanatour':
      return registerPreviewSsotBadgeLabelH(b)
    case 'modetour':
      return registerPreviewSsotBadgeLabelM(b)
    case 'verygoodtour':
      return registerPreviewSsotBadgeLabelV(b)
    case 'ybtour':
      return registerPreviewSsotBadgeLabelY(b)
    case 'kyowontour':
      return registerPreviewSsotBadgeLabelKw(b)
    case 'lottetour':
      return registerPreviewSsotBadgeLabelLt(b)
    case 'naeiltour':
      return registerPreviewSsotBadgeLabelNt(b)
    default: {
      const _e: never = k
      return _e
    }
  }
}

function applyRegisterCorrectionOverlayForSupplier(
  k: AdminRegisterSupplierKey,
  parsed: RegisterParsed,
  overlay: RegisterCorrectionOverlayV1 | null | undefined
): RegisterParsed {
  switch (k) {
    case 'hanatour':
      return applyRegisterCorrectionOverlayH(parsed as RegisterParsedH, overlay)
    case 'modetour':
      return applyRegisterCorrectionOverlayM(parsed as RegisterParsedM, overlay)
    case 'verygoodtour':
      return applyRegisterCorrectionOverlayV(parsed as RegisterParsedV, overlay)
    case 'ybtour':
      return applyRegisterCorrectionOverlayY(parsed as RegisterParsedY, overlay)
    case 'kyowontour':
      return applyRegisterCorrectionOverlayKw(
        parsed as RegisterParsedKw,
        overlay as Parameters<typeof applyRegisterCorrectionOverlayKw>[1]
      ) as RegisterParsed
    case 'lottetour':
      return applyRegisterCorrectionOverlayLt(
        parsed as RegisterParsedLt,
        overlay as Parameters<typeof applyRegisterCorrectionOverlayLt>[1]
      ) as RegisterParsed
    case 'naeiltour':
      return applyRegisterCorrectionOverlayNt(
        parsed as RegisterParsedNt,
        overlay as Parameters<typeof applyRegisterCorrectionOverlayNt>[1]
      ) as RegisterParsed
    default: {
      const _e: never = k
      return _e
    }
  }
}

function clipPreviewText(s: string | null | undefined, max = 48): string {
  if (s == null || s === '') return '-'
  return s.length > max ? `${s.slice(0, max)}…` : s
}

function badgeTone(kind: 'required' | 'warning' | 'info'): string {
  if (kind === 'required') return 'bg-red-100 text-red-800'
  if (kind === 'warning') return 'bg-amber-100 text-amber-800'
  return 'bg-sky-100 text-sky-800'
}

/**
 * `Product.schedule[].imageKeyword` / `imageKeyword2` — Pexels 검색용 영문 고유명(SSOT).
 * 수동 입력은 파싱 자동값을 덮어쓴다. confirm 시 `Product.schedule`에 반영된다.
 */
function applyManualPexelsKeywordsToParsedSchedule(
  parsed: RegisterParsed,
  overrides: Record<number, string>,
  overrides2: Record<number, string> = {}
): RegisterParsed {
  const sched = parsed.schedule
  if (!sched?.length) return parsed
  const next = sched.map((row) => {
    const day = Number(row.day)
    if (!Number.isFinite(day) || day < 1) return row
    let out = row
    const manual = overrides[day]
    if (manual != null && manual.trim() !== '') {
      const r = tryPersistScheduleImageKeyword(manual.trim())
      out = { ...out, imageKeyword: r.ok ? r.value : '' }
    }
    const manual2 = overrides2[day]
    if (manual2 != null && manual2.trim() !== '') {
      const r2 = tryPersistScheduleImageKeyword(manual2.trim())
      out = { ...out, imageKeyword2: r2.ok ? r2.value : null }
    } else if (manual2 != null && manual2.trim() === '' && overrides2[day] !== undefined) {
      out = { ...out, imageKeyword2: null }
    }
    return out
  })
  return { ...parsed, schedule: next }
}

type RegisterPexelsSearchPhoto = {
  id: number
  thumbnail: string
  medium: string
  large: string
  photographer: string
  sourceUrl: string
}

/** 연속 등록 시 이전 미리보기·수동 키워드·Pexels 후보가 섞이지 않도록 한 번에 비운다 */
function emptyManualPexelsByDay(): Record<number, string> {
  return {}
}

function scheduleRowsHaveUniformImageKeyword(
  rows: Array<{ imageKeyword?: string | null }>,
): boolean {
  const kws = rows
    .map((r) => String(r.imageKeyword ?? '').trim().toLowerCase())
    .filter((k) => k.length > 1)
  if (kws.length < 2) return false
  return new Set(kws).size === 1
}

function hanatourPreviewDetailBody(
  parsed: RegisterParsed | null,
  preview: AdminRegisterPreviewPayload | null,
): DetailBodyParseSnapshot | null {
  return (
    (parsed as HanatourScheduleSectionDetailSource | null)?.detailBodyStructured ??
    (preview?.productDraft as HanatourScheduleSectionDetailSource | undefined)?.detailBodyStructured ??
    null
  )
}

function prepareHanatourRegisterPexelsRawRows(
  rows: RegisterScheduleDay[],
  parsed: RegisterParsed | null,
  preview: AdminRegisterPreviewPayload | null,
  supplierKey: AdminRegisterSupplierKey | null,
): RegisterScheduleDay[] {
  if (supplierKey !== 'hanatour') return rows
  return enrichHanatourRegisterPreviewScheduleRowsFromSection(rows, hanatourPreviewDetailBody(parsed, preview))
}

function hanatourPreviewScheduleSectionByDay(
  parsed: RegisterParsed | null,
  preview: AdminRegisterPreviewPayload | null,
  supplierKey: AdminRegisterSupplierKey | null,
): ReadonlyMap<number, string> | null {
  if (supplierKey !== 'hanatour') return null
  return resolveHanatourRegisterScheduleSectionByDay({
    parsed: parsed as HanatourScheduleSectionDetailSource | null,
    previewProductDraft: preview?.productDraft as HanatourScheduleSectionDetailSource | undefined,
  })
}

type HanatourScheduleSectionDetailSource = {
  detailBodyStructured?: DetailBodyParseSnapshot | null
}

/** 미리보기 패널용: 유효한 schedule 행이 없으면 itineraryDayDrafts로 일차별 SSOT 입력 행을 만든다 */
function buildRegisterPexelsUiRows(
  parsed: RegisterParsed | null,
  preview: AdminRegisterPreviewPayload | null,
  supplierKey: AdminRegisterSupplierKey | null,
  travelScope: 'overseas' | 'air_hotel_free',
): RegisterScheduleDay[] {
  const productType =
    preview?.productDraft?.productType ?? parsed?.productType ?? null
  if (!preview) return []

  if (isRegisterAirtelListing(travelScope, productType)) {
    const destHint =
      (parsed?.destination ?? '').trim() ||
      (preview.productDraft?.primaryDestination ?? preview.productDraft?.destinationRaw ?? '').trim() ||
      null
    const airtelRows = buildAirtelRegisterPexelsUiScheduleRows(parsed, destHint)
    if (airtelRows?.length) return airtelRows
  }

  const sched = parsed?.schedule
  const validFromParsed = (sched ?? []).filter((row) => {
    const day = Number(row.day)
    return Number.isFinite(day) && day >= 1
  })
  if (validFromParsed.length > 0) {
    const destHintEarly =
      (parsed?.destination ?? '').trim() ||
      (preview?.productDraft?.primaryDestination ?? preview?.productDraft?.destinationRaw ?? '').trim() ||
      null
    /** REGRESSION-FREEZE[modetour-register-ssot-freeze]: modetour — preview API `ensureModetourRegisterScheduleImageKeywords`(규칙+Gemini) SSOT. 클라이언트 재규칙은 Gemini kw2를 지움. */
    if (
      supplierKey === 'modetour' &&
      validFromParsed.every((row) => String(row.imageKeyword ?? '').trim())
    ) {
      const routeSanitized = sanitizeModetourRegisterScheduleRouteRows(
        validFromParsed.map((row) => {
          const day = Number(row.day)
          return {
            day,
            title: String(row.title ?? ''),
            description: String(row.description ?? ''),
            routeText: String((row as { routeText?: string | null }).routeText ?? '').trim() || null,
            imageKeyword: String(row.imageKeyword ?? '').trim(),
            imageKeyword2: String(row.imageKeyword2 ?? '').trim() || null,
          }
        }),
      )
      return finalizeRegisterScheduleImageKeywords(
        enforceRegisterScheduleTripUniqueImageKeywords(routeSanitized),
        { productDestination: destHintEarly },
      ).map((row) => ({
        day: row.day,
        title: String(row.title ?? ''),
        description: String(row.description ?? ''),
        routeText: row.routeText ?? null,
        imageKeyword: String(row.imageKeyword ?? '').trim(),
        imageKeyword2: String(row.imageKeyword2 ?? '').trim(),
      }))
    }

    const useFitRowsInstead =
      isRegisterAirtelListing(travelScope, productType) &&
      scheduleRowsHaveUniformImageKeyword(validFromParsed)
    if (useFitRowsInstead) {
      const destHint =
        (parsed?.destination ?? '').trim() ||
        (preview.productDraft?.primaryDestination ?? preview.productDraft?.destinationRaw ?? '').trim() ||
        null
      const airtelRows = buildAirtelRegisterPexelsUiScheduleRows(parsed, destHint)
      if (airtelRows?.length) return airtelRows
    }
    const rawRows = prepareHanatourRegisterPexelsRawRows(
      validFromParsed.map((row) => {
      const day = Number(row.day)
      return {
        day,
        title: String(row.title ?? ''),
        description: String(row.description ?? ''),
        routeText: String((row as { routeText?: string | null }).routeText ?? '').trim() || null,
        imageKeyword: String(row.imageKeyword ?? '').trim(),
        imageKeyword2: String(row.imageKeyword2 ?? '').trim() || null,
      }
    }),
      parsed,
      preview,
      supplierKey,
    )
    try {
      const destHint =
        (parsed?.destination ?? '').trim() ||
        (preview?.productDraft?.primaryDestination ?? preview?.productDraft?.destinationRaw ?? '').trim() ||
        null
      const titleHint = (preview?.productDraft?.title ?? parsed?.title ?? '').trim() || null
      const optionalTourNames = parseOptionalTourNamesFromStructuredJson(
        String(parsed?.optionalToursStructured ?? preview.productDraft?.optionalToursStructured ?? ''),
      )
      const scheduleSectionByDay = hanatourPreviewScheduleSectionByDay(parsed, preview, supplierKey)
      const augmented = applyRegisterScheduleImageKeywordsForPreview(rawRows, {
        supplierKey,
        productDestination: destHint,
        productTitle: titleHint,
        travelScope,
        productType,
        optionalTourNames,
        scheduleSectionByDay,
      })
      return finalizeRegisterScheduleImageKeywords(augmented, { productDestination: destHint }).map((row) => ({
        day: row.day,
        title: String(row.title ?? ''),
        description: String(row.description ?? ''),
        routeText: row.routeText ?? null,
        imageKeyword: String(row.imageKeyword ?? '').trim(),
        imageKeyword2: String(row.imageKeyword2 ?? '').trim(),
      }))
    } catch {
      return rawRows.map((row) => ({
        day: row.day,
        title: row.title,
        description: row.description,
        routeText: row.routeText ?? null,
        imageKeyword: row.imageKeyword,
        imageKeyword2: String(row.imageKeyword2 ?? '').trim(),
      }))
    }
  }
  const it = preview.itineraryDayDrafts ?? []
  if (it.length === 0) return []
  const d = preview.productDraft
  const destHint =
    (parsed?.destination ?? '').trim() ||
    (d.primaryDestination ?? d.destinationRaw ?? '').trim() ||
    null
  const draftRows = prepareHanatourRegisterPexelsRawRows(
    it.map((raw) => {
    const day = typeof raw.day === 'number' && raw.day > 0 ? raw.day : 1
    const autoKwRaw =
      buildPexelsKeyword({
        destination: d.primaryDestination ?? d.destinationRaw ?? null,
        primaryRegion: draftPrimaryRegionKr(d),
        themeTags: null,
        title: d.title ?? null,
        poiNamesRaw: raw.poiNamesRaw ?? null,
        scheduleJson: null,
      }) || ''
    const autoKw = tryPersistScheduleImageKeyword(autoKwRaw)
    return {
      day,
      title: (raw.city ?? `Day ${day}`).trim() || `Day ${day}`,
      description: (raw.summaryTextRaw ?? '').slice(0, 400),
      routeText: null as string | null,
      imageKeyword: autoKw.ok ? autoKw.value : '',
      imageKeyword2: null as string | null,
    }
  }),
    parsed,
    preview,
    supplierKey,
  )
  const titleHint = (d.title ?? '').trim() || null
  const optionalTourNames = parseOptionalTourNamesFromStructuredJson(
    String(parsed?.optionalToursStructured ?? preview.productDraft?.optionalToursStructured ?? ''),
  )
  const scheduleSectionByDay = hanatourPreviewScheduleSectionByDay(parsed, preview, supplierKey)
  try {
    const augmented = applyRegisterScheduleImageKeywordsForPreview(draftRows, {
      supplierKey,
      productDestination: destHint,
      productTitle: titleHint,
      travelScope,
      productType,
      optionalTourNames,
      scheduleSectionByDay,
    })
    return finalizeRegisterScheduleImageKeywords(augmented, { productDestination: destHint }).map((row) => ({
      day: row.day,
      title: String(row.title ?? ''),
      description: String(row.description ?? ''),
      routeText: row.routeText ?? null,
      imageKeyword: String(row.imageKeyword ?? '').trim(),
      imageKeyword2: String(row.imageKeyword2 ?? '').trim(),
    }))
  } catch {
    return draftRows.map((row) => ({
      day: row.day,
      title: row.title,
      description: row.description,
      routeText: row.routeText,
      imageKeyword: row.imageKeyword,
      imageKeyword2: '',
    }))
  }
}

/** confirm 시: schedule이 비었거나 비정상이면 UI와 동일한 일정 행으로 채운 뒤 수동 대표관광지 키워드를 반영 */
function mergeRegisterParsedScheduleWithManualPexels(
  parsed: RegisterParsed,
  preview: AdminRegisterPreviewPayload,
  manualByDay: Record<number, string>,
  manualByDay2: Record<number, string> = {},
  travelScope: 'overseas' | 'air_hotel_free' = 'overseas',
): RegisterParsed {
  const uiRows = buildRegisterPexelsUiRows(
    parsed,
    preview,
    coerceRegisterSupplierKey(parsed.originSource ?? null),
    travelScope,
  )
  const validSchedule = (parsed.schedule ?? []).filter((row) => {
    const day = Number(row.day)
    return Number.isFinite(day) && day >= 1
  })
  if (validSchedule.length > 0) {
    const scheduleWithSsot = overlayPreviewScheduleImageKeywords(validSchedule, uiRows)
    const withManual = applyManualPexelsKeywordsToParsedSchedule(
      { ...parsed, schedule: scheduleWithSsot },
      manualByDay,
      manualByDay2,
    )
    return {
      ...withManual,
      schedule: finalizeRegisterScheduleImageKeywords(withManual.schedule ?? [], scheduleKeywordOpts(parsed, preview)),
    }
  }
  if (uiRows.length === 0) {
    const withManual = applyManualPexelsKeywordsToParsedSchedule(parsed, manualByDay, manualByDay2)
    return {
      ...withManual,
      schedule: finalizeRegisterScheduleImageKeywords(withManual.schedule ?? [], scheduleKeywordOpts(parsed, preview)),
    }
  }
  const withManual: RegisterScheduleDay[] = uiRows.map((row) => {
    let next: RegisterScheduleDay = { ...row }
    const manual = manualByDay[row.day]?.trim()
    if (manual) {
      const r = tryPersistScheduleImageKeyword(manual)
      next = { ...next, imageKeyword: r.ok ? r.value : '' }
    }
    const manual2 = manualByDay2[row.day]
    if (manual2 != null && manual2.trim() !== '') {
      const r2 = tryPersistScheduleImageKeyword(manual2.trim())
      next = { ...next, imageKeyword2: r2.ok ? r2.value : null }
    } else if (manual2 !== undefined && manual2.trim() === '') {
      next = { ...next, imageKeyword2: null }
    }
    return next
  })
  return { ...parsed, schedule: finalizeRegisterScheduleImageKeywords(withManual, scheduleKeywordOpts(parsed, preview)) }
}

function scheduleKeywordOpts(
  parsed: RegisterParsed,
  preview: AdminRegisterPreviewPayload,
): { productDestination: string | null } {
  const d =
    (parsed.destination ?? '').trim() ||
    (preview.productDraft?.primaryDestination ?? preview.productDraft?.destinationRaw ?? '').trim() ||
    ''
  return { productDestination: d || null }
}

function effectiveShoppingVisitCount(
  draft: { shoppingVisitCount?: number | null },
  overlay: RegisterCorrectionOverlayV1 | null
): number | null {
  const s = overlay?.fields?.shopping
  if (s?.visitCount && (s.visitCount.reviewState === 'manually_edited' || s.visitCount.reviewState === 'approved')) {
    return s.visitCount.final
  }
  if (s && (s.reviewState === 'manually_edited' || s.reviewState === 'approved')) {
    return s.finalVisitCount ?? null
  }
  return draft.shoppingVisitCount ?? null
}

function effectiveShoppingTableRowCount(
  draft: { shoppingStopsCount?: number | null },
  overlay: RegisterCorrectionOverlayV1 | null
): number | null {
  const s = overlay?.fields?.shopping
  if (s?.places && (s.places.reviewState === 'manually_edited' || s.places.reviewState === 'approved')) {
    return s.places.rows.length
  }
  if (s && (s.reviewState === 'manually_edited' || s.reviewState === 'approved') && s.finalShoppingPlacesJson) {
    try {
      const a = JSON.parse(s.finalShoppingPlacesJson) as unknown
      return Array.isArray(a) ? a.length : null
    } catch {
      return draft.shoppingStopsCount ?? null
    }
  }
  return draft.shoppingStopsCount ?? null
}

/**
 * 미리보기·확정 POST URL — 메뉴에서 고른 `AdminRegisterSupplierKey`만 매핑 (다른 값·generic 없음).
 */
function parseRegisterApiPath(brandKey: AdminRegisterSupplierKey): string {
  switch (brandKey) {
    case 'modetour':
      return '/api/travel/parse-and-register-modetour'
    case 'verygoodtour':
      return '/api/travel/parse-and-register-verygoodtour'
    case 'ybtour':
      return '/api/travel/parse-and-register-ybtour'
    case 'hanatour':
      return '/api/travel/parse-and-register-hanatour'
    case 'kyowontour':
      return '/api/travel/parse-and-register-kyowontour'
    case 'lottetour':
      return '/api/travel/parse-and-register-lottetour'
    case 'naeiltour':
      return '/api/travel/parse-and-register-naeiltour'
    default: {
      const _e: never = brandKey
      throw new Error(`Unexpected register supplier: ${_e}`)
    }
  }
}

/**
 * 관리자 상품 등록 전용 공급사 선택 — DB Brand 테이블과 무관한 고정 목록.
 * 선택값이 `parseRegisterApiPath`·요청 `brandKey`·`originSource`(canonical 키와 동일)로 그대로 이어진다 (yellowballoon 없음).
 */
const REGISTER_SUPPLIER_OPTIONS: Brand[] = [
  { id: '', brandKey: 'modetour', displayName: '모두투어', sortOrder: 1 },
  { id: '', brandKey: 'verygoodtour', displayName: '참좋은여행', sortOrder: 2 },
  { id: '', brandKey: 'ybtour', displayName: '노랑풍선', sortOrder: 3 },
  { id: '', brandKey: 'hanatour', displayName: '하나투어', sortOrder: 4 },
  { id: '', brandKey: 'kyowontour', displayName: '교원이지', sortOrder: 5 },
  { id: '', brandKey: 'lottetour', displayName: '롯데관광', sortOrder: 6 },
  { id: '', brandKey: 'naeiltour', displayName: '내일투어', sortOrder: 7 },
]

{
  const uiKeys = new Set(REGISTER_SUPPLIER_OPTIONS.map((b) => b.brandKey))
  for (const k of CANONICAL_OVERSEAS_SUPPLIER_KEYS) {
    if (!uiKeys.has(k)) {
      throw new Error(`REGISTER_SUPPLIER_OPTIONS must include every canonical supplier key (missing: ${k})`)
    }
  }
  for (const b of REGISTER_SUPPLIER_OPTIONS) {
    if (!(CANONICAL_OVERSEAS_SUPPLIER_KEYS as readonly string[]).includes(b.brandKey)) {
      throw new Error(`REGISTER_SUPPLIER_OPTIONS has non-canonical brandKey: ${b.brandKey}`)
    }
  }
}

function coerceRegisterSupplierKey(key: string | null | undefined): AdminRegisterSupplierKey {
  const k = (key ?? '').trim()
  if ((CANONICAL_OVERSEAS_SUPPLIER_KEYS as readonly string[]).includes(k)) return k as AdminRegisterSupplierKey
  return REGISTER_SUPPLIER_OPTIONS[0]!.brandKey
}

function registerSupplierDisplayName(brandKey: string | null | undefined): string {
  const k = coerceRegisterSupplierKey(brandKey ?? '')
  return REGISTER_SUPPLIER_OPTIONS.find((b) => b.brandKey === k)?.displayName ?? k
}

/** URL 호스트가 알려진 공급사면 canonical key — 현재 선택과 다를 때만 반환 */
function inferRegisterSupplierSwitchFromOriginUrl(
  originUrl: string,
  currentBrandKey: AdminRegisterSupplierKey,
): AdminRegisterSupplierKey | null {
  const inferred = inferCanonicalSupplierFromOriginUrl(originUrl)
  if (!inferred || inferred === currentBrandKey) return null
  return inferred
}

export default function AdminRegisterPage() {
  /** 관리자 상품 상위 유형: 해외 패키지 / 국내 패키지 / 항공권+호텔(자유여행) — API 필드명은 기존 `travelScope` 유지 */
  const [travelScope, setTravelScope] = useState<'overseas' | 'air_hotel_free'>('overseas')
  /** 지방 출발 메가 메뉴·browse용 — LLM 비사용, 확정 시 DB `Product.localDepartureTag`만 반영 */
  const [localDepartureTag, setLocalDepartureTag] = useState<LocalDepartureTag[]>([])
  /** register-facts·confirm SSOT — 인천/김포= null 표시 */
  const [inferredDepartureAirportLabel, setInferredDepartureAirportLabel] =
    useState<HomeDepartureAirportLabel | null>(null)
  /** 스포츠 테마 메가 메뉴·browse용 — LLM 비사용, 확정 시 DB `Product.sportsThemeTag`만 반영 */
  const [sportsThemeTag, setSportsThemeTag] = useState<SportsThemeTag[]>([])
  /** 단일 출발(F1·이벤트 등) — LLM 비사용, 확정 시 DB `Product.singleDepartureOnly`만 반영 */
  const [singleDepartureOnly, setSingleDepartureOnly] = useState(false)
  /** 기본(Plan B): 원문 기반 노출명. 체크 시에만 R-5 마케팅 제안명을 Product.title로 저장 */
  const [useBongtourMarketingTitle, setUseBongtourMarketingTitle] = useState(false)
  const [rawText, setRawText] = useState('')
  const [originUrl, setOriginUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [statusText, setStatusText] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [savedProductId, setSavedProductId] = useState<string | null>(null)
  const [preview, setPreview] = useState<AdminRegisterPreviewPayload | null>(null)
  const [parsedForConfirm, setParsedForConfirm] = useState<unknown>(null)
  const [confirming, setConfirming] = useState(false)
  const [selectedBrandKey, setSelectedBrandKey] = useState<AdminRegisterSupplierKey>(
    () => REGISTER_SUPPLIER_OPTIONS[0]!.brandKey as AdminRegisterSupplierKey
  )
  const supplierFrameSpec = useMemo(
    () => getSupplierInputFrameSpec(selectedBrandKey, travelScope),
    [selectedBrandKey, travelScope]
  )
  const pastePh = useMemo(
    () => getRegisterPastePlaceholders(selectedBrandKey, travelScope),
    [selectedBrandKey, travelScope]
  )
  const singleDepartureCheckboxDisabled = useMemo(
    () => isSingleDepartureAdminCheckboxDisabled({ travelScope }),
    [travelScope],
  )
  /** 일차별 Pexels 키워드 — confirm 시 `schedule[].imageKeyword` / `imageKeyword2` */
  const [manualPexelsKeywordsByDay, setManualPexelsKeywordsByDay] = useState<Record<number, string>>({})
  const [manualPexelsKeywords2ByDay, setManualPexelsKeywords2ByDay] = useState<Record<number, string>>({})
  const [registerPexelsPhotos, setRegisterPexelsPhotos] = useState<RegisterPexelsSearchPhoto[]>([])
  const [registerPexelsLoading, setRegisterPexelsLoading] = useState(false)
  const [registerPexelsError, setRegisterPexelsError] = useState<string | null>(null)
  const [registerPexelsLastQuery, setRegisterPexelsLastQuery] = useState<string | null>(null)
  /** schedule/itinerary가 없을 때 단일 검색창용 */
  const [registerPexelsFallbackKeyword, setRegisterPexelsFallbackKeyword] = useState('')
  const [registerFactBundle, setRegisterFactBundle] = useState<SupplierRegisterFactBundle | null>(null)
  const [registerFactFetchLoading, setRegisterFactFetchLoading] = useState(false)
  const [registerFactFetchError, setRegisterFactFetchError] = useState<string | null>(null)

  const registerFactFetchEnabled = useMemo(
    () => REGISTER_FACT_FETCH_SUPPLIERS.has(selectedBrandKey) && originUrl.trim().length > 0,
    [selectedBrandKey, originUrl],
  )

  const registerPexelsUiRows = useMemo(
    () =>
      buildRegisterPexelsUiRows(
        (parsedForConfirm as RegisterParsed | null) ?? null,
        preview,
        selectedBrandKey,
        travelScope,
      ),
    [parsedForConfirm, preview, selectedBrandKey, travelScope],
  )

  const resetRegisterPreviewSession = useCallback(
    (opts?: { clearPreview?: boolean; clearCorrection?: boolean; resetOriginCodeRef?: boolean }) => {
      const clearPreview = opts?.clearPreview !== false
      const clearCorrection = opts?.clearCorrection !== false
      if (clearPreview) {
        setPreview(null)
        setParsedForConfirm(null)
        previewContentFingerprintRef.current = null
        previewStructuredFingerprintRef.current = null
        setConfirmVerification(null)
        setLastAdminTracePath(null)
      }
      if (clearCorrection) {
        setCorrectionOverlay(null)
        setCorrectionDrawerOpen(false)
        setCorrectionTargetKey(null)
        setCorrectionHintDetail(null)
      }
      if (opts?.resetOriginCodeRef) {
        lastPreviewOriginCodeRef.current = null
      }
      setManualPexelsKeywordsByDay(emptyManualPexelsByDay())
      setManualPexelsKeywords2ByDay(emptyManualPexelsByDay())
      setRegisterPexelsPhotos([])
      setRegisterPexelsError(null)
      setRegisterPexelsLastQuery(null)
      setRegisterPexelsLoading(false)
      setRegisterPexelsFallbackKeyword('')
    },
    [],
  )

  const runRegisterPexelsSearch = useCallback(async (keywordRaw: string) => {
    const keyword = keywordRaw.trim()
    console.log('[admin-register] Pexels 미리보기', { keyword })
    if (!keyword) {
      setRegisterPexelsError('관광지 키워드를 입력해 주세요. (저장값·미리보기 공통)')
      setRegisterPexelsPhotos([])
      setRegisterPexelsLastQuery(null)
      return
    }
    setRegisterPexelsLoading(true)
    setRegisterPexelsError(null)
    setRegisterPexelsPhotos([])
    setRegisterPexelsLastQuery(keyword)
    try {
      const res = await fetch(`/api/admin/pexels/search?q=${encodeURIComponent(keyword)}`, {
        credentials: 'include',
      })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        error?: string
        photos?: RegisterPexelsSearchPhoto[]
      }
      console.log('[admin-register] Pexels 응답', {
        httpOk: res.ok,
        ok: data.ok,
        count: Array.isArray(data.photos) ? data.photos.length : 0,
      })
      if (!res.ok) {
        setRegisterPexelsError(data?.error ?? `요청 실패 (HTTP ${res.status})`)
        setRegisterPexelsPhotos([])
        return
      }
      if (data.ok === true && Array.isArray(data.photos)) {
        setRegisterPexelsPhotos(data.photos)
        if (data.photos.length === 0) {
          setRegisterPexelsError('후보 사진이 없습니다. 다른 표현으로 시도해 보세요. (Pexels 미리보기)')
        }
      } else {
        setRegisterPexelsError(data?.error ?? '응답 형식이 올바르지 않습니다.')
        setRegisterPexelsPhotos([])
      }
    } catch (e) {
      console.error('[admin-register] Pexels 네트워크 오류', e)
      setRegisterPexelsError(e instanceof Error ? e.message : '네트워크 오류')
      setRegisterPexelsPhotos([])
    } finally {
      setRegisterPexelsLoading(false)
    }
  }, [])

  useEffect(() => {
    const token = preview?.previewToken
    const d = preview?.productDraft
    if (!token || !d) return
    const k = buildPexelsKeyword({
      destination: d.primaryDestination ?? d.destinationRaw ?? null,
      primaryRegion: draftPrimaryRegionKr(d),
      themeTags: null,
      title: d.title ?? null,
      poiNamesRaw: null,
      scheduleJson: null,
    })
    setRegisterPexelsFallbackKeyword(k)
    setRegisterPexelsPhotos([])
    setRegisterPexelsError(null)
    setRegisterPexelsLastQuery(null)
  }, [preview?.previewToken])

  /** 자동 추출과 별도: 재분석 시 originCode가 바뀌면 초기화 */
  const [correctionOverlay, setCorrectionOverlay] = useState<RegisterCorrectionOverlayV1 | null>(null)
  const lastPreviewOriginCodeRef = useRef<string | null>(null)
  /** 미리보기 직후 입력 스냅샷 — 본문·URL 변경 시 confirm 차단 */
  const previewContentFingerprintRef = useRef<string | null>(null)
  /** 실검증: 미리보기 structuredFingerprint — confirm 패널과 비교 */
  const previewStructuredFingerprintRef = useRef<string | null>(null)
  const [correctionDrawerOpen, setCorrectionDrawerOpen] = useState(false)
  const [correctionTargetKey, setCorrectionTargetKey] = useState<RegisterCorrectionFieldKey | null>(null)
  const [correctionHintDetail, setCorrectionHintDetail] = useState<RegisterCorrectionIssueHintDetailV1 | null>(null)
  const [confirmVerification, setConfirmVerification] = useState<RegisterVerificationV1 | null>(null)
  const [lastAdminTracePath, setLastAdminTracePath] = useState<string | null>(null)

  const [duplicateCheckLoading, setDuplicateCheckLoading] = useState(false)
  const [duplicateResult, setDuplicateResult] = useState<{
    exists: boolean
    matches: { id: string; title: string; originSource: string; registrationStatus: string | null }[]
  } | null>(null)
  /** 마지막으로 중복 검사한 URL(정규화). 현재 originUrl 정규화 값과 다르면 저장 직전 재검사 대상. */
  const [lastCheckedOriginUrl, setLastCheckedOriginUrl] = useState('')
  /** URL 비교용 정규화: trim + 끝 슬래시 제거 (API와 동일). 비문자·이상 값도 trim에서 안 터지게 처리. */
  const normalizeUrl = (u: unknown): string => {
    try {
      const s = typeof u === 'string' ? u : String(u ?? '')
      return s.trim().replace(/\/+$/, '')
    } catch {
      return ''
    }
  }
  const toggleLocalDepartureTag = useCallback((tag: LocalDepartureTag) => {
    setLocalDepartureTag((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    )
  }, [])
  const currentRegisterPreviewFingerprint = () =>
    buildRegisterCanonForSupplier(selectedBrandKey, {
      text: rawText.trim(),
      brandKey: selectedBrandKey || null,
      originUrl: normalizeUrl(originUrl) || null,
      travelScope,
      pastedBlocks: null,
    })
  /** onBlur에 실수로 이벤트가 넘어와도 현재 입력값으로 검사 */
  const coerceUrlInput = (urlOverride: unknown, currentField: unknown): string => {
    if (typeof urlOverride === 'string') return urlOverride
    const base = typeof currentField === 'string' ? currentField : String(currentField ?? '')
    return base
  }

  /**
   * originUrl 중복 검사(등록·대기·보류 등). 반려(rejected) 행은 재등록 갱신 대상이라 경고 제외. 실패해도 등록을 막지 않음.
   * @param urlOverride - 제출 직전 재검사 시 현재 URL 문자열만 전달. onBlur는 래핑해 호출 (이벤트 객체 금지).
   */
  async function checkOriginUrlDuplicate(urlOverride?: unknown) {
    const raw = coerceUrlInput(urlOverride, originUrl)
    const url = (typeof raw === 'string' ? raw : String(raw ?? '')).trim()
    const normalized = normalizeUrl(url)
    if (!normalized || !/^https?:\/\//i.test(normalized)) {
      setDuplicateResult(null)
      setLastCheckedOriginUrl('')
      return
    }
    setDuplicateCheckLoading(true)
    setDuplicateResult(null)
    try {
      const res = await fetch(
        `/api/admin/products/check-origin-url?originUrl=${encodeURIComponent(normalized)}`
      )
      const data = await res.json()
      if (res.ok && data?.ok) {
        setDuplicateResult({
          exists: !!data.exists,
          matches: Array.isArray(data.matches) ? data.matches : [],
        })
        setLastCheckedOriginUrl(normalized)
      } else {
        setDuplicateResult(null)
        setLastCheckedOriginUrl('')
      }
    } catch {
      setDuplicateResult(null)
      setLastCheckedOriginUrl('')
    } finally {
      setDuplicateCheckLoading(false)
    }
  }

  async function applyRegisterFactBundle(bundle: SupplierRegisterFactBundle) {
    setRegisterFactBundle(bundle)
    setRawText(registerFactBundleToPasteText(bundle))
    const airportMeta = inferDepartureAirportFromRegisterFactFlights(bundle.flights)
    setInferredDepartureAirportLabel(airportMeta.airportLabel)
    if (airportMeta.localDepartureTags.length > 0) {
      setLocalDepartureTag(airportMeta.localDepartureTags)
    }
    resetRegisterPreviewSession({ clearPreview: true, clearCorrection: true, resetOriginCodeRef: false })
    setSavedProductId(null)
    setError('')
  }

  async function fetchRegisterFacts() {
    const normalized = normalizeUrl(originUrl)
    if (!normalized || !REGISTER_FACT_FETCH_SUPPLIERS.has(selectedBrandKey)) return
    setRegisterFactFetchLoading(true)
    setRegisterFactFetchError(null)
    setRegisterFactBundle(null)
    setInferredDepartureAirportLabel(null)
    try {
      const res = await fetch('/api/admin/register/fetch-facts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originUrl: normalized,
          brandKey: selectedBrandKey,
        }),
      })
      const data = (await res.json()) as {
        ok?: boolean
        error?: string
        bundle?: SupplierRegisterFactBundle
      }
      if (!res.ok || !data.ok || !data.bundle) {
        setRegisterFactFetchError(data.error ?? '사실 가져오기에 실패했습니다.')
        return
      }
      await applyRegisterFactBundle(data.bundle)
      setStatusText(
        `${formatRegisterFactBundleSummary(data.bundle)} — 아래 [봉투어 형식으로 변환]을 누르면 미리보기·저장까지 진행할 수 있습니다.`,
      )
    } catch {
      setRegisterFactFetchError('사실 가져오기 요청 중 오류가 발생했습니다.')
    } finally {
      setRegisterFactFetchLoading(false)
    }
  }

  function resolveRegisterPasteText(): string {
    const trimmed = rawText.trim()
    if (trimmed) return trimmed
    if (registerFactBundle) return registerFactBundleToPasteText(registerFactBundle)
    return ''
  }

  async function handleSubmit() {
    const urlToCheck = normalizeUrl(originUrl)
    /** 전용 등록 API·route guard SSOT — `normalizeSupplierOrigin` 기대 키와 동일한 문자열 */
    const originSource = selectedBrandKey
    const pasteText = resolveRegisterPasteText()
    if (!pasteText) {
      setError('상품 URL로 [사실 가져오기]를 먼저 실행하거나, 공급사 상세 본문을 붙여넣어 주세요.')
      return
    }
    setError('')
    setSavedProductId(null)
    resetRegisterPreviewSession({ clearCorrection: true, resetOriginCodeRef: false })
    setStatusText(null)

    // 저장 직전: URL이 유효하고, 아직 검사 안 했거나 URL이 바뀐 경우 1회 재검사. 실패해도 등록은 진행.
    const urlValid = urlToCheck && /^https?:\/\//i.test(urlToCheck)
    const needRecheck = urlValid && (duplicateResult === null || urlToCheck !== lastCheckedOriginUrl)
    setLoading(true)
    try {
      if (needRecheck) {
        setStatusText('URL 중복 확인 중…')
        await checkOriginUrlDuplicate(urlToCheck)
      }

      setStatusText(LOADING_STATUS)
      const controller = new AbortController()
      const ttl = setTimeout(() => controller.abort(), REGISTER_PREVIEW_FETCH_TIMEOUT_MS)
      let res: Response
      try {
        const trimmedBody = pasteText
        res = await fetch(parseRegisterApiPath(selectedBrandKey), {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(
            selectedBrandKey === 'kyowontour'
              ? {
                  mode: 'preview',
                  bodyText: trimmedBody,
                  originSource,
                  travelScope,
                  localDepartureTag: LOCAL_DEPARTURE_TAG_VALUES.filter((k) => localDepartureTag.includes(k)),
                  sportsThemeTag: SPORTS_THEME_TAG_VALUES.filter((k) => sportsThemeTag.includes(k)),
                  singleDepartureOnly,
                  ...(selectedBrandKey && { brandKey: selectedBrandKey }),
                  ...(urlToCheck && { originUrl: urlToCheck }),
                }
              : {
                  mode: 'preview',
                  text: trimmedBody,
                  originSource,
                  ...(selectedBrandKey && { brandKey: selectedBrandKey }),
                  ...(urlToCheck && { originUrl: urlToCheck }),
                  travelScope,
                  localDepartureTag: LOCAL_DEPARTURE_TAG_VALUES.filter((k) => localDepartureTag.includes(k)),
                  sportsThemeTag: SPORTS_THEME_TAG_VALUES.filter((k) => sportsThemeTag.includes(k)),
                  singleDepartureOnly,
                }
          ),
          signal: controller.signal,
        })
      } finally {
        clearTimeout(ttl)
      }

      const rawBody = await res.text()
      let data: unknown
      try {
        data = rawBody.trim() ? JSON.parse(rawBody) : {}
      } catch {
        throw new Error(`서버 응답을 읽을 수 없습니다 (HTTP ${res.status}). 프록시·게이트웨이 타임아웃이면 서버 로그를 확인하세요.`)
      }
      const errMsg =
        data && typeof data === 'object' && 'error' in data && typeof (data as { error?: unknown }).error === 'string'
          ? (data as { error: string }).error
          : null
      if (!res.ok) throw new Error(errMsg ?? '등록 실패')

      if (selectedBrandKey === 'lottetour') {
        const chk = data as { success?: unknown; mode?: unknown; error?: unknown }
        if (chk.success !== true || chk.mode !== 'preview') {
          throw new Error(
            typeof chk.error === 'string' ? chk.error : '롯데관광 분석 응답이 올바르지 않습니다. 미리보기를 다시 실행하세요.'
          )
        }
      }

      if (selectedBrandKey === 'kyowontour') {
        const kres = data as RegisterPreviewPayloadKw & {
          success?: boolean
          mode?: string
          data?: KyowontourFinalParsed | null
          error?: string
        }
        if (!kres.success || kres.mode !== 'preview') {
          throw new Error(typeof kres.error === 'string' ? kres.error : '교원이지 분석 응답이 올바르지 않습니다.')
        }
        setPreview(kres as AdminRegisterPreviewPayload)
        setUseBongtourMarketingTitle(false)
        setParsedForConfirm(kres.parsed ?? null)
        setConfirmVerification(null)
        setLastAdminTracePath(null)
        previewContentFingerprintRef.current = currentRegisterPreviewFingerprint()
        previewStructuredFingerprintRef.current = kres.registerVerification?.structuredFingerprint ?? null
        resetRegisterPreviewSession({ clearPreview: false, clearCorrection: true })
        const oc = kres.parsed && typeof kres.parsed === 'object' && 'originCode' in kres.parsed
          ? String((kres.parsed as RegisterParsedKw).originCode ?? '')
          : null
        if (lastPreviewOriginCodeRef.current != null && oc && lastPreviewOriginCodeRef.current !== oc) {
          setCorrectionOverlay(null)
        }
        if (oc) lastPreviewOriginCodeRef.current = oc
        setStatusText('분석 완료 · 등록 전 미리보기를 확인하세요')
        setLoading(false)
        return
      }

      setStatusText('분석 완료 · 등록 전 미리보기를 확인하세요')
      const pdata = data as AdminRegisterPreviewPayload
      const oc =
        pdata.parsed && typeof pdata.parsed === 'object' && 'originCode' in pdata.parsed
          ? String((pdata.parsed as RegisterParsed).originCode ?? '')
          : null
      if (lastPreviewOriginCodeRef.current != null && oc && lastPreviewOriginCodeRef.current !== oc) {
        setCorrectionOverlay(null)
      }
      if (oc) lastPreviewOriginCodeRef.current = oc
      previewContentFingerprintRef.current = currentRegisterPreviewFingerprint()
      previewStructuredFingerprintRef.current = pdata.registerVerification?.structuredFingerprint ?? null
      setPreview(pdata)
      setUseBongtourMarketingTitle(false)
      setParsedForConfirm(pdata.parsed ?? null)
      setConfirmVerification(null)
      setLastAdminTracePath(null)
      resetRegisterPreviewSession({
        clearPreview: false,
        clearCorrection: selectedBrandKey === 'lottetour',
      })
    } catch (e) {
      if (isAbortError(e)) {
        setError(
          `분석 요청이 ${Math.round(REGISTER_PREVIEW_FETCH_TIMEOUT_MS / 60000)}분 안에 끝나지 않아 중단했습니다. 본문을 줄이거나 잠시 후 다시 시도하세요.`
        )
      } else {
        setError(e instanceof Error ? e.message : '등록 실패')
      }
      setStatusText(null)
    } finally {
      setLoading(false)
    }
  }

  async function handleConfirmRegister() {
    if (!preview || !parsedForConfirm) return
    if (!preview.previewToken) {
      setError('미리보기 토큰이 없습니다. 미리보기를 다시 실행한 뒤 저장하세요.')
      return
    }
    if (!preview.previewContentDigest?.trim()) {
      setError('미리보기 콘텐츠 지문이 없습니다. [봉투어 형식으로 변환]을 다시 실행한 뒤 저장하세요.')
      return
    }
    if (
      previewContentFingerprintRef.current != null &&
      currentRegisterPreviewFingerprint() !== previewContentFingerprintRef.current
    ) {
      setError('미리보기 이후 본문·여행사·URL·카테고리가 변경되었습니다. [봉투어 형식으로 변환]을 다시 실행한 뒤 저장하세요.')
      return
    }
    setConfirming(true)
    setError('')
    try {
      const parsedMerged = applyRegisterCorrectionOverlayForSupplier(
        selectedBrandKey,
        mergeRegisterParsedScheduleWithManualPexels(
          parsedForConfirm as RegisterParsed,
          preview,
          manualPexelsKeywordsByDay,
          manualPexelsKeywords2ByDay,
          travelScope,
        ),
        correctionOverlay
      )
      const geo = inferBrowseGeoFromDestinationText({
        primaryDestination: parsedMerged.primaryDestination,
        destinationRaw: parsedMerged.destinationRaw,
        title: parsedMerged.title,
      })
      let parsedForApi: RegisterParsed = parsedMerged
      if (geo != null) {
        parsedForApi = Object.assign({}, parsedMerged, {
          primaryRegion: CONTINENT_ID_TO_PRIMARY_REGION_KR[geo.continent] ?? null,
          continent: geo.continent,
          country: geo.country,
          city: geo.city,
        }) as unknown as RegisterParsed
      }
      const originSource = selectedBrandKey
      const urlToCheck = normalizeUrl(originUrl)
      const confirmPasteText = resolveRegisterPasteText()
      const confirmPrimaryText = confirmPasteText
      const snap = preview as AdminRegisterPreviewPayload & {
        registerSnapshotId?: string | null
        registerAnalysisId?: string | null
      }
      const controller = new AbortController()
      const ttl = setTimeout(() => controller.abort(), REGISTER_CONFIRM_FETCH_TIMEOUT_MS)
      let res: Response
      try {
        res = await fetch(parseRegisterApiPath(selectedBrandKey), {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mode: 'confirm',
            previewToken: preview.previewToken,
            text: confirmPrimaryText,
            ...(selectedBrandKey === 'kyowontour' && { bodyText: confirmPrimaryText }),
            parsed: parsedForApi,
            originSource,
            ...(selectedBrandKey && { brandKey: selectedBrandKey }),
            ...(urlToCheck && { originUrl: urlToCheck }),
            travelScope,
            ...(correctionOverlay && { correctionOverlay }),
            previewContentDigest: preview.previewContentDigest,
            localDepartureTag: LOCAL_DEPARTURE_TAG_VALUES.filter((k) => localDepartureTag.includes(k)),
            sportsThemeTag: SPORTS_THEME_TAG_VALUES.filter((k) => sportsThemeTag.includes(k)),
            singleDepartureOnly,
            ...(registerFactBundle?.flights?.length
              ? { registerFactFlights: registerFactBundle.flights }
              : {}),
            ...(typeof snap.registerSnapshotId === 'string' &&
              snap.registerSnapshotId.trim() && { registerSnapshotId: snap.registerSnapshotId.trim() }),
            ...(typeof snap.registerAnalysisId === 'string' &&
              snap.registerAnalysisId.trim() && { registerAnalysisId: snap.registerAnalysisId.trim() }),
            ...(useBongtourMarketingTitle &&
              typeof preview.bongtourProductTitle === 'string' &&
              preview.bongtourProductTitle.trim() && {
                productTitleSaveMode: 'bongtour_marketing' as const,
                bongtourProductTitle: preview.bongtourProductTitle.trim(),
              }),
          }),
          signal: controller.signal,
        })
      } finally {
        clearTimeout(ttl)
      }
      const rawBody = await res.text()
      let data: { error?: string; productId?: string | null; registerVerification?: RegisterVerificationV1; adminTracePath?: string }
      try {
        data = rawBody.trim() ? (JSON.parse(rawBody) as typeof data) : {}
      } catch {
        throw new Error(`서버 응답을 읽을 수 없습니다 (HTTP ${res.status}).`)
      }
      if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : '최종 등록 실패')
      setSavedProductId(data.productId ?? null)
      setConfirmVerification(data.registerVerification ?? null)
      setLastAdminTracePath(typeof data.adminTracePath === 'string' ? data.adminTracePath : null)
      setStatusText('3축(Product/ProductDeparture/ItineraryDay) 저장 완료. 등록대기에서 최종 승인해 주세요.')
      /** 다음 상품 등록 시 이전 미리보기·수동 키워드·Pexels 후보가 섞이지 않도록 초기화 */
      resetRegisterPreviewSession({ clearPreview: true, clearCorrection: true, resetOriginCodeRef: true })
    } catch (e) {
      if (e instanceof ScheduleImageKeywordPersistError) {
        setError(formatImageKeywordError(e))
      } else if (isAbortError(e)) {
        setError(
          `저장 요청이 ${Math.round(REGISTER_CONFIRM_FETCH_TIMEOUT_MS / 60000)}분 안에 끝나지 않아 중단했습니다. 네트워크·서버 상태를 확인한 뒤 다시 시도하세요.`
        )
      } else {
        setError(e instanceof Error ? e.message : '최종 등록 실패')
      }
    } finally {
      setConfirming(false)
    }
  }

  function findHintDetail(field: string): RegisterCorrectionIssueHintDetailV1 | null {
    const list = preview?.correctionPreview?.issueHintDetails
    if (!list?.length) return null
    return list.find((d) => d.field === field) ?? null
  }

  function openCorrectionForIssueField(field: string) {
    if (!preview) return
    setCorrectionTargetKey(inferCorrectionKeyFromIssueField(field))
    setCorrectionHintDetail(findHintDetail(field))
    setCorrectionDrawerOpen(true)
  }

  function commitShoppingCorrection(next: RegisterCorrectionShoppingFieldV1) {
    setCorrectionOverlay({
      version: '1',
      fields: {
        ...(correctionOverlay?.fields ?? {}),
        shopping: next,
      },
    })
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-4xl px-6 py-8">
        <AdminPageHeader title="상품 등록" />

        <div className="mt-6 rounded-lg border border-slate-200 bg-white px-4 py-3">
          <p className="text-sm font-bold text-slate-900">A. 기본 원문 입력</p>
          <p className="mt-1 text-xs text-slate-600">
            기본정보와 본문 원문을 입력합니다. <strong>본문 전체 원문은 자동 추출 기준 입력</strong>입니다.
          </p>
        </div>

        {/* A-1. 여행사 · 상품 카테고리 (여행사 우선) */}
        <div className="mt-6 grid gap-4 border-l-4 border-[#0f172a] pl-6 sm:grid-cols-2">
          <div>
            <label htmlFor="admin-register-brand" className="block text-sm font-semibold text-slate-800">
              여행사
            </label>
            <p className="mt-1 text-xs text-slate-500">
              공급사 URL을 붙여넣으면 여행사가 자동 선택됩니다. 수동 변경도 가능합니다.
            </p>
            <select
              id="admin-register-brand"
              name="brandKey"
              value={selectedBrandKey}
              onChange={(e) => {
                const next = coerceRegisterSupplierKey(e.target.value)
                if (next === selectedBrandKey) return
                setSelectedBrandKey(next)
                resetRegisterPreviewSession({
                  clearPreview: true,
                  clearCorrection: true,
                  resetOriginCodeRef: true,
                })
                setSavedProductId(null)
                setError('')
                setDuplicateResult(null)
                setLastCheckedOriginUrl('')
                setStatusText('여행사가 변경되어 이전 미리보기·검수 교정 내용을 초기화했습니다. [봉투어 형식으로 변환]으로 다시 분석하세요.')
              }}
              className="mt-2 w-full border border-slate-300 bg-white px-3 py-2 text-sm text-[#0f172a] focus:border-[#0f172a] focus:outline-none focus:ring-1 focus:ring-[#0f172a]"
              disabled={loading}
            >
              {REGISTER_SUPPLIER_OPTIONS.map((b) => (
                <option key={b.brandKey} value={b.brandKey}>
                  {b.displayName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="admin-register-scope" className="block text-sm font-semibold text-slate-800">
              상품 유형
            </label>
            <p className="mt-1 text-xs text-slate-500">
              해외 패키지형 여행상품과 항공권+호텔(자유여행) 유형 중 선택합니다. 등록 시 필수입니다.
            </p>
            <select
              id="admin-register-scope"
              value={travelScope}
              onChange={(e) => {
                const next = e.target.value as 'overseas' | 'air_hotel_free'
                if (next === travelScope) return
                setTravelScope(next)
                resetRegisterPreviewSession({
                  clearPreview: true,
                  clearCorrection: true,
                  resetOriginCodeRef: true,
                })
                setSavedProductId(null)
                setError('')
                setDuplicateResult(null)
                setLastCheckedOriginUrl('')
                setStatusText(
                  '상품 유형이 변경되어 이전 미리보기·키워드 입력을 초기화했습니다. [봉투어 형식으로 변환]으로 다시 분석하세요.',
                )
              }}
              className="mt-2 w-full border border-slate-300 bg-white px-3 py-2 text-sm text-[#0f172a] focus:border-[#0f172a] focus:outline-none focus:ring-1 focus:ring-[#0f172a]"
              disabled={loading}
              required
            >
              <option value="overseas">해외여행</option>
              <option value="air_hotel_free">항공권+호텔(자유여행)</option>
            </select>
          </div>
        </div>

        {/* B. 상품 URL (출처·reference + API 사실 수집) */}
        <div className="mt-6 border-l-4 border-[#0f172a] pl-6">
          <label htmlFor="admin-register-origin-url" className="block text-sm font-semibold text-slate-800">
            상품 URL
          </label>
          <p className="mt-1 text-xs text-slate-500">
            상품 URL 입력 시 공급사가 자동 선택됩니다. [사실 가져오기]로 API에서 항공·옵션·쇼핑·일정·포함 등을 수집합니다. 아래 본문은 선택(모두투어 쿠폰·혜택 보강 등)이며, 항공·옵션·쇼핑은 <strong>API SSOT</strong>입니다.
          </p>
          <input
            id="admin-register-origin-url"
            name="originUrl"
            type="url"
            value={originUrl}
            onChange={(e) => {
              const nextUrl = e.target.value
              setOriginUrl(nextUrl)
              setDuplicateResult(null)
              setLastCheckedOriginUrl('')
              setRegisterFactBundle(null)
              setRegisterFactFetchError(null)
              const inferred = inferRegisterSupplierSwitchFromOriginUrl(nextUrl, selectedBrandKey)
              if (inferred) {
                setSelectedBrandKey(inferred)
                setRegisterFactBundle(null)
                setRegisterFactFetchError(null)
                resetRegisterPreviewSession({
                  clearPreview: true,
                  clearCorrection: true,
                  resetOriginCodeRef: true,
                })
                setStatusText('URL에서 공급사를 자동 선택했습니다. [사실 가져오기] 후 [봉투어 형식으로 변환]을 진행하세요.')
              }
            }}
            onBlur={() => {
              void checkOriginUrlDuplicate()
            }}
            placeholder="상품 URL을 입력하세요 (출처/reference용)"
            className="mt-2 w-full border border-slate-300 bg-white px-3 py-2.5 text-sm text-[#0f172a] placeholder:text-slate-400 focus:border-[#0f172a] focus:outline-none focus:ring-1 focus:ring-[#0f172a]"
            disabled={loading}
            autoComplete="off"
          />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void fetchRegisterFacts()}
              disabled={loading || registerFactFetchLoading || !registerFactFetchEnabled}
              className="border border-[#0f172a] bg-[#0f172a] px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {registerFactFetchLoading ? '사실 가져오는 중…' : '사실 가져오기 (API)'}
            </button>
            {!REGISTER_FACT_FETCH_SUPPLIERS.has(selectedBrandKey) && (
              <span className="text-xs text-slate-500">
                {registerSupplierDisplayName(selectedBrandKey)}는 아직 API 사실 수집을 지원하지 않습니다.
              </span>
            )}
          </div>
          {registerFactFetchError && (
            <p className="mt-2 text-sm text-red-700">{registerFactFetchError}</p>
          )}
          {registerFactBundle && (
            <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-950">
              <p className="font-medium">구조화 사실 수집 완료</p>
              <p className="mt-1">{formatRegisterFactBundleSummary(registerFactBundle)}</p>
              <p className="mt-2 text-xs text-emerald-800">
                {registerFactBundle.notes.join(' · ')} · 수집 시각 {registerFactBundle.fetchedAt}
              </p>
            </div>
          )}
          {duplicateCheckLoading && (
            <p className="mt-2 text-xs text-slate-500">중복 확인 중…</p>
          )}
          {!duplicateCheckLoading && duplicateResult?.exists && duplicateResult.matches.length > 0 && (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <p className="font-medium">
                같은 원본 URL로 등록·대기·보류 중인 상품이 {duplicateResult.matches.length}건 있습니다.
              </p>
              <ul className="mt-2 space-y-1">
                {duplicateResult.matches.map((m) => (
                  <li key={m.id}>
                    <Link
                      href={`/admin/products/${m.id}`}
                      className="font-medium text-[#0f172a] hover:underline"
                    >
                      {m.title || adminSupplierPrimaryDisplayLabel({ originSource: m.originSource }) || m.id}
                    </Link>
                    <span
                      className="ml-1 text-xs text-slate-500"
                      title={`DB originSource: ${m.originSource}`}
                    >
                      ({adminSupplierPrimaryDisplayLabel({ originSource: m.originSource })}
                      {m.registrationStatus ? ` · ${m.registrationStatus}` : ''})
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="mt-6 border-l-4 border-[#0f172a] pl-6">
          <p className="text-sm font-semibold text-slate-800">출발지 (수동 지정)</p>
          <p className="mt-1 text-xs text-slate-500">
            인천/김포 출발만 해당하면 모두 해제하세요. 체크한 값은 확정 저장 시 DB <code className="text-[11px]">localDepartureTag</code>에만
            반영되며, 미리보기 본문 지문과는 무관합니다.
          </p>
          <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-800">
            {LOCAL_DEPARTURE_TAG_VALUES.map((tag) => (
              <label key={tag} className="inline-flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-400 text-[#0f172a] focus:ring-[#0f172a]"
                  checked={localDepartureTag.includes(tag)}
                  onChange={() => toggleLocalDepartureTag(tag)}
                  disabled={loading || confirming}
                />
                <span>{LOCAL_DEPARTURE_TAG_LABELS[tag]}</span>
                <span className="font-mono text-[11px] text-slate-500">({tag})</span>
              </label>
            ))}
          </div>
        </div>

        <div className="mt-6 border-l-4 border-[#0f172a] pl-6">
          <p className="text-sm font-semibold text-slate-800">스포츠 테마 (수동 지정)</p>
          <p className="mt-1 text-xs text-slate-500">
            메가 메뉴·browse용. 없으면 선택 안 함. 확정 시 DB{' '}
            <code className="text-[11px]">sportsThemeTag</code>만 반영.
          </p>
          <SportsThemeTagMultiSelect
            value={sportsThemeTag}
            onChange={setSportsThemeTag}
            disabled={loading || confirming}
            tone="light"
          />
        </div>

        <div className="mt-6 border-l-4 border-[#0f172a] pl-6">
          <p className="text-sm font-semibold text-slate-800">단일 출발 상품 (수동 지정)</p>
          <p className="mt-1 text-xs text-slate-500">
            공급사 달력에 출발일이 하나뿐인 패키지(F1·이벤트·전세기 등)입니다. 체크 시 가격 동기화는 다출발 달력 API 대신
            단건 수집을 사용합니다. 확정 시 DB <code className="text-[11px]">singleDepartureOnly</code>만 반영됩니다.
          </p>
          <label className="mt-3 inline-flex cursor-pointer items-center gap-2 text-sm text-slate-800">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-400 text-[#0f172a] focus:ring-[#0f172a]"
              checked={singleDepartureOnly}
              onChange={(e) => setSingleDepartureOnly(e.target.checked)}
              disabled={loading || confirming || singleDepartureCheckboxDisabled}
            />
            <span>단일 출발 상품</span>
          </label>
          {singleDepartureCheckboxDisabled && (
            <p className="mt-2 text-xs text-slate-500">항공+호텔(자유여행)은 별도 수집 경로를 사용합니다.</p>
          )}
        </div>

        {/* A-3. 본문 전체 원문 */}
        <div className="mt-6 border-l-4 border-[#0f172a] pl-6">
          <label htmlFor="admin-register-detail-text" className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <span>본문 전체 원문 붙여넣기</span>
            <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700">자동 추출 기준 입력</span>
            <span className="rounded bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">권장 / 기본 입력</span>
          </label>
          <p className="mt-1 text-xs text-slate-500">
            [사실 가져오기] 결과 또는 선택적 추가 서술(쿠폰·혜택 등). 일정·포함/불포함·특징 추출에 쓰입니다. 항공·옵션·쇼핑 표는 URL API가 채웁니다.
          </p>
          <p className="mt-1 text-xs font-medium text-slate-600">
            현재 여행사 입력 프레임: <span className="text-[#0f172a]">{supplierFrameSpec.displayName}</span>
          </p>
          <textarea
            id="admin-register-detail-text"
            name="rawText"
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder={pastePh.body}
            className="mt-3 min-h-[280px] w-full resize-y border border-slate-300 bg-white px-4 py-4 text-sm leading-relaxed text-slate-900 placeholder:text-slate-400 focus:border-[#0f172a] focus:outline-none focus:ring-1 focus:ring-[#0f172a]"
            rows={20}
            disabled={loading}
          />
        </div>

        {/* G. 사실 → 봉투어 형식 변환 (LLM 재서술·구조화, 원문 HTML 재크롤링 아님) */}
        <div className="mt-8 border-l-4 border-[#0f172a] pl-6">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading || confirming || !resolveRegisterPasteText()}
            className="w-full bg-[#10b981] px-6 py-4 text-base font-bold tracking-wide text-white transition hover:bg-[#0d9668] disabled:opacity-70 sm:w-auto sm:max-w-xl"
          >
            {loading ? LOADING_STATUS : '봉투어 형식으로 변환'}
          </button>
          <p className="mt-2 text-xs text-slate-500">
            [사실 가져오기] API + 선택적 추가 본문을 봉투어 등록 형식으로 변환합니다. 항공·옵션·쇼핑은 originUrl detail-collect가 SSOT입니다.
          </p>
        </div>

        {/* 상태 — 미리보기보다 위에 유지 */}
        <div className="mt-8 border-l-4 border-[#0f172a] pl-6">
          <p className="text-sm font-semibold text-slate-500">상태</p>
          <p className="mt-2 min-h-[1.5rem] font-medium tracking-wide text-slate-800">
            {loading && statusText}
            {!loading &&
              savedProductId &&
              '미리보기 저장 완료. 등록대기에서 검토 후 승인하면 등록 확정됩니다.'}
            {!loading && !savedProductId && error && <span className="text-red-600">{error}</span>}
            {!loading && !savedProductId && !error && '대기 중'}
          </p>
        </div>

        {savedProductId && confirmVerification ? (
          <div className="mt-6 border-l-4 border-violet-600 pl-6">
            <p className="text-sm font-semibold text-violet-900">저장 직후 실검증 (confirm 응답)</p>
            <p className="mt-1 text-xs text-violet-800/90">
              아래 fingerprint를 미리보기 패널의 값과 비교하세요. 불일치면 confirm 직전에 교정·대표관광지 키워드 등으로 parsed가 바뀐
              것입니다.
            </p>
            {lastAdminTracePath ? (
              <Link
                href={lastAdminTracePath}
                className="mt-2 inline-block text-sm font-medium text-violet-800 underline hover:text-violet-950"
              >
                관리자 상품 화면에서 rawMeta·구조화 추적 (?registerTrace=1)
              </Link>
            ) : null}
            <div className="mt-3">
              <RegisterVerificationPanel
                verification={confirmVerification}
                compareFingerprint={previewStructuredFingerprintRef.current}
                onOpenCorrection={openCorrectionForIssueField}
              />
            </div>
          </div>
        ) : null}

        {preview &&
        previewContentFingerprintRef.current != null &&
        currentRegisterPreviewFingerprint() !== previewContentFingerprintRef.current ? (
          <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            <p className="font-semibold">입력이 미리보기 이후 변경되었습니다.</p>
            <p className="mt-1 text-xs text-amber-900/90">
              저장하려면 <strong>[봉투어 형식으로 변환]</strong>으로 다시 미리보기를 받아 주세요.
            </p>
          </div>
        ) : null}

        {preview && (
          <div className="mt-6 border-l-4 border-slate-300 pl-6">
            <p className="text-sm font-semibold text-slate-800">등록 전 미리보기</p>
            <p className="mt-1 text-xs text-slate-500">
              미리보기는 저장 직전 검수용입니다. confirm 단계는 미리보기에서 확정된 값만 저장하며 추가 재해석을 하지 않습니다.
            </p>

            {preview.ssotPreview ? (
              <div className="mt-4 rounded-lg border border-slate-300 bg-slate-50 p-3 text-xs text-slate-800">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                  SSOT 정책 {preview.ssotPreview.policyVersion}
                </p>
                <p className="mt-1.5 leading-relaxed text-slate-900">{preview.ssotPreview.headline}</p>
                <ul className="mt-2 list-inside list-disc space-y-0.5 text-[11px] text-slate-600">
                  <li>가격: 달력/가격표 &gt; 프로모 구조화 salePrice(충돌 시 제외)</li>
                  <li>쇼핑: 방문 횟수(요약)와 후보지 목록은 별개 개념</li>
                  <li>선택관광: 표/regex 최종, LLM은 supplement JSON</li>
                  <li>귀국: 날짜만 자동 보강된 경우 시각·편명 검수</li>
                </ul>
              </div>
            ) : null}

            <div className="mt-4 space-y-4">
              <div className="rounded border border-sky-200 bg-sky-50/70 p-3 text-xs text-sky-950">
                <p className="font-semibold text-sky-900">입력 출처</p>
                <ul className="mt-1 space-y-0.5">
                  <li>항공·옵션·쇼핑·호텔 표: originUrl detail-collect API (정형칸 없음)</li>
                  <li>일정·포함/불포함·특징: register-facts + LLM 표현층</li>
                </ul>
              </div>

              <div className="rounded border border-violet-200 bg-violet-50/80 p-3 text-xs text-violet-950">
                <p className="font-semibold text-violet-900">출발 공항 (register-facts·confirm)</p>
                <p className="mt-1 text-violet-900/90">
                  {inferredDepartureAirportLabel
                    ? (homeDepartureAirportDisplayText(inferredDepartureAirportLabel) ??
                      inferredDepartureAirportLabel)
                    : '없음 (인천/김포·서울권 기본)'}
                </p>
                <p className="mt-1 text-[11px] text-violet-800/80">
                  사실 가져오기 항공에서 추론. 확정 시 DB{' '}
                  <code className="text-[11px]">departureAirportLabel</code>에 저장됩니다.
                </p>
              </div>

              <div className="rounded border border-violet-200 bg-violet-50/80 p-3 text-xs text-violet-950">
                <p className="font-semibold text-violet-900">지방 출발 태그 (수동)</p>
                <p className="mt-1 text-violet-900/90">
                  {localDepartureTag.length === 0
                    ? '없음 (인천/김포 기본)'
                    : LOCAL_DEPARTURE_TAG_VALUES.filter((k) => localDepartureTag.includes(k))
                        .map((k) => LOCAL_DEPARTURE_TAG_LABELS[k])
                        .join(', ')}
                </p>
              </div>

              <div className="rounded border border-violet-200 bg-violet-50/80 p-3 text-xs text-violet-950">
                <p className="font-semibold text-violet-900">스포츠 테마 태그 (수동)</p>
                <p className="mt-1 text-violet-900/90">
                  {sportsThemeTag.length === 0
                    ? '없음'
                    : SPORTS_THEME_TAG_VALUES.filter((k) => sportsThemeTag.includes(k))
                        .map((k) => SPORTS_THEME_TAG_LABELS[k])
                        .join(', ')}
                </p>
              </div>

              <div className="rounded border border-violet-200 bg-violet-50/80 p-3 text-xs text-violet-950">
                <p className="font-semibold text-violet-900">단일 출발 (수동)</p>
                <p className="mt-1 text-violet-900/90">{singleDepartureOnly ? '예 — 단건 수집 경로' : '아니오'}</p>
              </div>

              {(() => {
                const detail = (preview.productDraft as { detailBodyStructured?: any })?.detailBodyStructured
                if (!detail) return null
                const repairLog = detail.geminiRepairLog ?? {}
                const sectionReview = detail.sectionReview ?? {}
                const sectionSource = (section: 'hotel_section' | 'optional_tour_section' | 'shopping_section' | 'flight_section' | 'included_excluded_section') => {
                  const apiSections = new Set([
                    'hotel_section',
                    'optional_tour_section',
                    'shopping_section',
                    'flight_section',
                  ])
                  const repaired = !!repairLog?.[section]?.applied
                  const hasAuto =
                    section === 'hotel_section'
                      ? (detail.hotelStructured?.rows?.length ?? 0) > 0
                      : section === 'optional_tour_section'
                        ? (detail.optionalToursStructured?.rows?.length ?? 0) > 0
                        : section === 'shopping_section'
                          ? (detail.shoppingStructured?.rows?.length ?? 0) > 0
                          : section === 'included_excluded_section'
                            ? (detail.includedExcludedStructured?.includedItems?.length ?? 0) +
                                (detail.includedExcludedStructured?.excludedItems?.length ?? 0) >
                              0
                            : Boolean(detail.flightStructured?.airlineName?.trim())
                  if (apiSections.has(section)) {
                    if (!hasAuto) return 'API 수집 대기/없음'
                    return repaired ? 'detail-collect API + Gemini 보정' : 'detail-collect API'
                  }
                  if (!hasAuto) return '입력 없음'
                  return repaired ? '본문 추출 + Gemini 보정' : '본문 추출'
                }
                const badgeSummary = (section: 'hotel_section' | 'optional_tour_section' | 'shopping_section' | 'flight_section' | 'included_excluded_section') => {
                  const r = sectionReview?.[section] ?? { required: [], warning: [], info: [] }
                  return {
                    req: Array.isArray(r.required) ? r.required.length : 0,
                    warn: Array.isArray(r.warning) ? r.warning.length : 0,
                    info: Array.isArray(r.info) ? r.info.length : 0,
                    reason:
                      (Array.isArray(r.required) && r.required[0]) ||
                      (Array.isArray(r.warning) && r.warning[0]) ||
                      (Array.isArray(r.info) && r.info[0]) ||
                      '이상 없음',
                  }
                }
                const reqCount = Array.isArray(detail.review?.required) ? detail.review.required.length : 0
                const warnCount = Array.isArray(detail.review?.warning) ? detail.review.warning.length : 0
                const infoCount = Array.isArray(detail.review?.info) ? detail.review.info.length : 0
                const oneLineReason =
                  (Array.isArray(detail.review?.required) && detail.review.required[0]) ||
                  (Array.isArray(detail.review?.warning) && detail.review.warning[0]) ||
                  (Array.isArray(detail.review?.info) && detail.review.info[0]) ||
                  '주요 이슈 없음'
                return (
                  <div className="rounded border border-slate-200 bg-white p-3 text-xs text-slate-800">
                    <p className="font-semibold text-slate-900">구조화 결과 요약 (최종 반영 출처)</p>
                    <p className="mt-1 text-[11px] text-slate-600">
                      이 영역은 단순 결과 나열이 아니라, 실제 저장 시 어떤 입력 소스가 최종 반영되는지 보여줍니다.
                    </p>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      <div className="rounded border border-slate-200 bg-slate-50 px-2 py-1.5">
                        <p className="font-medium">선택관광</p>
                        <p className="text-[11px] text-slate-600">
                          {sectionSource('optional_tour_section')} / {(detail.optionalToursStructured?.rows?.length ?? 0)}행 / warning {badgeSummary('optional_tour_section').warn}
                        </p>
                        <p className="text-[11px] text-slate-500">사유: {badgeSummary('optional_tour_section').reason}</p>
                      </div>
                      <div className="rounded border border-slate-200 bg-slate-50 px-2 py-1.5">
                        <p className="font-medium">쇼핑</p>
                        <p className="text-[11px] text-slate-600">
                          {sectionSource('shopping_section')} / {(detail.shoppingStructured?.rows?.length ?? 0)}행 / warning {badgeSummary('shopping_section').warn}
                        </p>
                        <p className="text-[11px] text-slate-500">사유: {badgeSummary('shopping_section').reason}</p>
                      </div>
                      <div className="rounded border border-slate-200 bg-slate-50 px-2 py-1.5">
                        <p className="font-medium">호텔</p>
                        <p className="text-[11px] text-slate-600">
                          {sectionSource('hotel_section')} / {(detail.hotelStructured?.rows?.length ?? 0)}행 / warning {badgeSummary('hotel_section').warn}
                        </p>
                        <p className="text-[11px] text-slate-500">사유: {badgeSummary('hotel_section').reason}</p>
                      </div>
                      <div className="rounded border border-slate-200 bg-slate-50 px-2 py-1.5">
                        <p className="font-medium">항공</p>
                        <p className="text-[11px] text-slate-600">
                          {sectionSource('flight_section')} / 가는편·오는편 분리 {detail.flightStructured?.reviewNeeded ? '검토 필요' : '성공'} / warning{' '}
                          {badgeSummary('flight_section').warn}
                        </p>
                        <p className="text-[11px] text-slate-500">사유: {badgeSummary('flight_section').reason}</p>
                      </div>
                      <div className="rounded border border-slate-200 bg-slate-50 px-2 py-1.5 sm:col-span-2">
                        <p className="font-medium">포함/불포함</p>
                        <p className="text-[11px] text-slate-600">
                          {sectionSource('included_excluded_section')} / 포함 {(detail.includedExcludedStructured?.includedItems?.length ?? 0)}개 · 불포함{' '}
                          {(detail.includedExcludedStructured?.excludedItems?.length ?? 0)}개 / warning {badgeSummary('included_excluded_section').warn}
                        </p>
                        <p className="text-[11px] text-slate-500">사유: {badgeSummary('included_excluded_section').reason}</p>
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${badgeTone('required')}`}>required {reqCount}</span>
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${badgeTone('warning')}`}>warning {warnCount}</span>
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${badgeTone('info')}`}>info {infoCount}</span>
                      <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800">최종 저장 예정</span>
                      <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-bold text-violet-800">
                        Gemini: 실패/애매 section 보정만
                      </span>
                      <span className="text-[11px] text-slate-600">사유: {oneLineReason}</span>
                    </div>
                  </div>
                )
              })()}

              {preview.registerVerification ? (
                <div className="mt-4">
                  <RegisterVerificationPanel
                    verification={preview.registerVerification}
                    onOpenCorrection={openCorrectionForIssueField}
                  />
                </div>
              ) : null}

              {(preview.ssotPreview?.issueHints?.length ?? preview.fieldIssues?.length ?? 0) > 0 ? (
                <div className="rounded border border-amber-200 bg-amber-50/80 p-3 text-xs text-amber-950">
                  <p className="font-semibold">필드 점검 · 배지</p>
                  <ul className="mt-2 space-y-2">
                    {(preview.ssotPreview?.issueHints ?? []).length > 0
                      ? preview.ssotPreview!.issueHints.map((h, i) => (
                          <li
                            key={`${h.field}_${i}`}
                            className="flex flex-wrap items-start justify-between gap-2 border-b border-amber-200/60 pb-2 last:border-0 last:pb-0"
                          >
                            <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-2">
                              <span
                                className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${
                                  h.badge === 'conflict'
                                    ? 'bg-red-200 text-red-950'
                                    : h.badge === 'review_needed'
                                      ? 'bg-amber-200 text-amber-950'
                                      : h.badge === 'supplement'
                                        ? 'bg-violet-200 text-violet-950'
                                        : 'bg-emerald-200 text-emerald-950'
                                }`}
                              >
                                {registerPreviewSsotBadgeLabelForSupplier(selectedBrandKey, h.badge)}
                              </span>
                              <span className="font-medium">{h.field}</span>
                              <span className="min-w-0 text-amber-900/90">{h.reason}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => openCorrectionForIssueField(h.field)}
                              className="shrink-0 rounded border border-amber-700/40 bg-white px-2 py-1 text-[11px] font-semibold text-amber-950 hover:bg-amber-100"
                            >
                              교정
                            </button>
                          </li>
                        ))
                      : (preview.fieldIssues ?? []).map((it, i) => (
                          <li
                            key={`${it.field}_${i}`}
                            className="flex flex-wrap items-start justify-between gap-2 border-b border-amber-200/60 pb-2 last:border-0 last:pb-0"
                          >
                            <div className="min-w-0 flex-1">
                              <span className="font-medium">{it.field}</span> ({'source' in it ? it.source : 'auto'}):{' '}
                              {it.reason}
                            </div>
                            <button
                              type="button"
                              onClick={() => openCorrectionForIssueField(it.field)}
                              className="shrink-0 rounded border border-amber-700/40 bg-white px-2 py-1 text-[11px] font-semibold text-amber-950 hover:bg-amber-100"
                            >
                              교정
                            </button>
                          </li>
                        ))}
                  </ul>
                </div>
              ) : null}

              <div className="rounded-lg border-2 border-slate-800 bg-white p-4 text-xs text-slate-900 shadow-sm">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">확정가 (달력·가격표 SSOT)</p>
                {(preview.ssotPreview?.previewPolicyNotes?.length ?? 0) > 0 ? (
                  <ul className="mt-2 list-inside list-disc space-y-1 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2 text-[11px] leading-relaxed text-slate-600">
                    {(preview.ssotPreview?.previewPolicyNotes ?? []).map((note, i) => (
                      <li key={i}>{note}</li>
                    ))}
                  </ul>
                ) : null}
                <p className="mt-1 text-2xl font-black tabular-nums tracking-tight">
                  {(() => {
                    const n =
                      preview.ssotPreview?.price.authoritativeKrw ??
                      preview.productDraft.selectedDeparturePrice ??
                      preview.productDraft.priceFrom
                    return n != null ? `${n.toLocaleString('ko-KR')}원` : '—'
                  })()}
                </p>
                {preview.ssotPreview?.price.promotionSalePriceStripped &&
                preview.ssotPreview.price.conflictingGeminiSalePrice != null ? (
                  <p className="mt-2 rounded border border-amber-300 bg-amber-50/90 p-2 text-[11px] text-amber-950">
                    프로모션 구조화 가격{' '}
                    <span className="font-semibold tabular-nums">
                      {preview.ssotPreview.price.conflictingGeminiSalePrice.toLocaleString('ko-KR')}원
                    </span>
                    은 확정가와 불일치하여 <strong>저장·히어로 기준에서 제외</strong>했습니다. 혜택 문구는 benefit/coupon 필드만
                    참고합니다.
                  </p>
                ) : null}
                {(() => {
                  const before = preview.productDraft.displayPriceBeforeCoupon
                  const disc = preview.productDraft.couponDiscountAmount
                  if (before == null && (disc == null || disc <= 0)) return null
                  return (
                    <p className="mt-2 text-[11px] text-slate-600">
                      {before != null && (
                        <>
                          쿠폰 적용 전 금액(선택 출발일 가격+쿠폰 할인액): {before.toLocaleString('ko-KR')}원{' '}
                        </>
                      )}
                      {disc != null && disc > 0 && (
                        <>· 쿠폰 할인액: {disc.toLocaleString('ko-KR')}원</>
                      )}
                    </p>
                  )
                })()}
                {preview.productDraft.promotionBasePrice != null &&
                preview.productDraft.promotionBasePrice > 0 &&
                (preview.productDraft.promotionSalePrice == null ||
                  preview.productDraft.promotionSalePrice <= 0) ? (
                  <p className="mt-2 rounded border border-amber-300 bg-amber-50/90 p-2 text-[11px] text-amber-950">
                    <strong>쿠폰 적용 전(취소선) 비노출:</strong> 병합 프로모에 <strong>salePrice가 없어</strong> 사용자
                    상세 화면에서 취소선 금액을 계산할 수 없습니다. (SSOT는 base·sale 쌍으로만 할인액 추정)
                    <span className="block mt-1 text-amber-900/90">
                      아래 「등록 참고(공급사 추출)」의 base 숫자는 검수용이며, 사용자 노출의 「쿠폰 적용 전 금액」과 같지 않습니다.
                    </span>
                  </p>
                ) : null}
                <p className="mt-2 text-[10px] text-slate-500">
                  등록 참고 — 병합 프로모 salePrice(공급사 추출·검수):{' '}
                  {preview.productDraft.promotionSalePrice != null
                    ? `${preview.productDraft.promotionSalePrice.toLocaleString('ko-KR')}원`
                    : '—'}{' '}
                  (충돌 제거 후; 메인 확정가와 동일하지 않을 수 있음)
                </p>
                {preview.productDraft.promotionBasePrice != null && preview.productDraft.promotionBasePrice > 0 ? (
                  <p className="mt-1 text-[10px] text-slate-500">
                    등록 참고 — 병합 프로모 basePrice(공급사 추출·검수):{' '}
                    {preview.productDraft.promotionBasePrice.toLocaleString('ko-KR')}원
                  </p>
                ) : null}
              </div>

              {preview.ssotPreview?.optionalTours ? (
                <p className="rounded border border-slate-200 bg-white px-3 py-2 text-[11px] text-slate-700">
                  <span className="font-semibold text-slate-900">선택관광 저장 예정</span>: 표/regex{' '}
                  {preview.ssotPreview.optionalTours.primaryRowCount ?? '—'}건.
                  {preview.ssotPreview.optionalTours.llmSupplementRowCount != null
                    ? ` LLM 보조 ${preview.ssotPreview.optionalTours.llmSupplementRowCount}건은 optionalToursLlmSupplementJson에만 보존.`
                    : ''}
                </p>
              ) : null}

              {preview.ssotPreview?.shopping.separationNote ? (
                <p className="rounded border border-blue-200 bg-blue-50/60 px-3 py-2 text-[11px] text-blue-950">
                  {preview.ssotPreview.shopping.separationNote}
                </p>
              ) : null}

              {preview.ssotPreview?.inboundSample &&
              (preview.ssotPreview.inboundSample.inboundArrivalAt ||
                preview.ssotPreview.inboundSample.needsScheduleReview) ? (
                <div className="rounded border border-sky-200 bg-sky-50/70 p-3 text-[11px] text-sky-950">
                  <p className="font-semibold text-sky-900">귀국 도착(표본 출발일 행)</p>
                  <p className="mt-1">
                    inboundArrivalAt:{' '}
                    <span className="font-mono">{preview.ssotPreview.inboundSample.inboundArrivalAt || '—'}</span>
                  </p>
                  {preview.ssotPreview.inboundSample.needsScheduleReview ? (
                    <p className="mt-1 text-sky-900/90">
                      날짜만 보강되었거나 시각이 불명확합니다. <strong>도착 시각·편명·공항</strong>은 원문 근거가 있을 때만
                      확정하세요.
                    </p>
                  ) : null}
                </div>
              ) : null}

              {preview.departureDrafts?.length ? (
                <details className="rounded border border-slate-200 bg-slate-50/90 p-3 text-[11px] text-slate-800">
                  <summary className="cursor-pointer font-semibold text-slate-900">
                    첫 출발일 항공 필드 샘플 (검수)
                  </summary>
                  <dl className="mt-2 grid gap-1 sm:grid-cols-2">
                    {(() => {
                      const r = preview.departureDrafts[0]!
                      const rows: [string, string][] = [
                        ['departureDate', r.departureDate],
                        ['outboundFlightNo', r.outboundFlightNo ?? '—'],
                        ['inboundFlightNo', r.inboundFlightNo ?? '—'],
                        ['inboundArrivalAt', r.inboundArrivalAt ?? '—'],
                        ['inboundDepartureAt', r.inboundDepartureAt ?? '—'],
                      ]
                      return rows.map(([k, v]) => (
                        <div key={k} className="sm:col-span-1">
                          <dt className="text-[10px] text-slate-500">{k}</dt>
                          <dd className="font-mono text-[11px]">{v || '—'}</dd>
                        </div>
                      ))
                    })()}
                  </dl>
                </details>
              ) : null}

              <div className="rounded border border-slate-200 bg-white p-3 text-xs text-slate-800">
                <p className="font-semibold text-slate-900">확인 요약</p>
                <dl className="mt-2 grid gap-1.5 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <dt className="text-[11px] text-slate-500">노출 상품명 (기본 저장 → Product.title)</dt>
                    <dd className="font-medium text-slate-900">
                      {(preview.displayProductTitle ?? preview.productDraft.title)?.trim() || '—'}
                    </dd>
                    {preview.listingTitleWarning ? (
                      <p className="mt-1.5 text-[11px] leading-relaxed text-amber-800">{preview.listingTitleWarning}</p>
                    ) : null}
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-[11px] text-slate-500">공급사 원본 (저장 → Product.originalTitle)</dt>
                    <dd className="text-slate-800">
                      {(preview.originalProductTitle ?? preview.productDraft.title)?.trim() || '—'}
                    </dd>
                  </div>
                  <div className="sm:col-span-2 rounded border border-slate-200 bg-slate-50/80 p-2.5">
                    <dt className="text-[11px] font-semibold text-slate-700">R-5 마케팅 제안명 (참고 — 기본으로는 저장하지 않음)</dt>
                    <dd className="mt-1 font-medium text-slate-800">
                      {preview.listingTitleAcceptable === false
                        ? '— (리스트 제목을 찾지 못해 생성하지 않음)'
                        : preview.bongtourProductTitle?.trim()
                          ? preview.bongtourProductTitle.trim()
                          : '—'}
                    </dd>
                    <label className="mt-2 flex items-start gap-2 text-[11px] text-slate-700">
                      <input
                        type="checkbox"
                        className="mt-0.5"
                        checked={useBongtourMarketingTitle}
                        onChange={(e) => setUseBongtourMarketingTitle(e.target.checked)}
                        disabled={!preview.bongtourProductTitle?.trim()}
                      />
                      <span>
                        위 마케팅 제안명을 <code className="text-[10px]">Product.title</code>로 저장 (체크하지 않으면
                        원문 기반 노출명 저장)
                      </span>
                    </label>
                  </div>
                  {preview.bongtourTitleValidation ? (
                    <div className="sm:col-span-2 rounded border border-slate-200 bg-slate-50/80 p-2 text-[11px] text-slate-700">
                      <p className="font-semibold text-slate-900">
                        봉투어 상품명 검사{' '}
                        {preview.bongtourTitleValidation.ok ? (
                          <span className="text-emerald-700">통과</span>
                        ) : (
                          <span className="text-amber-800">참고</span>
                        )}
                        {preview.bongtourTitleToneVersion ? (
                          <span className="ml-2 font-normal text-slate-500">({preview.bongtourTitleToneVersion})</span>
                        ) : null}
                      </p>
                      {preview.bongtourTitleValidation.issues.length > 0 ? (
                        <ul className="mt-1 list-inside list-disc text-[10px] text-slate-600">
                          {preview.bongtourTitleValidation.issues.map((msg, i) => (
                            <li key={`btitle_${i}`}>{msg}</li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  ) : null}
                  <div>
                    <dt className="text-[11px] text-slate-500">originCode</dt>
                    <dd>{preview.productDraft.originCode}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] text-slate-500">공급사</dt>
                    <dd>
                      <span className="font-medium">
                        {adminSupplierPrimaryDisplayLabel({
                          originSource: preview.productDraft.originSource,
                          brand: { brandKey: selectedBrandKey },
                        })}
                      </span>
                      <span className="ml-2 font-mono text-[10px] text-slate-500">
                        (originSource: {preview.productDraft.originSource})
                      </span>
                    </dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-[11px] text-slate-500">
                      현지옵션 요약
                    </dt>
                    <dd className="whitespace-pre-wrap">{preview.productDraft.optionalTourSummaryText ?? '-'}</dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-[11px] text-slate-500">쇼핑 요약</dt>
                    <dd className="whitespace-pre-wrap">{preview.productDraft.shoppingSummaryText ?? '-'}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] text-slate-500">쇼핑 방문 횟수(요약)</dt>
                    <dd>
                      {effectiveShoppingVisitCount(preview.productDraft, correctionOverlay) != null
                        ? `${effectiveShoppingVisitCount(preview.productDraft, correctionOverlay)}회`
                        : '-'}
                      {correctionOverlay?.fields.shopping &&
                      ((correctionOverlay.fields.shopping.visitCount &&
                        (correctionOverlay.fields.shopping.visitCount.reviewState === 'manually_edited' ||
                          correctionOverlay.fields.shopping.visitCount.reviewState === 'approved')) ||
                        (correctionOverlay.fields.shopping.reviewState === 'manually_edited' ||
                          correctionOverlay.fields.shopping.reviewState === 'approved')) ? (
                        <span className="ml-1.5 rounded bg-violet-100 px-1 py-0.5 text-[10px] font-bold text-violet-900">
                          교정 반영
                        </span>
                      ) : null}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] text-slate-500">쇼핑 상세 리스트 행 수 (shoppingPlaces / shoppingStops)</dt>
                    <dd>{effectiveShoppingTableRowCount(preview.productDraft, correctionOverlay) ?? '-'}</dd>
                  </div>
                  <div className="sm:col-span-2">
                    <button
                      type="button"
                      onClick={() => {
                        setCorrectionTargetKey('shopping')
                        setCorrectionHintDetail(null)
                        setCorrectionDrawerOpen(true)
                      }}
                      className="rounded border border-slate-400 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-900 hover:bg-slate-50"
                    >
                      쇼핑 교정 열기
                    </button>
                  </div>
                  <div>
                    <dt className="text-[11px] text-slate-500">히어로 출발일 / 출처</dt>
                    <dd>
                      {preview.productDraft.heroDepartureDate ?? '-'}
                      {preview.productDraft.heroDepartureDateSource
                        ? ` (${preview.productDraft.heroDepartureDateSource})`
                        : ''}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] text-slate-500">히어로 귀국일 / 출처</dt>
                    <dd>
                      {preview.productDraft.heroReturnDate ?? '-'}
                      {preview.productDraft.heroReturnDateSource
                        ? ` (${preview.productDraft.heroReturnDateSource})`
                        : ''}
                    </dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-[11px] text-slate-500">호텔 요약</dt>
                    <dd className="whitespace-pre-wrap">{preview.productDraft.hotelSummaryText ?? '-'}</dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-[11px] text-slate-500">호텔명</dt>
                    <dd>{(preview.productDraft.hotelNames ?? []).join(', ') || '-'}</dd>
                  </div>
                </dl>
              </div>

              {(() => {
                const fd = previewFinalParsedSummaryFromPayload(preview)
                return fd ? (
                  <div className="mt-4">
                    <RegisterAdminFinalParsedSummaryCard data={fd} />
                  </div>
                ) : null
              })()}

              {preview.productDraft.optionalToursStructured ? (
                <details className="rounded border border-slate-200 bg-slate-50/80 p-3 text-xs">
                  <summary className="cursor-pointer font-semibold text-slate-800">
                    현지옵션 구조화 — 표/regex 저장 기준 (접기)
                  </summary>
                  <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap text-[11px] text-slate-700">
                    {preview.productDraft.optionalToursStructured}
                  </pre>
                </details>
              ) : null}

              {preview.productDraft.optionalToursLlmSupplementJson ? (
                <details className="rounded border border-amber-200 bg-amber-50/60 p-3 text-xs">
                  <summary className="cursor-pointer font-semibold text-amber-950">
                    Gemini 선택관광 보조 (저장 SSOT 아님)
                  </summary>
                  <pre className="mt-2 max-h-28 overflow-auto whitespace-pre-wrap text-[11px] text-amber-950">
                    {preview.productDraft.optionalToursLlmSupplementJson}
                  </pre>
                </details>
              ) : null}

              {preview.productDraft.shoppingStopsLlmSupplementJson ? (
                <details className="rounded border border-amber-200 bg-amber-50/60 p-3 text-xs">
                  <summary className="cursor-pointer font-semibold text-amber-950">
                    Gemini 쇼핑 표 보조 (저장 SSOT 아님)
                  </summary>
                  <pre className="mt-2 max-h-28 overflow-auto whitespace-pre-wrap text-[11px] text-amber-950">
                    {preview.productDraft.shoppingStopsLlmSupplementJson}
                  </pre>
                </details>
              ) : null}

              <div className="rounded border border-slate-200 p-3 text-xs">
                <p className="font-semibold text-slate-900">일정 요약 (ItineraryDay)</p>
                <p className="text-[10px] leading-snug text-slate-500">
                  저장용 일차 초안입니다. 요약 문장은 <code className="rounded bg-slate-100 px-0.5">parsed.schedule[]</code>의
                  description과 같은 줄로 올라옵니다. <strong className="font-medium text-slate-700">imageKeyword·imageKeyword2는 이 블록에 없습니다</strong> — 아래
                  「대표관광지 저장」패널이 Pexels 1·2순위 SSOT입니다.
                </p>
                <p className="mt-1 text-slate-600">
                  {preview.itineraryDayDrafts.length > 0
                    ? `총 ${preview.itineraryDayDrafts.length}일 일정`
                    : '일정 행 없음 (일차 파싱 결과가 비어 있거나 미수집)'}
                </p>
                <div className="mt-2 space-y-2">
                  {preview.itineraryDayDrafts.slice(0, 10).map((d) => (
                    <div
                      key={`day_${d.day}`}
                      className="rounded border border-slate-100 bg-slate-50/80 px-2 py-2"
                    >
                      <p className="font-medium text-slate-800">
                        {d.day}일차 · {d.dateText ?? '-'} · {d.city ?? '-'}
                      </p>
                      <p className="mt-0.5 max-h-40 overflow-y-auto whitespace-pre-wrap text-[10px] text-slate-600">
                        요약: {d.summaryTextRaw ?? d.poiNamesRaw ?? '-'}
                      </p>
                      <p className="mt-1 text-[10px] text-slate-700 break-words">
                        meals: {clipPreviewText(d.meals, 160)}
                      </p>
                      <p className="text-[10px] text-slate-700 break-words">
                        accommodation: {clipPreviewText(d.accommodation, 160)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded border border-indigo-200 bg-indigo-50/50 p-3 text-xs">
                <p className="text-sm font-semibold text-indigo-950">대표관광지 저장</p>
                <p className="mt-0.5 text-[10px] font-medium text-indigo-900/90">
                  Pexels·Gemini 공통 기준 · 저장 SSOT:{' '}
                  <code className="rounded bg-white/80 px-1">Product.schedule[].imageKeyword</code> ·{' '}
                  <code className="rounded bg-white/80 px-1">imageKeyword2</code> (일차당 2장)
                </p>
                <ul className="mt-2 list-inside list-disc space-y-0.5 text-[11px] text-slate-600">
                  <li>
                    <strong className="font-medium text-slate-800">저장 대상:</strong> 관광지명·대표 배경·대표 시점을 한 줄로.{' '}
                    <strong className="font-medium text-slate-800">confirm</strong> 시 <code className="text-[10px]">parsed.schedule[].imageKeyword</code> → DB
                    반영.
                  </li>
                  <li>
                    <strong className="font-medium text-slate-800">Pexels:</strong> 위 저장값으로 사진 <strong className="text-slate-800">후보만</strong>{' '}
                    보여 주는 미리보기(저장 아님).
                  </li>
                  <li>
                    <strong className="font-medium text-slate-800">Gemini:</strong> 배경 이미지 생성은 보통 pending 등에서 이 필드를 우선합니다(이 화면에서 생성하지 않음).
                  </li>
                  <li>
                    <strong className="font-medium text-slate-800">비움:</strong> 본문·일정에서 만든 <strong className="text-slate-800">자동 추천 문자열</strong>이
                    fallback으로 쓰입니다.
                  </li>
                  <li>
                    <strong className="font-medium text-slate-800">routeText:</strong> 그날 이동 경로(
                    <code className="text-[10px]">A - B - C</code>) — 키워드 1·2순위는 이 순서를 우선합니다.
                  </li>
                  <li className="list-none pl-0 pt-1 text-[11px] text-slate-700">
                    <span className="font-medium">권장 형식:</span> 영문 관광지·랜드마크 고유명 1개 (예: Osaka Castle, Dotonbori, The Bund).
                    외곽·시점·시간·도시·국가 보조어는 넣지 않습니다.
                  </li>
                </ul>
                {registerPexelsUiRows.length === 0 ? (
                  <div className="mt-3 space-y-2">
                    <p className="text-[11px] text-amber-900">
                      일정 행이 없어 일차별로 나누지 못했습니다. 아래에 <strong>저장할 대표관광지 문구</strong>를 적고 confirm 하면 동일 필드로 갑니다. 사진만 볼
                      때는 <strong>후보 미리보기</strong>를 쓰세요.
                    </p>
                    <label htmlFor="register_pexels_fallback_kw" className="block text-[11px] font-medium text-slate-700">
                      대표관광지 저장 (confirm 시 imageKeyword)
                    </label>
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        id="register_pexels_fallback_kw"
                        type="text"
                        className="min-w-[12rem] flex-1 rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 placeholder:text-slate-400"
                        placeholder="Osaka Castle"
                        value={registerPexelsFallbackKeyword}
                        onChange={(e) => setRegisterPexelsFallbackKeyword(e.target.value)}
                        disabled={confirming || loading}
                        autoComplete="off"
                      />
                      <button
                        type="button"
                        disabled={confirming || loading || registerPexelsLoading}
                        onClick={() => void runRegisterPexelsSearch(registerPexelsFallbackKeyword)}
                        className="rounded border border-indigo-400 bg-indigo-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                        title="Pexels 검색(미리보기 전용, 저장과 별개)"
                      >
                        후보 미리보기
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 space-y-3">
                    {registerPexelsUiRows.map((row) => {
                      const day = row.day
                      const autoKw = String(row.imageKeyword ?? '').trim()
                      const autoKw2 = String(row.imageKeyword2 ?? '').trim()
                      const savedRowKw = autoKw
                      const overrideVal =
                        manualPexelsKeywordsByDay[day] !== undefined
                          ? manualPexelsKeywordsByDay[day]
                          : savedRowKw
                      const overrideVal2 =
                        manualPexelsKeywords2ByDay[day] !== undefined
                          ? manualPexelsKeywords2ByDay[day]
                          : autoKw2
                      const effectiveRaw = overrideVal.trim() !== '' ? overrideVal.trim() : autoKw
                      const effectiveRaw2 = overrideVal2.trim() !== '' ? overrideVal2.trim() : autoKw2
                      const persistedPreview = tryPersistScheduleImageKeyword(effectiveRaw)
                      const persistedPreview2 = tryPersistScheduleImageKeyword(effectiveRaw2)
                      const effectiveKw = persistedPreview.ok ? persistedPreview.value : effectiveRaw
                      const effectiveKw2 = persistedPreview2.ok ? persistedPreview2.value : effectiveRaw2
                      return (
                        <div
                          key={`pexels_kw_${day}`}
                          className="border-b border-indigo-100 pb-3 last:border-0 last:pb-0"
                        >
                          <div className="flex flex-wrap items-baseline gap-2">
                            <span className="min-w-[3rem] font-semibold text-slate-800">Day {day}</span>
                            <span className="text-[10px] text-slate-500" title="일정 요약(참고용, SSOT 아님)">
                              참고 일정: {clipPreviewText(row.title || row.description, 56)}
                            </span>
                          </div>
                          {(row as { routeText?: string | null }).routeText ? (
                            <p className="mt-1 text-[10px] text-slate-700" title="키워드 1·2순위는 이 경로 순서를 우선합니다">
                              이동 경로(routeText):{' '}
                              <span className="font-mono">{(row as { routeText?: string | null }).routeText}</span>
                            </p>
                          ) : (
                            <p className="mt-1 text-[10px] text-amber-800">
                              routeText 없음 — 관광지가 여러 곳인 날이면 재파싱·선추출 후 키워드가 대표 랜드마크로 떨어질 수 있습니다.
                            </p>
                          )}
                          <p className="mt-1 text-[10px] text-slate-500">
                            자동 추천 1·2순위 (미리보기=저장 SSOT, 칸 비우면 아래 값으로 confirm):{' '}
                            <span className="font-mono text-slate-800">{autoKw || '—'}</span>
                            {autoKw2 ? (
                              <span className="ml-2 font-mono text-slate-800">/ {autoKw2}</span>
                            ) : null}
                            {effectiveKw && effectiveKw !== autoKw ? (
                              <span className="ml-2 text-indigo-800">→ 1순위 저장: {effectiveKw}</span>
                            ) : null}
                            {effectiveKw2 && effectiveKw2 !== autoKw2 ? (
                              <span className="ml-2 text-indigo-800">→ 2순위 저장: {effectiveKw2}</span>
                            ) : null}
                          </p>
                          <label htmlFor={`pexels_schedule_kw_${day}`} className="mt-1 block text-[11px] font-medium text-slate-700">
                            Day {day} imageKeyword (1순위)
                          </label>
                          <div className="mt-1.5 flex max-w-3xl flex-wrap items-center gap-2">
                            <input
                              id={`pexels_schedule_kw_${day}`}
                              type="text"
                              className="min-w-[12rem] flex-1 rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 placeholder:text-slate-400"
                              placeholder={
                                autoKw ? `비우면 자동 추천: ${autoKw}` : '영문 관광지·랜드마크명'
                              }
                              value={overrideVal}
                              onChange={(e) =>
                                setManualPexelsKeywordsByDay((prev) => ({ ...prev, [day]: e.target.value }))
                              }
                              disabled={confirming || loading}
                              autoComplete="off"
                            />
                            <button
                              type="button"
                              disabled={confirming || loading || registerPexelsLoading || !effectiveKw.trim()}
                              onClick={() =>
                                void runRegisterPexelsSearch(
                                  normalizeToPlaceName(effectiveKw) || effectiveKw,
                                )
                              }
                              className="shrink-0 rounded border border-indigo-400 bg-indigo-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                              title="Pexels 검색(미리보기 전용, 저장과 별개)"
                            >
                              후보 미리보기
                            </button>
                          </div>
                          <label htmlFor={`pexels_schedule_kw2_${day}`} className="mt-2 block text-[11px] font-medium text-slate-700">
                            Day {day} imageKeyword2 (2순위)
                          </label>
                          <div className="mt-1 flex max-w-3xl flex-wrap items-center gap-2">
                            <input
                              id={`pexels_schedule_kw2_${day}`}
                              type="text"
                              className="min-w-[12rem] flex-1 rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 placeholder:text-slate-400"
                              placeholder={autoKw2 ? `비우면 자동: ${autoKw2}` : '2순위 영문 관광지명'}
                              value={overrideVal2}
                              onChange={(e) =>
                                setManualPexelsKeywords2ByDay((prev) => ({ ...prev, [day]: e.target.value }))
                              }
                              disabled={confirming || loading}
                              autoComplete="off"
                            />
                            <button
                              type="button"
                              disabled={confirming || loading || registerPexelsLoading || !effectiveKw2.trim()}
                              onClick={() =>
                                void runRegisterPexelsSearch(
                                  normalizeToPlaceName(effectiveKw2) || effectiveKw2,
                                )
                              }
                              className="shrink-0 rounded border border-slate-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
                              title="2순위 Pexels 미리보기"
                            >
                              2순위 미리보기
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
                {registerPexelsLastQuery != null ? (
                  <p className="mt-3 text-[11px] text-slate-600">
                    마지막 미리보기 검색어(Pexels):{' '}
                    <span className="font-mono font-medium text-slate-800">{registerPexelsLastQuery}</span>
                  </p>
                ) : null}
                {registerPexelsError ? (
                  <p className="mt-1 text-xs font-medium text-red-700">{registerPexelsError}</p>
                ) : null}
                {registerPexelsLoading ? (
                  <p className="mt-2 text-xs text-indigo-800">사진 후보 불러오는 중… (Pexels)</p>
                ) : null}
                {registerPexelsPhotos.length > 0 ? (
                  <div className="mt-3">
                    <p className="mb-2 text-[11px] font-medium text-slate-700">
                      사진 후보 미리보기 ({registerPexelsPhotos.length}건, Pexels)
                    </p>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                      {registerPexelsPhotos.map((ph) => (
                        <div
                          key={ph.id}
                          className="overflow-hidden rounded border border-slate-200 bg-white shadow-sm"
                        >
                          {/* 썸네일 위: 출처만 우하단. 도시·관광지 키워드는 위쪽 「마지막 미리보기 검색어」·입력란을 본다. */}
                          <div className="relative h-24 w-full overflow-hidden bg-slate-100">
                            <SafeImage
                              src={ph.thumbnail || ph.medium}
                              alt=""
                              fill
                              className="object-cover"
                              sizes="200px"
                              loading="lazy"
                            />
                            <span
                              className="pointer-events-none absolute bottom-1 right-1 z-[1] max-w-[min(100%,calc(100%-0.5rem))] truncate rounded bg-black/55 px-1.5 py-0.5 text-[9px] font-medium leading-tight text-white backdrop-blur-[1px]"
                              title={`Pexels · ${ph.photographer}`}
                            >
                              Pexels · {ph.photographer}
                            </span>
                          </div>
                          <div className="p-1.5">
                            <button
                              type="button"
                              className="w-full rounded bg-slate-100 px-1 py-0.5 text-[10px] text-slate-800 hover:bg-slate-200"
                              onClick={() => {
                                const url = ph.large || ph.medium
                                void navigator.clipboard?.writeText(url).catch(() => {})
                              }}
                            >
                              이미지 URL 복사
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            <RegisterCorrectionDrawer
              open={correctionDrawerOpen}
              onClose={() => setCorrectionDrawerOpen(false)}
              targetKey={correctionTargetKey}
              preview={preview}
              overlay={correctionOverlay}
              onCommitShopping={commitShoppingCorrection}
              hintDetail={correctionHintDetail}
            />

            <div className="mt-4">
              <button
                type="button"
                onClick={handleConfirmRegister}
                disabled={
                  confirming ||
                  loading ||
                  !preview.previewToken ||
                  !preview.previewContentDigest?.trim() ||
                  (previewContentFingerprintRef.current != null &&
                    currentRegisterPreviewFingerprint() !== previewContentFingerprintRef.current)
                }
                className="rounded-lg bg-[#0f172a] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
              >
                {confirming ? '3축 저장 중…' : '미리보기 확인 후 최종 저장'}
              </button>
              {!preview.previewToken ? (
                <p className="mt-2 text-xs text-red-600">미리보기 토큰이 없어 저장할 수 없습니다. 미리보기를 다시 생성하세요.</p>
              ) : !preview.previewContentDigest?.trim() ? (
                <p className="mt-2 text-xs text-red-600">
                  미리보기 지문이 없어 저장할 수 없습니다. 서버·클라이언트를 최신으로 한 뒤 다시 분석하세요.
                </p>
              ) : previewContentFingerprintRef.current != null &&
                currentRegisterPreviewFingerprint() !== previewContentFingerprintRef.current ? (
                <p className="mt-2 text-xs text-red-600">
                  본문·여행사·URL·카테고리가 바뀌었습니다. 다시 분석한 뒤 저장하세요.
                </p>
              ) : null}
            </div>
          </div>
        )}

        {!loading && savedProductId && (
          <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-5">
            <p className="text-sm font-medium text-emerald-800">저장되었습니다.</p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Link
                href="/admin/pending"
                className="rounded-lg bg-[#0f172a] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#1e293b]"
              >
                등록대기로 이동 →
              </Link>
              <Link
                href={`/admin/products/${savedProductId}`}
                className="text-sm font-medium text-[#0f172a] hover:underline"
              >
                상품 상세 보기
              </Link>
            </div>
          </div>
        )}

        <div className="mt-10 flex flex-wrap gap-4 border-t border-slate-200 pt-6">
          <Link href="/admin" className="text-sm font-medium tracking-wide text-slate-600 hover:text-[#0f172a]">
            ← 대시보드
          </Link>
          <Link href="/admin/pending" className="text-sm font-medium tracking-wide text-slate-600 hover:text-[#0f172a]">
            등록대기 보기
          </Link>
        </div>
      </div>
    </div>
  )
}
