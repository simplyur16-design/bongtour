'use client'

import Link from 'next/link'
import { useState, useEffect, useCallback, type ChangeEvent } from 'react'
import { buildPexelsKeyword } from '@/lib/pexels-keyword'
import AdminEmptyState from '../../components/AdminEmptyState'
import AdminStatusBadge from '../../components/AdminStatusBadge'
import { adminSupplierPrimaryDisplayLabel } from '@/lib/admin-product-supplier-derivatives'
import type { CanonicalOverseasSupplierKey } from '@/lib/overseas-supplier-canonical-keys'
import type { OverseasSupplierKey } from '@/lib/normalize-supplier-origin'
import { adminProductBgImageAttributionLine, adminProductBgImageSourceTypeLabel } from '@/lib/product-bg-image-attribution'
import { resizeImageFileForUpload } from '@/lib/browser-resize-image-for-upload'
import {
  ADMIN_MANUAL_PRIMARY_HERO_UPLOAD_OPTIONS,
  adminManualPrimaryHeroUploadAndPatch,
  type AdminManualPrimaryHeroUploadPreset,
} from '@/lib/admin-manual-primary-hero-upload'

const GEMINI_SLOT_LABEL_KR: Record<string, string> = {
  no_person_wide: '무인물 · 넓은 구도',
  no_person_zoom: '무인물 · 당긴 구도',
  person_half: '인물 · 상반신',
  person_full: '인물 · 전신',
}

function geminiSlotLabelKr(slot: string): string {
  return GEMINI_SLOT_LABEL_KR[slot] ?? slot
}

type PendingItem = {
  id: string
  originCode: string
  originSource: string
  canonicalBrandKey?: CanonicalOverseasSupplierKey | null
  normalizedOriginSupplier?: OverseasSupplierKey
  title: string
  destination: string | null
  duration: string | null
  updatedAt: string
  photosReady: boolean
}

type StructuredSignalsPreview = {
  remainingSeatsCount: number | null
  currentBookedCount: number | null
  minimumDepartureCount: number | null
  departureStatusText: string | null
  meetingInfoRaw: string | null
  meetingPlaceRaw: string | null
  meetingFallbackText: string | null
  shoppingVisitCount: number | null
  shoppingRows: Array<{
    city: string | null
    shopName: string | null
    shopLocation: string | null
    itemsText: string | null
    shoppingItem: string
    shoppingPlace: string
    durationText: string
    noteText: string | null
  }> | null
}

type ProductDetail = {
  id: string
  originCode: string
  originSource: string
  canonicalBrandKey?: CanonicalOverseasSupplierKey | null
  normalizedOriginSupplier?: OverseasSupplierKey
  brand?: { brandKey?: string | null } | null
  originUrl?: string | null
  title: string
  destination: string | null
  duration: string | null
  airline: string | null
  registrationStatus: string | null
  bgImageUrl: string | null
  bgImageSource?: string | null
  bgImagePhotographer?: string | null
  bgImageSourceUrl?: string | null
  bgImageIsGenerated?: boolean | null
  schedule: string | null
  updatedAt: string
  primaryRegion: string | null
  themeTags: string | null
  displayCategory: string | null
  targetAudience: string | null
  structuredSignalsPreview?: StructuredSignalsPreview | null
}

type PexelsSearchPhoto = {
  id: number
  thumbnail: string
  medium: string
  large: string
  photographer: string
  sourceUrl: string
}

type ImageAssetCandidate = {
  imageUrl: string
  source: string
  photographer?: string | null
  sourceUrl?: string | null
  externalId?: string | null
  label: string
  /** 사진풀 메타 — 공개 일정 캡션(imageAttractionName) 전달용 */
  cityName?: string
  attractionName?: string
  usageCount?: number
  lastUsedAt?: string | null
  createdAt?: string
  usedIn?: string[]
}

type Props = {
  productId: string | null
  listItem: PendingItem | null
  onApproved: (id: string) => void
  onHold: (id: string) => void
  onReject: (id: string, reason?: string) => void
  onClearSelection?: () => void
  isRegistering: boolean
  isHolding: boolean
  isRejecting: boolean
}

type DeparturePreview = {
  departureDate: string
  adultPrice: number | null
  statusRaw: string | null
  seatsStatusRaw: string | null
  minPax: number | null
  carrierName: string | null
  outboundFlightNo: string | null
  outboundDepartureAirport: string | null
  outboundDepartureAt: string | null
  inboundFlightNo: string | null
  inboundArrivalAirport: string | null
  inboundArrivalAt: string | null
  meetingPointRaw: string | null
}

type ItineraryDayPreview = {
  day: number
  dateText: string | null
  city: string | null
  summaryTextRaw: string | null
  poiNamesRaw: string | null
  meals: string | null
  accommodation: string | null
  transport: string | null
  notes: string | null
  rawBlock: string | null
}

type ScheduleDayImage = {
  day: number
  title?: string
  description?: string
  imageKeyword?: string
  imageUrl?: string | null
  imageSource?: { source?: string; photographer?: string; originalLink?: string }
  imageManualSelected?: boolean
  imageSelectionMode?: string | null
  imageCandidateOrigin?: string | null
}

/** X박Y일·N일 → 일수 Y/N (이미지 슬롯은 최소 일차 수만큼) */
function parseTripDayCountFromDuration(duration: string | null | undefined): number | null {
  if (!duration?.trim()) return null
  const t = duration.replace(/\s+/g, ' ')
  const nightDay = t.match(/(\d+)\s*박\s*(\d+)\s*일/)
  if (nightDay) {
    const days = parseInt(nightDay[2], 10)
    return Number.isFinite(days) && days > 0 ? days : null
  }
  const dayOnly = t.match(/(\d+)\s*일/)
  if (dayOnly) {
    const days = parseInt(dayOnly[1], 10)
    return Number.isFinite(days) && days > 0 ? days : null
  }
  return null
}

const MAX_SCHEDULE_IMAGE_DAY_SLOTS = 60

type LibraryAssetItem = {
  assetId: string
  sourceType: string
  cityName: string
  attractionName: string
  normalizedPath: string
  createdAt: string
  usageCount: number
  lastUsedAt: string | null
  usedIn: string[]
}

type DepartureMappingStatus = 'per-date-confirmed' | 'price-only-confirmed' | 'detail-candidate-found-but-unmapped'

function mappingStatusLabel(status: DepartureMappingStatus | null | undefined): string | null {
  if (status === 'per-date-confirmed') return '날짜별 상세 매핑 완료'
  if (status === 'price-only-confirmed') return '가격만 확정'
  if (status === 'detail-candidate-found-but-unmapped') return '상세 후보 미매핑'
  return null
}

function formatMeetingFromStructured(
  sp: StructuredSignalsPreview | null | undefined,
  _departureMeetingIgnored: string | null
): string {
  const merged = [sp?.meetingInfoRaw?.trim(), sp?.meetingPlaceRaw?.trim()].filter(Boolean).join(' · ')
  if (merged.trim()) return merged.trim()
  const fb = sp?.meetingFallbackText?.trim()
  if (fb) return fb
  return '-'
}

function formatSeatsCell(
  sp: StructuredSignalsPreview | null | undefined,
  seatsStatusRaw: string | null
): string {
  const rs = sp?.remainingSeatsCount
  if (rs != null && Number.isFinite(Number(rs))) return `잔여 ${rs}석`
  return seatsStatusRaw ?? '-'
}

function formatDate(s: string) {
  try {
    return new Date(s).toLocaleDateString('ko-KR', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return s
  }
}

function normalizeOriginTag(origin: string | null | undefined): 'poi_raw' | 'summary_text' | 'raw_block' | 'fallback' | 'manual-lock' {
  const key = String(origin ?? '').trim().toLowerCase()
  if (!key) return 'fallback'
  if (key === 'manual-lock' || key === 'manual') return 'manual-lock'
  if (key.includes('poi')) return 'poi_raw'
  if (key.includes('summary')) return 'summary_text'
  if (key.includes('raw')) return 'raw_block'
  return 'fallback'
}

function getOriginBadge(origin: string | null | undefined): { label: string; className: string } {
  const key = normalizeOriginTag(origin)
  if (key === 'poi_raw')
    return {
      label: 'POI 원문',
      className: 'border-bt-border-soft bg-bt-badge-package text-bt-badge-package-text',
    }
  if (key === 'summary_text')
    return {
      label: '요약 문장',
      className: 'border-bt-success bg-bt-badge-domestic text-bt-badge-domestic-text',
    }
  if (key === 'raw_block')
    return {
      label: '원문 블록',
      className: 'border-bt-border-soft bg-bt-surface-alt text-bt-muted',
    }
  if (key === 'manual-lock')
    return {
      label: '수동 고정',
      className: 'border-bt-warning bg-bt-badge-freeform text-bt-warning',
    }
  return {
    label: 'Fallback',
    className: 'border-bt-border-strong bg-bt-surface-alt text-bt-body',
  }
}

/** 일정 API에서 첫 비어 있지 않은 poiNamesRaw (Pexels/Gemini 키워드 공통) */
async function fetchFirstPoiNamesRaw(productId: string): Promise<string | null> {
  try {
    const r = await fetch(`/api/admin/products/${productId}/itinerary-days`)
    if (!r.ok) return null
    const rows = (await r.json()) as { poiNamesRaw?: string | null }[]
    if (!Array.isArray(rows)) return null
    const hit = rows.find((x) => (x.poiNamesRaw ?? '').trim().length > 0)
    return hit?.poiNamesRaw?.trim() ?? null
  } catch {
    return null
  }
}

async function fetchAdminProductDetail(productId: string): Promise<ProductDetail | null> {
  try {
    const r = await fetch(`/api/admin/products/${productId}`, { cache: 'no-store' })
    if (!r.ok) return null
    const data = (await r.json()) as { id?: string }
    return data?.id ? (data as ProductDetail) : null
  } catch {
    return null
  }
}

/** Prod CSP and legacy relative URLs — normalize so <img> loads in this panel */
function adminPreviewImgSrc(url: string | null | undefined): string | undefined {
  if (url == null) return undefined
  const u = String(url).trim()
  if (!u) return undefined
  if (u.startsWith('http://')) return `https://${u.slice('http://'.length)}`
  if (u.startsWith('/') && typeof window !== 'undefined') {
    return `${window.location.origin}${u}`
  }
  return u
}

/**
 * Pending review panel: product summary, image intake, secondary classification, approve/hold/reject.
 * When productId is null, shows empty state.
 */
export default function AdminPendingDetailPanel({
  productId,
  listItem,
  onApproved,
  onHold,
  onReject,
  onClearSelection,
  isRegistering,
  isHolding,
  isRejecting,
}: Props) {
  const [detail, setDetail] = useState<ProductDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [classificationSaving, setClassificationSaving] = useState(false)
  const [classificationMessage, setClassificationMessage] = useState<string | null>(null)
  const [primaryRegion, setPrimaryRegion] = useState('')
  const [themeTags, setThemeTags] = useState('')
  const [displayCategory, setDisplayCategory] = useState('')
  const [targetAudience, setTargetAudience] = useState('')
  const [showRejectForm, setShowRejectForm] = useState(false)
  const [rejectReasonText, setRejectReasonText] = useState('')
  const [pexelsLoading, setPexelsLoading] = useState(false)
  const [pexelsPhotos, setPexelsPhotos] = useState<PexelsSearchPhoto[]>([])
  const [pexelsError, setPexelsError] = useState<string | null>(null)
  const [pexelsQuery, setPexelsQuery] = useState<string | null>(null)
  const [primaryImageSavingId, setPrimaryImageSavingId] = useState<number | string | null>(null)
  const [primaryImageMessage, setPrimaryImageMessage] = useState<string | null>(null)
  const [manualHeroUploadPreset, setManualHeroUploadPreset] =
    useState<AdminManualPrimaryHeroUploadPreset>('photo_owned')
  const [manualHeroUploadOtherNote, setManualHeroUploadOtherNote] = useState('')
  const [primaryImageManualUploading, setPrimaryImageManualUploading] = useState(false)
  const [geminiLoading, setGeminiLoading] = useState(false)
  const [geminiResult, setGeminiResult] = useState<{
    promptUsed: string
    promptsBySlot?: { slot: string; text: string }[]
    images: { imageUrl: string | null; slot: string; error?: string | null }[]
  } | null>(null)
  const [geminiError, setGeminiError] = useState<string | null>(null)
  const [geminiPromptEditMode, setGeminiPromptEditMode] = useState(false)
  const [geminiEditedPrompt, setGeminiEditedPrompt] = useState('')
  const [assetsLoading, setAssetsLoading] = useState(false)
  const [assetsCityCandidates, setAssetsCityCandidates] = useState<ImageAssetCandidate[]>([])
  const [assetsAttractionCandidates, setAssetsAttractionCandidates] = useState<ImageAssetCandidate[]>([])
  const [assetsError, setAssetsError] = useState<string | null>(null)
  const [departureRows, setDepartureRows] = useState<DeparturePreview[]>([])
  const [itineraryDayRows, setItineraryDayRows] = useState<ItineraryDayPreview[]>([])
  const [previewLoading, setPreviewLoading] = useState(false)
  const [departureResyncLoading, setDepartureResyncLoading] = useState(false)
  const [itineraryResyncLoading, setItineraryResyncLoading] = useState(false)
  const [departureResyncMessage, setDepartureResyncMessage] = useState<string | null>(null)
  /** POST /departures 응답 JSON 전체(검증용) */
  const [departureResyncRawJson, setDepartureResyncRawJson] = useState<string | null>(null)
  const [itineraryResyncMessage, setItineraryResyncMessage] = useState<string | null>(null)
  const [departureMappingStatus, setDepartureMappingStatus] = useState<DepartureMappingStatus | null>(null)
  const [departureMappingNotes, setDepartureMappingNotes] = useState<string[]>([])
  const [dayCandidateMap, setDayCandidateMap] = useState<Record<number, PexelsSearchPhoto[]>>({})
  const [dayCandidateLoading, setDayCandidateLoading] = useState<Record<number, boolean>>({})
  const [dayGeminiMap, setDayGeminiMap] = useState<
    Record<number, { imageUrl: string | null; slot: string; error?: string | null }[]>
  >({})
  const [dayGeminiError, setDayGeminiError] = useState<Record<number, string | null>>({})
  const [dayGeminiLoading, setDayGeminiLoading] = useState<Record<number, boolean>>({})
  const [dayLibraryMap, setDayLibraryMap] = useState<Record<number, ImageAssetCandidate[]>>({})
  const [dayLibraryLoading, setDayLibraryLoading] = useState<Record<number, boolean>>({})
  const [librarySourceType, setLibrarySourceType] = useState('all')
  const [libraryKeyword, setLibraryKeyword] = useState('')
  const [librarySort, setLibrarySort] = useState<'recent-upload' | 'recent-used' | 'most-used'>('recent-upload')
  const [libraryPage, setLibraryPage] = useState(1)
  const [libraryTotalPages, setLibraryTotalPages] = useState(1)
  const [libraryFrequentAssets, setLibraryFrequentAssets] = useState<ImageAssetCandidate[]>([])
  const [libraryModalOpen, setLibraryModalOpen] = useState(false)
  const [libraryModalDay, setLibraryModalDay] = useState<number | null>(null)
  const [libraryHistoryOpenMap, setLibraryHistoryOpenMap] = useState<Record<string, boolean>>({})
  const [dayImageSaving, setDayImageSaving] = useState<Record<number, boolean>>({})
  const [dayImageMessage, setDayImageMessage] = useState<string | null>(null)
  const [dayImageThumbError, setDayImageThumbError] = useState<Record<number, string | null>>({})
  /** 일차별 대표관광지 키워드 — 저장 전 편집 (저장 시 schedule.imageKeyword SSOT) */
  const [dayImageKeywordDraft, setDayImageKeywordDraft] = useState<Record<number, string>>({})

  const closeLibraryModal = useCallback(() => {
    setLibraryModalOpen(false)
    setLibraryModalDay(null)
    setLibraryHistoryOpenMap({})
  }, [])

  useEffect(() => {
    if (!productId) {
      setDetail(null)
      setDetailError(null)
      return
    }
    setDetailLoading(true)
    setDetailError(null)
    setManualHeroUploadPreset('photo_owned')
    setManualHeroUploadOtherNote('')
    setPrimaryImageManualUploading(false)
    void fetchAdminProductDetail(productId)
      .then((data) => {
        if (data) setDetail(data)
        else setDetail(null)
      })
      .catch(() => {
        setDetail(null)
        setDetailError('상세를 불러오지 못했습니다.')
      })
      .finally(() => setDetailLoading(false))
  }, [productId])

  const loadPreviewData = useCallback(async () => {
    if (!productId) {
      setDepartureRows([])
      setItineraryDayRows([])
      return
    }
    setPreviewLoading(true)
    const fetchOpts: RequestInit = { cache: 'no-store' }
    try {
      const [depsRes, daysRes] = await Promise.all([
        fetch(`/api/admin/products/${productId}/departures`, fetchOpts),
        fetch(`/api/admin/products/${productId}/itinerary-days`, fetchOpts),
      ])
      const deps = depsRes.ok ? await depsRes.json().catch(() => []) : []
      const days = daysRes.ok ? await daysRes.json().catch(() => []) : []
      setDepartureRows(Array.isArray(deps) ? (deps as DeparturePreview[]) : [])
      setItineraryDayRows(Array.isArray(days) ? (days as ItineraryDayPreview[]) : [])
    } catch {
      setDepartureRows([])
      setItineraryDayRows([])
    } finally {
      setPreviewLoading(false)
    }
  }, [productId])

  useEffect(() => {
    void loadPreviewData()
  }, [loadPreviewData])

  useEffect(() => {
    if (detail) {
      setPrimaryRegion(detail.primaryRegion ?? '')
      setThemeTags(detail.themeTags ?? '')
      setDisplayCategory(detail.displayCategory ?? '')
      setTargetAudience(detail.targetAudience ?? '')
    }
  }, [detail?.id, detail?.primaryRegion, detail?.themeTags, detail?.displayCategory, detail?.targetAudience])

  useEffect(() => {
    setLibraryPage(1)
    setLibraryTotalPages(1)
    setLibraryFrequentAssets([])
    setLibraryHistoryOpenMap({})
  }, [productId])

  useEffect(() => {
    if (!showRejectForm) setRejectReasonText('')
  }, [showRejectForm])

  useEffect(() => {
    setDepartureMappingStatus(null)
    setDepartureMappingNotes([])
    setDayCandidateMap({})
    setDayGeminiMap({})
    setDayGeminiError({})
    setDayLibraryMap({})
    setDayImageMessage(null)
    setDayImageKeywordDraft({})
    setDayImageThumbError({})
  }, [detail?.id])

  const scheduleDayRows: ScheduleDayImage[] = (() => {
    if (!detail?.schedule) return []
    try {
      const parsed = JSON.parse(detail.schedule) as unknown
      if (!Array.isArray(parsed)) return []
      const normalized = (parsed as ScheduleDayImage[]).map((x, idx) => ({
        ...x,
        day: typeof x.day === 'number' && x.day > 0 ? x.day : idx + 1,
      }))
      const sorted = [...normalized].sort((a, b) => (Number(a.day) || 0) - (Number(b.day) || 0))
      const maxDayInSchedule = sorted.reduce((m, x) => Math.max(m, Number(x.day) || 0), 0)
      const fromDuration = parseTripDayCountFromDuration(detail.duration)
      const rawTarget = Math.max(maxDayInSchedule, fromDuration ?? 0, sorted.length)
      const targetDays = Math.min(Math.max(rawTarget, 1), MAX_SCHEDULE_IMAGE_DAY_SLOTS)
      const byDay = new Map<number, ScheduleDayImage>()
      for (const row of sorted) {
        const d = Number(row.day)
        if (Number.isFinite(d) && d > 0) byDay.set(d, row)
      }
      const out: ScheduleDayImage[] = []
      for (let d = 1; d <= targetDays; d++) {
        out.push(
          byDay.get(d) ?? {
            day: d,
            title: '',
            description: '',
            imageKeyword: `Day ${d} travel`,
          }
        )
      }
      return out
    } catch {
      return []
    }
  })()

  const itineraryByDay = new Map<number, ItineraryDayPreview>(itineraryDayRows.map((r) => [r.day, r]))

  const handlePexelsSearch = async () => {
    if (!detail) return
    const poiNamesRaw = await fetchFirstPoiNamesRaw(detail.id)
    const keyword = buildPexelsKeyword({
      destination: detail.destination,
      primaryRegion: primaryRegion || detail.primaryRegion,
      themeTags: themeTags || detail.themeTags,
      title: detail.title,
      scheduleJson: detail.schedule,
      poiNamesRaw,
    })
    setPexelsLoading(true)
    setPexelsError(null)
    setPexelsPhotos([])
    setPexelsQuery(keyword)
    try {
      const res = await fetch(`/api/admin/pexels/search?q=${encodeURIComponent(keyword)}`)
      const data = await res.json()
      if (!res.ok) {
        setPexelsError(data?.error ?? '검색에 실패했습니다.')
        setPexelsPhotos([])
        return
      }
      if (data.ok && Array.isArray(data.photos)) {
        setPexelsPhotos(data.photos)
        if (data.photos.length === 0) setPexelsError('검색 결과가 없습니다. 다른 키워드를 시도해 보세요.')
      } else {
        setPexelsPhotos([])
        setPexelsError('검색 결과를 불러올 수 없습니다.')
      }
    } catch {
      setPexelsError('네트워크 오류')
      setPexelsPhotos([])
    } finally {
      setPexelsLoading(false)
    }
  }

  const handleSetPrimaryImage = async (photo: PexelsSearchPhoto) => {
    if (!detail) return
    setPrimaryImageMessage(null)
    setPrimaryImageSavingId(photo.id)
    try {
      const res = await fetch(`/api/admin/products/${detail.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          primaryImageUrl: photo.large || photo.medium,
          primaryImageSource: 'pexels',
          primaryImagePhotographer: photo.photographer,
          primaryImageSourceUrl: photo.sourceUrl,
          primaryImageExternalId: String(photo.id),
        }),
      })
      const data = await res.json()
      if (res.ok && data?.id) {
        setDetail({ ...detail, ...data })
        setPrimaryImageMessage('대표 이미지로 저장되었습니다.')
      } else {
        setPrimaryImageMessage((data as { error?: string })?.error ?? '저장 실패')
      }
    } catch {
      setPrimaryImageMessage('저장 실패')
    } finally {
      setPrimaryImageSavingId(null)
    }
  }

  /** Gemini 생성: 자산·Pexels 부족 시 fallback. 저장 시 bgImageSource='gemini' 유지. 신규 등록·리프레시 시 보조용. */
  const handleGeminiGenerate = async (promptOverride?: string | null | unknown) => {
    const promptStr = typeof promptOverride === 'string' ? promptOverride : null
    console.log('[Gemini click] handler start', { hasDetail: Boolean(detail), promptOverrideIsString: typeof promptOverride === 'string' })
    if (!detail) {
      console.log('[Gemini click] abort: no detail')
      return
    }
    setGeminiError(null)
    setGeminiLoading(true)
    if (geminiPromptEditMode) setGeminiPromptEditMode(false)
    try {
      const poiNamesRaw = await fetchFirstPoiNamesRaw(detail.id)
      const body: Record<string, unknown> = {
        title: detail.title ?? null,
        destination: detail.destination ?? null,
        primaryRegion: primaryRegion || detail.primaryRegion || null,
        themeTags: themeTags || detail.themeTags || null,
        displayCategory: displayCategory || detail.displayCategory || null,
        scheduleJson: detail.schedule ?? null,
        poiNamesRaw,
      }
      if (promptStr != null && promptStr.trim().length > 0) {
        body.promptOverride = promptStr.trim().slice(0, 500)
      }
      console.log('[Gemini click] payload ready', Object.keys(body))
      console.log('[Gemini click] before fetch', '/api/admin/gemini/image-generate')
      const res = await fetch('/api/admin/gemini/image-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      console.log('[Gemini click] response', { ok: res.ok, status: res.status })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        error?: string
        images?: { imageUrl: string | null; slot?: string; error?: string | null }[]
        promptUsed?: string
        promptsBySlot?: { slot: string; text: string }[]
      }
      if (data?.ok && Array.isArray(data?.images) && data.images.length > 0) {
        setGeminiResult({
          promptUsed: data.promptUsed ?? '',
          promptsBySlot: data.promptsBySlot,
          images: data.images.map((im) => ({
            imageUrl: im.imageUrl ?? null,
            slot: im.slot ?? 'unknown',
            error: im.error ?? null,
          })),
        })
      } else {
        setGeminiError(
          data?.error?.trim() ||
            (res.ok ? '이미지 생성에 실패했습니다.' : `이미지 생성 실패 (HTTP ${res.status})`)
        )
      }
    } catch (e) {
      console.error('[Gemini click] error', e)
      setGeminiError(e instanceof Error ? e.message : '네트워크 오류')
    } finally {
      setGeminiLoading(false)
    }
  }

  const handleSetPrimaryImageFromGemini = async (imageUrl: string) => {
    if (!detail) return
    setPrimaryImageMessage(null)
    setPrimaryImageSavingId(imageUrl)
    try {
      const res = await fetch(`/api/admin/products/${detail.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          primaryImageUrl: imageUrl,
          primaryImageSource: 'gemini',
          primaryImagePhotographer: null,
          primaryImageSourceUrl: null,
          primaryImageExternalId: null,
        }),
      })
      const data = await res.json()
      if (res.ok && data?.id) {
        setDetail({ ...detail, ...data })
        setPrimaryImageMessage('대표 이미지로 저장되었습니다.')
      } else {
        setPrimaryImageMessage((data as { error?: string })?.error ?? '저장 실패')
      }
    } catch {
      setPrimaryImageMessage('저장 실패')
    } finally {
      setPrimaryImageSavingId(null)
    }
  }

  const handleLoadAssetCandidates = async () => {
    if (!detail) return
    setAssetsError(null)
    setAssetsCityCandidates([])
    setAssetsAttractionCandidates([])
    setAssetsLoading(true)
    try {
      const res = await fetch(`/api/admin/image-assets/suggest?productId=${encodeURIComponent(detail.id)}`)
      const data = await res.json()
      if (!res.ok) {
        setAssetsError((data as { error?: string })?.error ?? '후보를 불러오지 못했습니다.')
        return
      }
      if (data.ok && Array.isArray(data.cityCandidates) && Array.isArray(data.attractionCandidates)) {
        const city = data.cityCandidates ?? []
        const attraction = data.attractionCandidates ?? []
        setAssetsCityCandidates(city)
        setAssetsAttractionCandidates(attraction)
        if (city.length === 0 && attraction.length === 0) {
          setAssetsError('이 상품의 도시·관광지 자산이 없습니다. 목적지를 확인하거나 자산을 먼저 등록하세요.')
        }
      } else {
        setAssetsError('후보 데이터 형식이 올바르지 않습니다.')
      }
    } catch {
      setAssetsError('네트워크 오류')
    } finally {
      setAssetsLoading(false)
    }
  }

  const handlePendingManualPrimaryHeroUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.currentTarget.files?.[0] ?? null
    e.currentTarget.value = ''
    if (!file || !detail) return
    setPrimaryImageMessage(null)
    setPrimaryImageManualUploading(true)
    try {
      const cityName = detail.destination?.trim() || detail.primaryRegion?.trim() || 'City'
      const result = await adminManualPrimaryHeroUploadAndPatch(detail.id, file, {
        preset: manualHeroUploadPreset,
        otherNote: manualHeroUploadOtherNote,
        cityName,
      })
      if (result.ok) {
        setDetail((prev) => (prev ? { ...prev, ...(result.product as ProductDetail) } : prev))
        setPrimaryImageMessage('대표 이미지가 저장되었습니다.')
      } else {
        const prefix = result.stage === 'upload' ? '업로드 실패' : '저장 실패'
        setPrimaryImageMessage(`${prefix}: ${result.message}`)
      }
    } catch (err) {
      setPrimaryImageMessage(err instanceof Error ? err.message : '요청 실패')
    } finally {
      setPrimaryImageManualUploading(false)
    }
  }

  const handleSetPrimaryImageFromAsset = async (candidate: ImageAssetCandidate) => {
    if (!detail) return
    setPrimaryImageMessage(null)
    setPrimaryImageSavingId(candidate.imageUrl)
    try {
      const res = await fetch(`/api/admin/products/${detail.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          primaryImageUrl: candidate.imageUrl,
          primaryImageSource: candidate.source,
          primaryImagePhotographer: candidate.photographer ?? null,
          primaryImageSourceUrl: candidate.sourceUrl ?? null,
          primaryImageExternalId: candidate.externalId ?? null,
        }),
      })
      const data = await res.json()
      if (res.ok && data?.id) {
        setDetail({ ...detail, ...data })
        setPrimaryImageMessage('대표 이미지로 저장되었습니다.')
      } else {
        setPrimaryImageMessage((data as { error?: string })?.error ?? '저장 실패')
      }
    } catch {
      setPrimaryImageMessage('저장 실패')
    } finally {
      setPrimaryImageSavingId(null)
    }
  }

  if (!productId) {
    return (
      <div className="rounded-xl border border-bt-border-soft bg-bt-surface p-8 shadow-sm">
        <AdminEmptyState
          title="상품을 선택하세요"
          description="좌측 목록에서 검수할 상품을 선택하면 요약·이미지·2차 분류·승인 액션을 여기서 처리할 수 있습니다."
        />
      </div>
    )
  }

  if (detailLoading && !detail) {
    return (
      <div className="rounded-xl border border-bt-border-soft bg-bt-surface p-8 shadow-sm">
        <p className="text-center text-sm text-bt-meta">상세 로딩 중…</p>
      </div>
    )
  }

  if (detailError || !detail) {
    return (
      <div className="rounded-xl border border-bt-warning bg-bt-surface p-6 shadow-sm">
        <p className="text-sm text-bt-warning">{detailError ?? '상품 정보를 불러올 수 없습니다.'}</p>
        <button
          type="button"
          onClick={() => onClearSelection?.()}
          className="mt-4 rounded-lg border border-bt-border-strong px-4 py-2 text-sm font-medium text-bt-body hover:bg-bt-surface-soft"
        >
          선택 해제
        </button>
      </div>
    )
  }

  const item = listItem ?? {
    id: detail.id,
    originCode: detail.originCode,
    originSource: detail.originSource,
    canonicalBrandKey: detail.canonicalBrandKey,
    normalizedOriginSupplier: detail.normalizedOriginSupplier,
    title: detail.title,
    destination: detail.destination,
    duration: detail.duration,
    updatedAt: detail.updatedAt,
    photosReady: !!detail.bgImageUrl,
  }
  const canApprove = departureRows.length > 0 && itineraryDayRows.length > 0

  const handleResyncDepartures = async () => {
    if (!detail) return
    if (departureResyncLoading) return
    setDepartureResyncLoading(true)
    setDepartureResyncMessage(null)
    setDepartureResyncRawJson(null)
    try {
      const res = await fetch(`/api/admin/products/${detail.id}/departures`, {
        method: 'POST',
        // 서버 ybtour Playwright subprocess 최대 ~300s + DB 여유
        signal: AbortSignal.timeout(330_000),
      })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        error?: string
        stage?: string
        message?: string
        site?: string | null
        detailUrl?: string | null
        collectorStatus?: string | null
        collectedCount?: number
        upsertAttemptedCount?: number
        upsertedCount?: number
        emptyResult?: boolean
        pythonTimedOut?: boolean
        stderrSummary?: string
        stdoutSummary?: string
        diagnostics?: unknown
        count?: number
        mode?: 'live-rescrape' | 'fallback-rebuild'
        source?: string
        mappingStatus?: DepartureMappingStatus
        notes?: string[]
        liveError?: string | null
        attemptedLive?: boolean
        clientRefreshExpected?: boolean
        rescrapeOutcome?: 'success' | 'success_partial' | 'failed' | 'empty'
        hanatourMonthSummaryLines?: string[]
        pythonMonthDiagnostics?: unknown
      }
      setDepartureResyncRawJson(JSON.stringify(data, null, 2))
      if (res.status === 401) {
        setDepartureResyncMessage('재수집 실패: 관리자 인증이 필요합니다.')
        return
      }
      if (!res.ok || data.ok === false) {
        const bits = [
          data.stage ? `stage=${data.stage}` : null,
          data.message ?? data.error ?? `HTTP ${res.status}`,
          data.emptyResult ? 'emptyResult' : null,
          data.pythonTimedOut ? 'pythonTimedOut' : null,
          data.liveError ? `live: ${data.liveError}` : null,
          data.source ? `source=${data.source}` : null,
          data.mode ? `mode=${data.mode}` : null,
          data.collectorStatus ? `collectorStatus=${data.collectorStatus}` : null,
        ].filter(Boolean)
        const monthBlock =
          Array.isArray(data.hanatourMonthSummaryLines) && data.hanatourMonthSummaryLines.length > 0
            ? `\n${data.hanatourMonthSummaryLines.join('\n')}`
            : ''
        setDepartureResyncMessage(`재수집 실패: ${bits.join(' · ')}${monthBlock}`)
        return
      }
      setDepartureMappingStatus(data.mappingStatus ?? null)
      setDepartureMappingNotes(Array.isArray(data.notes) ? data.notes.filter((x) => typeof x === 'string') : [])
      const mapping = mappingStatusLabel(data.mappingStatus ?? null)
      const suffix =
        data.mode === 'fallback-rebuild' && data.liveError ? ` / live 경고: ${data.liveError}` : ''
      const srcHint = data.source ? ` · source=${data.source}` : ''
      const cnt = data.collectedCount ?? data.count ?? 0
      const up = data.upsertedCount ?? cnt
      const partial =
        data.collectorStatus === 'success_partial' || data.rescrapeOutcome === 'success_partial'
      const head = partial ? '재수집 부분 성공(일부 월 timeout/실패 가능)' : '재수집 완료'
      const monthBlock =
        Array.isArray(data.hanatourMonthSummaryLines) && data.hanatourMonthSummaryLines.length > 0
          ? `\n${data.hanatourMonthSummaryLines.join('\n')}`
          : ''
      setDepartureResyncMessage(
        `${head} · stage=${data.stage ?? 'done'} · 수집 ${cnt}건 · 반영 ${up}건${mapping ? ` · ${mapping}` : ''}${srcHint}${suffix}${monthBlock}`
      )
      await loadPreviewData()
      const dref = await fetchAdminProductDetail(detail.id)
      if (dref) setDetail(dref)
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') {
        setDepartureResyncMessage('재수집 실패: 시간 초과(200초). Python 수집·네트워크를 확인하세요.')
      } else {
        setDepartureResyncMessage(`재수집 실패: ${e instanceof Error ? e.message : '네트워크 오류'}`)
      }
    } finally {
      setDepartureResyncLoading(false)
    }
  }

  const handleResyncItineraryDays = async () => {
    if (!detail) return
    setItineraryResyncLoading(true)
    setItineraryResyncMessage(null)
    try {
      const res = await fetch(`/api/admin/products/${detail.id}/itinerary-days`, { method: 'POST' })
      const data = (await res.json().catch(() => ({}))) as {
        error?: string
        count?: number
        mode?: string
        source?: string
      }
      if (!res.ok) {
        setItineraryResyncMessage(`재수집 실패: ${data.error ?? `HTTP ${res.status}`}`)
      } else {
        setItineraryResyncMessage(
          `재수집 완료 (${data.mode ?? 'unknown'}, ${data.source ?? 'unknown'}, ${data.count ?? 0}건)`
        )
        await loadPreviewData()
      }
    } catch (e) {
      setItineraryResyncMessage(`재수집 실패: ${e instanceof Error ? e.message : '네트워크 오류'}`)
    } finally {
      setItineraryResyncLoading(false)
    }
  }

  const handleSaveClassification = async () => {
    setClassificationSaving(true)
    setClassificationMessage(null)
    try {
      const res = await fetch(`/api/admin/products/${detail.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          primaryRegion: primaryRegion.trim() || null,
          themeTags: themeTags.trim() || null,
          displayCategory: displayCategory.trim() || null,
          targetAudience: targetAudience.trim() || null,
        }),
      })
      const data = await res.json()
      if (res.ok && data?.id) {
        setDetail({ ...detail, ...data })
        setClassificationMessage('저장되었습니다.')
      } else {
        setClassificationMessage((data as { error?: string })?.error ?? '저장 실패')
      }
    } catch {
      setClassificationMessage('저장 실패')
    } finally {
      setClassificationSaving(false)
    }
  }

  const handleSaveDayImageKeyword = async (day: number) => {
    if (!detail) return
    const kw = (dayImageKeywordDraft[day] ?? '').trim()
    setDayImageSaving((prev) => ({ ...prev, [day]: true }))
    setDayImageMessage(null)
    try {
      const res = await fetch(`/api/admin/products/${detail.id}/schedule-images`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ day, imageKeyword: kw }),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        setDayImageMessage(`DAY${day} 대표관광지 저장 실패: ${data.error ?? `HTTP ${res.status}`}`)
        return
      }
      setDayImageMessage(`DAY${day} 대표관광지 키워드가 저장되었습니다.`)
      const refreshed = await fetchAdminProductDetail(detail.id)
      if (refreshed) setDetail(refreshed)
    } finally {
      setDayImageSaving((prev) => ({ ...prev, [day]: false }))
    }
  }

  const handleLoadDayCandidates = async (row: ScheduleDayImage) => {
    if (!detail) return
    const day = row.day
    const it = itineraryByDay.get(day)
    const savedKw = (dayImageKeywordDraft[day] ?? row.imageKeyword ?? '').trim()
    const query =
      savedKw ||
      `${detail.destination ?? ''} ${it?.poiNamesRaw ?? it?.summaryTextRaw ?? it?.city ?? row.title ?? `day ${day}`}`.trim()
    setDayCandidateLoading((prev) => ({ ...prev, [day]: true }))
    try {
      const res = await fetch(`/api/admin/pexels/search?q=${encodeURIComponent(query)}`)
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; photos?: PexelsSearchPhoto[] }
      const photos = data.ok && Array.isArray(data.photos) ? data.photos : []
      setDayCandidateMap((prev) => ({ ...prev, [day]: photos.slice(0, 8) }))
    } finally {
      setDayCandidateLoading((prev) => ({ ...prev, [day]: false }))
    }
  }

  const saveDayImageSelection = async (
    day: number,
    payload: {
      imageUrl: string
      source: string
      photographer?: string | null
      originalLink?: string | null
      externalId?: string | null
      selectionMode?: string | null
      imageAttractionName?: string | null
      imageSeoTitleKr?: string | null
      imageDisplayNameManual?: string | null
    }
  ) => {
    if (!detail) return
    setDayImageSaving((prev) => ({ ...prev, [day]: true }))
    setDayImageMessage(null)
    try {
      const res = await fetch(`/api/admin/products/${detail.id}/schedule-images`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          day,
          imageUrl: payload.imageUrl,
          source: payload.source,
          photographer: payload.photographer ?? null,
          originalLink: payload.originalLink ?? null,
          externalId: payload.externalId ?? null,
          manualSelected: true,
          selectionMode: payload.selectionMode ?? null,
          imageAttractionName: payload.imageAttractionName ?? null,
          imageSeoTitleKr: payload.imageSeoTitleKr ?? null,
          imageDisplayNameManual: payload.imageDisplayNameManual ?? null,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        setDayImageMessage(`DAY${day} 저장 실패: ${data.error ?? `HTTP ${res.status}`}`)
        return
      }
      setDayImageThumbError((prev) => ({ ...prev, [day]: null }))
      setDayImageMessage(`DAY${day} 이미지 수동 선택 저장 완료`)
      const refreshed = await fetchAdminProductDetail(detail.id)
      if (refreshed) setDetail(refreshed)
    } finally {
      setDayImageSaving((prev) => ({ ...prev, [day]: false }))
    }
  }

  const handleLoadDayLibrary = async (day: number, pageArg?: number) => {
    if (!detail) return
    setDayLibraryLoading((prev) => ({ ...prev, [day]: true }))
    try {
      const nextPage = Math.max(1, pageArg ?? libraryPage)
      const qs = new URLSearchParams({
        sourceType: librarySourceType,
        keyword: libraryKeyword,
        sort: librarySort,
        page: String(nextPage),
        take: '24',
      })
      const res = await fetch(`/api/admin/image-assets/library?${qs.toString()}`)
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        page?: number
        totalPages?: number
        items?: LibraryAssetItem[]
        frequentAssets?: LibraryAssetItem[]
      }
      const merged = data.ok && Array.isArray(data.items)
        ? data.items.map((x) => ({
            imageUrl: x.normalizedPath,
            source: x.sourceType,
            photographer: null,
            sourceUrl: null,
            externalId: x.assetId,
            cityName: x.cityName,
            attractionName: x.attractionName,
            usageCount: x.usageCount,
            lastUsedAt: x.lastUsedAt,
            createdAt: x.createdAt,
            usedIn: x.usedIn,
            label: `${x.cityName}/${x.attractionName} · 사용 ${x.usageCount}회 · 최근사용 ${x.lastUsedAt ? formatDate(x.lastUsedAt) : '-'} · 최근업로드 ${formatDate(x.createdAt)}`,
          }))
        : []
      const frequent = data.ok && Array.isArray(data.frequentAssets)
        ? data.frequentAssets.map((x) => ({
            imageUrl: x.normalizedPath,
            source: x.sourceType,
            photographer: null,
            sourceUrl: null,
            externalId: x.assetId,
            cityName: x.cityName,
            attractionName: x.attractionName,
            usageCount: x.usageCount,
            lastUsedAt: x.lastUsedAt,
            createdAt: x.createdAt,
            usedIn: x.usedIn,
            label: `${x.cityName}/${x.attractionName} · 사용 ${x.usageCount}회`,
          }))
        : []
      setDayLibraryMap((prev) => ({ ...prev, [day]: merged }))
      setLibraryFrequentAssets(frequent)
      setLibraryPage(data.page ?? nextPage)
      setLibraryTotalPages(data.totalPages ?? 1)
    } finally {
      setDayLibraryLoading((prev) => ({ ...prev, [day]: false }))
    }
  }

  const handleUploadDayImage = async (day: number, file: File | null) => {
    if (!detail || !file) return
    setDayImageSaving((prev) => ({ ...prev, [day]: true }))
    setDayImageMessage(null)
    setDayImageThumbError((prev) => ({ ...prev, [day]: null }))
    try {
      const toSend = await resizeImageFileForUpload(file)
      const form = new FormData()
      form.append('file', toSend)
      form.append('cityName', detail.destination ?? 'City')
      form.append('attractionName', `DAY${day}`)
      form.append('source', 'manual-upload')
      const uploadRes = await fetch('/api/admin/photo-pool/upload', { method: 'POST', body: form })
      const upload = (await uploadRes.json().catch(() => ({}))) as {
        ok?: boolean
        error?: string
        message?: string
        items?: { filePath: string; id: string }[]
      }
      if (!uploadRes.ok || !upload.ok || !Array.isArray(upload.items) || upload.items.length === 0) {
        setDayImageMessage(
          `DAY${day} 업로드 실패: ${upload.message ?? upload.error ?? `HTTP ${uploadRes.status}`}`
        )
        return
      }
      const item = upload.items[0]
      await saveDayImageSelection(day, {
        imageUrl: item.filePath,
        source: 'manual-upload',
        photographer: null,
        originalLink: null,
        externalId: item.id,
        selectionMode: 'manual-upload',
      })
    } catch (e) {
      setDayImageMessage(
        `DAY${day} 업로드 중 오류: ${e instanceof Error ? e.message : String(e)}`
      )
    } finally {
      setDayImageSaving((prev) => ({ ...prev, [day]: false }))
    }
  }

  const openLibraryModal = async (day: number) => {
    setLibraryModalDay(day)
    setLibraryModalOpen(true)
    setLibraryPage(1)
    setLibraryHistoryOpenMap({})
    await handleLoadDayLibrary(day, 1)
  }

  const selectLibraryAssetForDay = async (day: number, item: ImageAssetCandidate) => {
    const attraction =
      [item.cityName, item.attractionName].filter((s) => (s ?? '').trim().length > 0).join(' · ') || null
    await saveDayImageSelection(day, {
      imageUrl: item.imageUrl,
      source: item.source || 'library-reuse',
      photographer: item.photographer ?? null,
      originalLink: item.sourceUrl ?? null,
      externalId: item.externalId ?? null,
      selectionMode: 'library-reuse',
      imageAttractionName: attraction,
    })
    closeLibraryModal()
  }

  const clearDayManualSelection = async (day: number) => {
    if (!detail) return
    setDayImageSaving((prev) => ({ ...prev, [day]: true }))
    setDayImageMessage(null)
    try {
      const res = await fetch(`/api/admin/products/${detail.id}/schedule-images`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ day, manualSelected: false }),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        setDayImageMessage(`DAY${day} 자동 복귀 실패: ${data.error ?? `HTTP ${res.status}`}`)
        return
      }
      setDayImageMessage(`DAY${day} 자동 후보 사용으로 복귀`)
      const refreshed = await fetchAdminProductDetail(detail.id)
      if (refreshed) setDetail(refreshed)
    } finally {
      setDayImageSaving((prev) => ({ ...prev, [day]: false }))
    }
  }

  const handleGenerateDayGemini = async (row: ScheduleDayImage) => {
    if (!detail) return
    const day = row.day
    const it = itineraryByDay.get(day)
    const savedKw = (dayImageKeywordDraft[day] ?? row.imageKeyword ?? '').trim()
    const dayPrompt =
      savedKw ||
      `${detail.destination ?? ''} day ${day} ${it?.poiNamesRaw ?? it?.summaryTextRaw ?? row.title ?? ''}`.trim()
    setDayGeminiLoading((prev) => ({ ...prev, [day]: true }))
    setDayGeminiError((prev) => ({ ...prev, [day]: null }))
    try {
      const body: Record<string, unknown> = {
        title: detail.title ?? null,
        destination: detail.destination ?? null,
        primaryRegion: primaryRegion || detail.primaryRegion || null,
        themeTags: themeTags || detail.themeTags || null,
        displayCategory: displayCategory || detail.displayCategory || null,
        scheduleJson: detail.schedule ?? null,
        promptOverride: dayPrompt,
      }
      const res = await fetch('/api/admin/gemini/image-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        error?: string
        images?: { imageUrl: string | null; slot?: string; error?: string | null }[]
      }
      if (!data.ok || !Array.isArray(data.images) || data.images.length === 0) {
        setDayGeminiMap((prev) => ({ ...prev, [day]: [] }))
        setDayGeminiError((prev) => ({
          ...prev,
          [day]:
            data.error?.trim() ||
            (res.ok ? '이미지 생성 응답에 후보가 없습니다.' : `HTTP ${res.status}`),
        }))
        return
      }
      const images = data.images.map((im) => ({
        imageUrl: im.imageUrl ?? null,
        slot: im.slot ?? 'unknown',
        error: im.error ?? null,
      }))
      setDayGeminiMap((prev) => ({ ...prev, [day]: images.slice(0, 4) }))
      setDayGeminiError((prev) => ({ ...prev, [day]: null }))
    } catch (e) {
      setDayGeminiMap((prev) => ({ ...prev, [day]: [] }))
      setDayGeminiError((prev) => ({
        ...prev,
        [day]: e instanceof Error ? e.message : '네트워크 오류',
      }))
    } finally {
      setDayGeminiLoading((prev) => ({ ...prev, [day]: false }))
    }
  }

  return (
    <div className="flex flex-col gap-6 rounded-xl border border-bt-border-soft bg-bt-surface shadow-sm">
      {/* 상품 요약 */}
      <section className="border-b border-bt-border-soft p-5">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-bt-meta">상품 요약</h3>
        <p className="font-medium text-bt-title">{item.title}</p>
        <p className="mt-1 text-sm text-bt-meta">
          {item.originCode} · {adminSupplierPrimaryDisplayLabel({ ...item, brand: detail.brand ?? null })}
          {item.destination && ` · ${item.destination}`}
          {item.duration && ` · ${item.duration}`}
        </p>
        <p className="mt-0.5 text-xs text-bt-subtle">{formatDate(item.updatedAt)} 수정</p>
        <p className="mt-1.5 text-xs">
          {detail.originUrl ? (
            <a
              href={detail.originUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="font-medium text-bt-title hover:underline"
            >
              원본 보기 ↗
            </a>
          ) : (
            <span className="text-bt-subtle">원본 URL 없음</span>
          )}
        </p>
        <p className="mt-2">
          <AdminStatusBadge
            variant={item.photosReady ? 'registered' : 'pending_image'}
            label={item.photosReady ? '사진 완료' : '이미지 수급'}
          />
        </p>
      </section>

      <section className="border-b border-bt-border-soft p-5">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-bt-meta">등록 전 미리보기 (필수)</h3>
        <div className="mb-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void handleResyncDepartures()}
            disabled={departureResyncLoading || itineraryResyncLoading}
            className="rounded-lg border border-bt-border-strong bg-bt-surface px-3 py-2 text-xs font-medium text-bt-body hover:bg-bt-surface-soft disabled:opacity-50"
          >
            {departureResyncLoading ? '수집 중...' : '출발일/가격 다시 수집'}
          </button>
          <button
            type="button"
            onClick={() => void handleResyncItineraryDays()}
            disabled={departureResyncLoading || itineraryResyncLoading}
            className="rounded-lg border border-bt-border-strong bg-bt-surface px-3 py-2 text-xs font-medium text-bt-body hover:bg-bt-surface-soft disabled:opacity-50"
          >
            {itineraryResyncLoading ? '수집 중...' : '일정표 다시 수집'}
          </button>
        </div>
        {(departureResyncMessage || departureResyncRawJson || itineraryResyncMessage) && (
          <div className="mb-2 space-y-1">
            {departureResyncMessage && <p className="text-xs text-bt-body">{departureResyncMessage}</p>}
            {departureResyncRawJson ? (
              <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-all rounded border border-bt-border-soft bg-bt-surface-alt p-2 text-[10px] leading-snug text-bt-body">
                {departureResyncRawJson}
              </pre>
            ) : null}
            {itineraryResyncMessage && <p className="text-xs text-bt-body">{itineraryResyncMessage}</p>}
          </div>
        )}
        {previewLoading ? (
          <p className="text-xs text-bt-meta">수집 데이터 확인 중…</p>
        ) : (
          <>
            <p className="text-xs text-bt-muted">
              ProductDeparture: <span className="font-semibold text-bt-title">{departureRows.length}건</span> · ItineraryDay:{' '}
              <span className="font-semibold text-bt-title">{itineraryDayRows.length}건</span>
            </p>
            {departureMappingStatus && (
              <p className="mt-1 text-xs text-bt-body">
                출발일 매핑 상태:{' '}
                <span className="rounded bg-bt-surface-alt px-1.5 py-0.5 font-medium text-bt-strong">
                  {mappingStatusLabel(departureMappingStatus)}
                </span>
              </p>
            )}
            {departureMappingNotes.length > 0 && (
              <p className="mt-1 text-[11px] text-bt-meta">{departureMappingNotes[0]}</p>
            )}
            {detail?.structuredSignalsPreview ? (
              <div className="mt-2 rounded border border-bt-border-soft bg-bt-surface-soft p-2">
                <p className="mb-1 text-[11px] font-medium text-bt-muted">등록 본문 메타 (rawMeta.structuredSignals)</p>
                <ul className="space-y-0.5 text-[11px] text-bt-body">
                  <li>
                    출발조건(한 줄):{' '}
                    <span className="font-mono text-bt-title">
                      {detail.structuredSignalsPreview.departureStatusText ?? '—'}
                    </span>
                  </li>
                  <li>
                    잔여좌석(구조값 remainingSeatsCount):{' '}
                    <span className="font-mono text-bt-title">
                      {detail.structuredSignalsPreview.remainingSeatsCount ?? '—'}
                    </span>
                  </li>
                  <li>
                    미팅(구조값):{' '}
                    <span className="font-mono text-bt-title">
                      {formatMeetingFromStructured(detail.structuredSignalsPreview, null)}
                    </span>
                  </li>
                </ul>
              </div>
            ) : null}
            {detail?.structuredSignalsPreview?.shoppingRows &&
            detail.structuredSignalsPreview.shoppingRows.length > 0 ? (
              <div className="mt-2 rounded border border-bt-border-soft bg-bt-surface-soft p-2">
                <p className="mb-1 text-[11px] font-medium text-bt-muted">
                  쇼핑 (structuredSignals.shoppingStructured.rows)
                </p>
                {detail.structuredSignalsPreview.shoppingVisitCount != null ? (
                  <p className="mb-1 text-[11px] text-bt-body">
                    방문 횟수(요약 shoppingVisitCount):{' '}
                    <span className="font-mono font-semibold">{detail.structuredSignalsPreview.shoppingVisitCount}</span>
                  </p>
                ) : null}
                <ul className="max-h-48 space-y-1 overflow-y-auto text-[11px]">
                  {detail.structuredSignalsPreview.shoppingRows.map((row, i) => (
                    <li key={i} className="rounded border border-bt-border-soft bg-bt-surface px-2 py-1">
                      <span className="font-semibold text-bt-title">{row.city ?? '—'}</span> · {row.shopName ?? '—'}
                      <div className="mt-0.5 text-bt-meta">{row.shopLocation ?? '—'}</div>
                      <div className="mt-0.5">
                        품목: {row.itemsText ?? row.shoppingItem} · 소요 {row.durationText || '—'}
                      </div>
                      {row.noteText?.includes('__hanatour_shopping_row_issue__') ? (
                        <div className="mt-0.5 text-amber-800">
                          파싱 이슈: {row.noteText.replace(/^__hanatour_shopping_row_issue__:\s*/i, '')}
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {!canApprove && (
              <p className="mt-2 text-xs text-bt-danger">
                등록 확정 전, 출발일 가격/상태(ProductDeparture)와 원문 일정표(ItineraryDay)가 먼저 수집되어야 합니다.
              </p>
            )}
            {canApprove && (
              <div className="mt-3 space-y-3">
                <div className="rounded border border-bt-border-soft bg-bt-surface-soft p-2">
                  <p className="mb-1 text-[11px] font-medium text-bt-muted">출발일/가격 상세 미리보기</p>
                  <div className="overflow-auto">
                    <table className="min-w-full border border-bt-border-soft bg-bt-surface text-xs">
                      <thead className="bg-bt-surface-alt">
                        <tr>
                          <th className="border px-1 py-1">date</th>
                          <th className="border px-1 py-1">adult</th>
                          <th className="border px-1 py-1">status</th>
                          <th className="border px-1 py-1">seats</th>
                          <th className="border px-1 py-1">minPax</th>
                          <th className="border px-1 py-1">carrier/flight</th>
                          <th className="border px-1 py-1">meeting</th>
                        </tr>
                      </thead>
                      <tbody>
                        {departureRows.slice(0, 10).map((r) => (
                          <tr key={`${r.departureDate}_${r.outboundFlightNo ?? ''}`}>
                            <td className="border px-1 py-1">{r.departureDate.slice(0, 10)}</td>
                            <td className="border px-1 py-1">{r.adultPrice ?? '-'}</td>
                            <td className="border px-1 py-1">{r.statusRaw ?? '-'}</td>
                            <td className="border px-1 py-1">
                              {formatSeatsCell(detail?.structuredSignalsPreview ?? null, r.seatsStatusRaw)}
                            </td>
                            <td className="border px-1 py-1">{r.minPax ?? '-'}</td>
                            <td className="border px-1 py-1">{r.carrierName ?? '-'} / {r.outboundFlightNo ?? '-'}</td>
                            <td className="border px-1 py-1">
                              {formatMeetingFromStructured(detail?.structuredSignalsPreview ?? null, r.meetingPointRaw)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="rounded border border-bt-border-soft bg-bt-surface-soft p-2">
                  <p className="mb-1 text-[11px] font-medium text-bt-muted">원문 일정표 상세 미리보기</p>
                  <div className="overflow-auto">
                    <table className="min-w-full border border-bt-border-soft bg-bt-surface text-xs">
                      <thead className="bg-bt-surface-alt">
                        <tr>
                          <th className="border px-1 py-1">day</th>
                          <th className="border px-1 py-1">date</th>
                          <th className="border px-1 py-1">city</th>
                          <th className="border px-1 py-1">poi/summary</th>
                          <th className="border px-1 py-1">meals/accommodation</th>
                        </tr>
                      </thead>
                      <tbody>
                        {itineraryDayRows.slice(0, 10).map((r) => (
                          <tr key={`itd_${r.day}`}>
                            <td className="border px-1 py-1">{r.day}</td>
                            <td className="border px-1 py-1">{r.dateText ?? '-'}</td>
                            <td className="border px-1 py-1">{r.city ?? '-'}</td>
                            <td className="border px-1 py-1">{r.poiNamesRaw ?? r.summaryTextRaw ?? '-'}</td>
                            <td className="border px-1 py-1">{r.meals ?? '-'} / {r.accommodation ?? '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </section>

      <section className="border-b border-bt-border-soft p-5">
        <h3 className="mb-0.5 text-sm font-semibold text-bt-body">일정 DAY 이미지 — 대표관광지 저장</h3>
        <p className="mb-3 text-[10px] text-bt-meta">
          저장 SSOT: <code className="rounded bg-bt-surface-alt px-1">Product.schedule[].imageKeyword</code> · Pexels·Gemini는 위
          저장값 우선(보조)
        </p>
        {dayImageMessage && <p className="mb-2 text-xs text-bt-body">{dayImageMessage}</p>}
        {scheduleDayRows.length === 0 ? (
          <p className="text-xs text-bt-meta">일정 day 정보가 없어 이미지를 선택할 수 없습니다.</p>
        ) : (
          <div className="space-y-3">
            {scheduleDayRows.map((row) => {
              const it = itineraryByDay.get(row.day)
              const candidates = dayCandidateMap[row.day] ?? []
              const geminiCandidates = dayGeminiMap[row.day] ?? []
              const libraryCandidates = dayLibraryMap[row.day] ?? []
              const sourceType = row.imageSource?.source ?? 'auto'
              const originBadge = getOriginBadge(row.imageCandidateOrigin)
              return (
                <div key={`day_img_${row.day}`} className="rounded border border-bt-border-soft bg-bt-surface-soft p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-semibold text-bt-body">DAY {row.day}</p>
                    <span
                      className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${
                        row.imageManualSelected
                          ? 'border-bt-warning bg-bt-badge-freeform text-bt-warning'
                          : 'border-bt-border-strong bg-bt-surface text-bt-muted'
                      }`}
                    >
                      {row.imageManualSelected ? '수동 잠금' : '자동 모드'}
                    </span>
                  </div>
                  <p className="text-[11px] text-bt-muted">
                    {it?.dateText ?? '-'} · {it?.city ?? '-'} · {it?.poiNamesRaw ?? it?.summaryTextRaw ?? row.imageKeyword ?? '-'}
                  </p>
                  <p className="mt-1 text-[11px] text-bt-meta">
                    자동 선정 근거: {normalizeOriginTag(row.imageCandidateOrigin)} / {row.imageKeyword ?? row.title ?? 'fallback'}
                  </p>
                  <p className="mt-0.5 text-[11px] text-bt-meta">
                    source type: {sourceType}
                    {row.imageSelectionMode ? ` / ${row.imageSelectionMode}` : ''}
                  </p>
                  {dayImageThumbError[row.day] ? (
                    <p className="mt-1 break-words text-[11px] text-bt-warning">{dayImageThumbError[row.day]}</p>
                  ) : null}
                  <p className="mt-0.5">
                    <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-medium ${originBadge.className}`}>
                      {originBadge.label}
                    </span>
                  </p>
                  <div className="mt-2 space-y-1">
                    <label className="text-[11px] font-medium text-bt-body" htmlFor={`day_kw_${row.day}`}>
                      대표관광지 저장
                    </label>
                    <p className="text-[10px] text-bt-meta">
                      즉시 DB 반영 · 권장: {'{장소명} / {대표 배경} / {대표 시점}'} · 예: 루브르 박물관 / 유리 피라미드 광장 / 정면 시점
                    </p>
                    <div className="flex max-w-xl flex-wrap items-center gap-2">
                      <input
                        id={`day_kw_${row.day}`}
                        type="text"
                        className="min-w-[10rem] flex-1 rounded border border-bt-border-soft bg-bt-surface px-2 py-1 text-xs text-bt-body"
                        placeholder={
                          row.imageKeyword
                            ? `비우면 자동 추천: ${row.imageKeyword}`
                            : '장소명 / 대표 배경 / 대표 시점 — 예: 후시미 이나리 신사 / 천본도리 붉은 도리이 길 / 눈높이 정면 시점'
                        }
                        value={dayImageKeywordDraft[row.day] ?? row.imageKeyword ?? ''}
                        onChange={(e) =>
                          setDayImageKeywordDraft((prev) => ({ ...prev, [row.day]: e.target.value }))
                        }
                        autoComplete="off"
                      />
                      <button
                        type="button"
                        disabled={dayImageSaving[row.day] === true}
                        onClick={() => void handleSaveDayImageKeyword(row.day)}
                        className="rounded border border-bt-border-strong bg-bt-surface px-2 py-1 text-xs font-medium text-bt-title hover:bg-bt-surface-soft disabled:opacity-50"
                      >
                        대표관광지 저장
                      </button>
                    </div>
                  </div>
                  <div className="mt-2 flex items-start gap-3">
                    <div className="h-16 w-24 overflow-hidden rounded border border-bt-border-soft bg-bt-surface-alt">
                      {row.imageUrl ? (
                        <img
                          src={adminPreviewImgSrc(row.imageUrl) ?? row.imageUrl}
                          alt=""
                          className="h-full w-full object-cover"
                          onLoad={() =>
                            setDayImageThumbError((prev) => ({ ...prev, [row.day]: null }))
                          }
                          onError={() => {
                            const raw = String(row.imageUrl ?? '').trim()
                            let host = ''
                            try {
                              host = new URL(raw).hostname
                            } catch {
                              host = 'URL 파싱 실패'
                            }
                            setDayImageThumbError((prev) => ({
                              ...prev,
                              [row.day]:
                                `${host}: 브라우저에서 이미지를 열 수 없습니다. DB에는 URL이 저장된 상태일 수 있습니다. 객체 읽기 권한·버킷 공개 정책·SUPABASE_URL·SUPABASE_IMAGE_BUCKET을 확인하세요.`,
                            }))
                          }}
                        />
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void handleLoadDayCandidates(row)}
                        disabled={dayCandidateLoading[row.day] === true}
                        className="rounded border border-bt-border-strong bg-bt-surface px-2 py-1 text-xs text-bt-body hover:bg-bt-surface-soft disabled:opacity-50"
                        title="저장된 대표관광지 값으로 Pexels 검색(미리보기 전용)"
                      >
                        {dayCandidateLoading[row.day] ? '후보 불러오는 중… (Pexels)' : '후보 미리보기'}
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleGenerateDayGemini(row)}
                        disabled={dayGeminiLoading[row.day] === true}
                        className="rounded border border-bt-border-strong bg-bt-surface px-2 py-1 text-xs text-bt-body hover:bg-bt-surface-soft"
                        title="저장값(promptOverride) 기준 4슬롯 생성 · 미저장 시 자동 추천 문자열이 fallback"
                      >
                        {dayGeminiLoading[row.day] ? '생성 중… (Gemini)' : 'Gemini 생성 (저장값 기준)'}
                      </button>
                      <button
                        type="button"
                        onClick={() => void clearDayManualSelection(row.day)}
                        disabled={dayImageSaving[row.day] === true}
                        className="rounded border border-bt-border-strong bg-bt-surface px-2 py-1 text-xs text-bt-body hover:bg-bt-surface-soft disabled:opacity-50"
                      >
                        자동 복귀
                      </button>
                      <button
                        type="button"
                        onClick={() => void openLibraryModal(row.day)}
                        disabled={dayLibraryLoading[row.day] === true}
                        className="rounded border border-bt-border-strong bg-bt-surface px-2 py-1 text-xs text-bt-body hover:bg-bt-surface-soft disabled:opacity-50"
                      >
                        라이브러리 열기
                      </button>
                      <label className="cursor-pointer rounded border border-bt-border-strong bg-bt-surface px-2 py-1 text-xs text-bt-body hover:bg-bt-surface-soft">
                        수동 업로드
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.currentTarget.files?.[0] ?? null
                            void handleUploadDayImage(row.day, f)
                            e.currentTarget.value = ''
                          }}
                        />
                      </label>
                      <span className="self-center text-[10px] text-bt-meta">업로드 최대 30MB / WEBP 정규화</span>
                    </div>
                  </div>
                  {dayGeminiError[row.day] ? (
                    <p className="mt-1 break-words text-xs text-bt-warning">{dayGeminiError[row.day]}</p>
                  ) : null}
                  {candidates.length > 0 && (
                    <div className="mt-2">
                      <p className="mb-1 text-[10px] font-medium text-bt-muted">사진 후보 (Pexels · 저장값 기준 미리보기)</p>
                      <div className="grid grid-cols-4 gap-2">
                        {candidates.map((photo) => (
                          <button
                            key={`${row.day}_${photo.id}`}
                            type="button"
                            onClick={() =>
                              void saveDayImageSelection(row.day, {
                                imageUrl: photo.large || photo.medium,
                                source: 'pexels',
                                photographer: photo.photographer,
                                originalLink: photo.sourceUrl,
                                externalId: String(photo.id),
                                selectionMode: 'manual-pick',
                              })
                            }
                            disabled={dayImageSaving[row.day] === true}
                            title="이 사진을 일정 이미지로 적용"
                            className="overflow-hidden rounded border border-bt-border-soft bg-bt-surface text-left disabled:opacity-50"
                          >
                            <img
                              src={adminPreviewImgSrc(photo.thumbnail) ?? photo.thumbnail}
                              alt=""
                              className="aspect-video w-full object-cover"
                            />
                            <span className="block truncate px-1 py-0.5 text-[9px] text-bt-meta">일정 이미지로 적용</span>
                            <span className="block truncate px-1 py-0.5 text-[10px] text-bt-muted">{photo.photographer}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {geminiCandidates.length > 0 && (
                    <div className="mt-2">
                      <p className="mb-1 text-[10px] font-medium text-bt-muted">
                        Gemini 4슬롯 후보 (저장값 기준 생성 · 탭하여 일정에 적용)
                      </p>
                      <div className="grid grid-cols-4 gap-2">
                        {geminiCandidates.map((item, gIdx) => (
                          <button
                            key={`${row.day}_${item.slot}_${gIdx}`}
                            type="button"
                            onClick={() =>
                              item.imageUrl
                                ? void saveDayImageSelection(row.day, {
                                    imageUrl: item.imageUrl,
                                    source: 'gemini',
                                    photographer: null,
                                    originalLink: null,
                                    externalId: null,
                                    selectionMode: 'manual-pick',
                                  })
                                : undefined
                            }
                            disabled={dayImageSaving[row.day] === true || !item.imageUrl}
                            title={
                              item.imageUrl
                                ? `${geminiSlotLabelKr(item.slot)} — 일정 이미지로 적용`
                                : `${geminiSlotLabelKr(item.slot)} — 생성 실패`
                            }
                            className="flex flex-col overflow-hidden rounded border border-bt-border-soft bg-bt-surface text-left disabled:opacity-50"
                          >
                            <span className="w-full truncate bg-bt-surface-alt px-1 py-0.5 text-left text-[10px] font-semibold text-bt-body">
                              {geminiSlotLabelKr(item.slot)}
                            </span>
                            {item.imageUrl ? (
                              <img
                                src={adminPreviewImgSrc(item.imageUrl) ?? item.imageUrl ?? ''}
                                alt=""
                                className="aspect-video w-full object-cover"
                              />
                            ) : (
                              <div className="flex aspect-video w-full flex-col items-center justify-center bg-bt-surface-alt px-1 py-2 text-center">
                                <span className="text-[10px] font-medium text-bt-warning">생성 실패</span>
                                <span className="mt-0.5 text-[9px] text-bt-meta">{geminiSlotLabelKr(item.slot)}</span>
                                {item.error ? (
                                  <span className="mt-1 max-h-20 w-full overflow-y-auto break-all text-left text-[8px] leading-tight text-bt-warning">
                                    {item.error}
                                  </span>
                                ) : null}
                              </div>
                            )}
                            <span className="truncate px-1 py-1 text-[9px] text-bt-muted">
                              {item.imageUrl ? '일정 이미지로 적용' : '이 슬롯은 선택 불가'}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {libraryCandidates.length > 0 && (
                    <div className="mt-2 grid grid-cols-4 gap-2">
                      {libraryCandidates.map((item) => (
                        <button
                          key={`${row.day}_${item.imageUrl}_${item.externalId ?? ''}`}
                          type="button"
                          onClick={() =>
                            void saveDayImageSelection(row.day, {
                              imageUrl: item.imageUrl,
                              source: item.source || 'library-reuse',
                              photographer: item.photographer ?? null,
                              originalLink: item.sourceUrl ?? null,
                              externalId: item.externalId ?? null,
                              selectionMode: 'library-reuse',
                            })
                          }
                          disabled={dayImageSaving[row.day] === true}
                          className="overflow-hidden rounded border border-bt-border-soft bg-bt-surface text-left disabled:opacity-50"
                        >
                          <img
                            src={adminPreviewImgSrc(item.imageUrl) ?? item.imageUrl ?? ''}
                            alt=""
                            className="aspect-video w-full object-cover"
                          />
                          <span className="block truncate px-1 py-1 text-[10px] text-bt-muted">{item.label}</span>
                          <span
                            className="block truncate px-1 pb-1 text-[9px] text-bt-meta"
                            title={item.source ? `source_type=${item.source}` : undefined}
                          >
                            출처: {item.source ? adminProductBgImageSourceTypeLabel(item.source) : '—'}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
        {libraryModalOpen && libraryModalDay != null && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
            <div className="flex max-h-[85vh] min-h-0 w-full max-w-6xl flex-col overflow-hidden rounded-lg border border-bt-border-strong bg-bt-surface shadow-xl">
              <div className="flex shrink-0 items-center justify-between border-b border-bt-border-soft px-4 py-3">
                <h4 className="text-sm font-semibold text-bt-strong">DAY {libraryModalDay} 전용 라이브러리 선택</h4>
                <button
                  type="button"
                  onClick={closeLibraryModal}
                  className="rounded border border-bt-border-strong bg-bt-surface px-2 py-1 text-xs text-bt-body hover:bg-bt-surface-soft"
                >
                  닫기
                </button>
              </div>
              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain p-4">
                <div className="flex flex-wrap items-center gap-2 rounded border border-bt-border-soft bg-bt-surface-soft p-2">
                  <select
                    value={librarySourceType}
                    onChange={(e) => setLibrarySourceType(e.target.value)}
                    className="rounded border border-bt-border-strong bg-bt-surface px-2 py-1 text-xs text-bt-body"
                  >
                    <option value="all">전체 source</option>
                    <option value="pexels">pexels</option>
                    <option value="gemini">gemini</option>
                    <option value="manual-upload">manual-upload</option>
                    <option value="library-reuse">library-reuse</option>
                  </select>
                  <select
                    value={librarySort}
                    onChange={(e) => setLibrarySort(e.target.value as 'recent-upload' | 'recent-used' | 'most-used')}
                    className="rounded border border-bt-border-strong bg-bt-surface px-2 py-1 text-xs text-bt-body"
                  >
                    <option value="recent-upload">최근 업로드순</option>
                    <option value="recent-used">최근 사용순</option>
                    <option value="most-used">사용 많은순</option>
                  </select>
                  <input
                    value={libraryKeyword}
                    onChange={(e) => setLibraryKeyword(e.target.value)}
                    placeholder="도시/POI 키워드"
                    className="min-w-[220px] rounded border border-bt-border-strong px-2 py-1 text-xs text-bt-body"
                  />
                  <button
                    type="button"
                    onClick={() => void handleLoadDayLibrary(libraryModalDay, 1)}
                    disabled={dayLibraryLoading[libraryModalDay] === true}
                    className="rounded border border-bt-border-strong bg-bt-surface px-2 py-1 text-xs text-bt-body hover:bg-bt-surface-soft disabled:opacity-50"
                  >
                    검색
                  </button>
                </div>

                {libraryFrequentAssets.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-semibold text-bt-muted">자주 쓰는 자산</p>
                    <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                      {libraryFrequentAssets.map((item) => (
                        <button
                          key={`frequent_${item.externalId ?? ''}_${item.imageUrl}`}
                          type="button"
                          onClick={() => void selectLibraryAssetForDay(libraryModalDay, item)}
                          className="overflow-hidden rounded border border-bt-border-soft bg-bt-surface text-left"
                        >
                          <img
                            src={adminPreviewImgSrc(item.imageUrl) ?? item.imageUrl ?? ''}
                            alt=""
                            className="aspect-video w-full object-cover"
                          />
                          <span className="block truncate px-1 py-1 text-[10px] text-bt-muted">{item.label}</span>
                          <span
                            className="block truncate px-1 pb-1 text-[9px] text-bt-meta"
                            title={item.source ? `source_type=${item.source}` : undefined}
                          >
                            출처: {item.source ? adminProductBgImageSourceTypeLabel(item.source) : '—'}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  {(dayLibraryMap[libraryModalDay] ?? []).map((item) => {
                    const key = `${item.externalId ?? ''}_${item.imageUrl}`
                    const historyOpen = libraryHistoryOpenMap[key] === true
                    return (
                      <div key={key} className="overflow-hidden rounded border border-bt-border-soft bg-bt-surface">
                        <img
                            src={adminPreviewImgSrc(item.imageUrl) ?? item.imageUrl ?? ''}
                            alt=""
                            className="aspect-video w-full object-cover"
                          />
                        <div className="space-y-1 px-2 py-2">
                          <p className="truncate text-[10px] text-bt-muted">{item.label}</p>
                          <p
                            className="truncate text-[9px] text-bt-meta"
                            title={item.source ? `source_type=${item.source}` : undefined}
                          >
                            출처: {item.source ? adminProductBgImageSourceTypeLabel(item.source) : '—'}
                          </p>
                          <button
                            type="button"
                            onClick={() => void selectLibraryAssetForDay(libraryModalDay, item)}
                            className="w-full rounded border border-bt-border-strong bg-bt-surface px-2 py-1 text-[10px] text-bt-body hover:bg-bt-surface-soft"
                          >
                            일정 이미지로 적용
                          </button>
                          <button
                            type="button"
                            onClick={() => setLibraryHistoryOpenMap((prev) => ({ ...prev, [key]: !historyOpen }))}
                            className="w-full rounded border border-bt-border-soft bg-bt-surface-soft px-2 py-1 text-[10px] text-bt-muted hover:bg-bt-surface-alt"
                          >
                            사용 이력 {historyOpen ? '숨기기' : '펼치기'}
                          </button>
                          {historyOpen && (
                            <div className="rounded border border-bt-border-soft bg-bt-surface-soft p-1 text-[10px] text-bt-muted">
                              {(item.usedIn ?? []).length > 0 ? (item.usedIn ?? []).join(', ') : '사용 이력 없음'}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
              <div className="flex shrink-0 items-center justify-between border-t border-bt-border-soft bg-bt-surface px-4 py-2">
                <p className="text-xs text-bt-muted">페이지 {libraryPage} / {libraryTotalPages}</p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void handleLoadDayLibrary(libraryModalDay, Math.max(1, libraryPage - 1))}
                    disabled={libraryPage <= 1 || dayLibraryLoading[libraryModalDay] === true}
                    className="rounded border border-bt-border-strong bg-bt-surface px-2 py-1 text-xs text-bt-body disabled:opacity-50"
                  >
                    이전
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleLoadDayLibrary(libraryModalDay, Math.min(libraryTotalPages, libraryPage + 1))}
                    disabled={libraryPage >= libraryTotalPages || dayLibraryLoading[libraryModalDay] === true}
                    className="rounded border border-bt-border-strong bg-bt-surface px-2 py-1 text-xs text-bt-body disabled:opacity-50"
                  >
                    다음
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* 상품 단위 대표 썸네일 — 일차별 키워드는 위「일정 DAY」에서 저장 */}
      <section className="border-b border-bt-border-soft p-5">
        <h3 className="mb-0.5 text-sm font-semibold text-bt-body">상품 대표 이미지 수급</h3>
        <p className="mb-3 text-[10px] text-bt-meta">
          일정 이미지 SSOT는 위에서 <strong className="font-medium text-bt-muted">대표관광지 저장</strong>. 여기는 상품 썸네일용 — 자산 → Pexels
          후보 미리보기 → Gemini(보조·상품 단위) 순으로 쓰면 됩니다.
        </p>
        {/* 현재 대표 이미지 */}
        <div className="mb-4 rounded-lg border border-bt-border-soft bg-bt-surface-soft p-3">
          <p className="mb-2 text-xs font-medium text-bt-muted">현재 대표 이미지</p>
          {detail.bgImageUrl ? (
            <div className="flex items-start gap-3">
              <a
                href={detail.bgImageSourceUrl ?? detail.bgImageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block h-16 w-24 shrink-0 overflow-hidden rounded border border-bt-border-soft bg-bt-surface-alt"
              >
                <img
                  src={adminPreviewImgSrc(detail.bgImageUrl) ?? detail.bgImageUrl ?? ''}
                  alt=""
                  className="h-full w-full object-cover"
                />
              </a>
              <div className="min-w-0 text-xs text-bt-muted">
                <p title={detail.bgImageSource ? `bgImageSource=${detail.bgImageSource}` : undefined}>
                  출처: {adminProductBgImageAttributionLine(detail.bgImageSource, detail.bgImageIsGenerated ?? null)}
                </p>
                {detail.bgImagePhotographer && <p className="mt-0.5">작가: {detail.bgImagePhotographer}</p>}
              </div>
            </div>
          ) : (
            <p className="text-xs text-bt-meta">
              대표 이미지 없음. 도시/관광지 자산을 먼저 보거나, 목적지·분류 키워드로 Pexels 후보 미리보기를 쓰세요.
            </p>
          )}
        </div>
        {primaryImageMessage && (
          <p className={`mb-2 text-xs ${primaryImageMessage.startsWith('대표') ? 'text-bt-badge-domestic-text' : 'text-bt-warning'}`}>
            {primaryImageMessage}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleLoadAssetCandidates}
            disabled={pexelsLoading || geminiLoading || assetsLoading || primaryImageManualUploading}
            className="rounded-lg border border-bt-brand-blue-strong bg-bt-surface px-3 py-2 text-sm font-medium text-bt-title hover:bg-bt-brand-blue-soft disabled:opacity-50"
          >
            {assetsLoading ? '불러오는 중…' : '도시/관광지 자산에서 가져오기'}
          </button>
          <button
            type="button"
            onClick={handlePexelsSearch}
            disabled={pexelsLoading || primaryImageManualUploading}
            className="rounded-lg border border-bt-brand-blue-strong bg-bt-surface px-3 py-2 text-sm font-medium text-bt-title hover:bg-bt-brand-blue-soft disabled:opacity-50"
            title="상품 메타·목적지 기준 Pexels 검색(미리보기 전용)"
          >
            {pexelsLoading ? '후보 불러오는 중… (Pexels)' : '후보 미리보기'}
          </button>
          <button
            type="button"
            onClick={() => void handleGeminiGenerate()}
            disabled={pexelsLoading || geminiLoading || primaryImageManualUploading}
            className="rounded-lg border border-bt-border-strong bg-bt-surface px-3 py-2 text-sm font-medium text-bt-muted hover:bg-bt-surface-soft disabled:opacity-50"
            title="상품 단위 자동 프롬프트로 4슬롯 생성(보조). 일정 DAY는 위에서 저장값 기준."
          >
            {geminiLoading ? '생성 중… (Gemini)' : 'Gemini 생성 (보조 · 상품 단위)'}
          </button>
        </div>
        <div className="mt-3 space-y-2 rounded-lg border border-bt-border-soft bg-bt-surface-soft p-3">
          <p className="text-[10px] font-medium text-bt-muted">대표 이미지 파일 업로드(상품 상세와 동일 경로)</p>
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-xs">
              <span className="block text-bt-muted">이미지 출처</span>
              <select
                className="mt-0.5 rounded border border-bt-border-strong bg-bt-surface px-2 py-1.5 text-xs text-bt-body"
                value={manualHeroUploadPreset}
                disabled={
                  primaryImageManualUploading ||
                  primaryImageSavingId !== null ||
                  pexelsLoading ||
                  geminiLoading ||
                  assetsLoading
                }
                onChange={(ev) => setManualHeroUploadPreset(ev.target.value as AdminManualPrimaryHeroUploadPreset)}
              >
                {ADMIN_MANUAL_PRIMARY_HERO_UPLOAD_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            {manualHeroUploadPreset === 'other' ? (
              <label className="text-xs">
                <span className="block text-bt-muted">기타 출처 설명</span>
                <input
                  className="mt-0.5 w-44 max-w-full rounded border border-bt-border-strong bg-bt-surface px-2 py-1.5 text-xs text-bt-body"
                  value={manualHeroUploadOtherNote}
                  disabled={
                    primaryImageManualUploading ||
                    primaryImageSavingId !== null ||
                    pexelsLoading ||
                    geminiLoading ||
                    assetsLoading
                  }
                  onChange={(ev) => setManualHeroUploadOtherNote(ev.target.value)}
                  placeholder="표기용 짧은 이름"
                />
              </label>
            ) : null}
            <label
              className={`cursor-pointer rounded-lg border border-bt-border-strong bg-bt-surface px-3 py-2 text-xs font-medium text-bt-body hover:bg-bt-surface-soft ${
                primaryImageManualUploading ||
                primaryImageSavingId !== null ||
                pexelsLoading ||
                geminiLoading ||
                assetsLoading
                  ? 'pointer-events-none opacity-50'
                  : ''
              }`}
            >
              {primaryImageManualUploading ? '업로드 중…' : '대표 이미지 파일 업로드'}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={
                  primaryImageManualUploading ||
                  primaryImageSavingId !== null ||
                  pexelsLoading ||
                  geminiLoading ||
                  assetsLoading
                }
                onChange={(ev) => void handlePendingManualPrimaryHeroUpload(ev)}
              />
            </label>
          </div>
          <p className="text-[10px] text-bt-meta">사진풀 저장 후 이 상품 대표 이미지로 연결됩니다. 파일당 최대 30MB.</p>
          <p className="text-[10px] text-bt-meta">
            갤러리 등 추가 이미지는{' '}
            <Link
              href={`/admin/image-assets-upload?productId=${encodeURIComponent(detail.id)}`}
              className="font-medium text-bt-link underline"
            >
              상품 이미지 업로드
            </Link>
            에서 파일·출처만 선택하세요.
          </p>
        </div>
        {pexelsQuery != null && (
          <p className="mt-2 text-xs text-bt-meta">
            마지막 미리보기 검색어 (Pexels): <span className="font-medium text-bt-body">{pexelsQuery}</span>
          </p>
        )}
        {pexelsError && <p className="mt-1 text-xs text-bt-warning">{pexelsError}</p>}
        {pexelsPhotos.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-xs font-medium text-bt-muted">사진 후보 미리보기 ({pexelsPhotos.length}건, Pexels)</p>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {pexelsPhotos.map((photo) => (
                <div key={photo.id} className="overflow-hidden rounded-lg border border-bt-border-soft bg-bt-surface-soft">
                  <a
                    href={photo.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block aspect-video w-full bg-bt-surface-alt"
                  >
                    <img
                      src={
                        adminPreviewImgSrc(photo.medium || photo.thumbnail) ??
                        photo.medium ??
                        photo.thumbnail ??
                        ''
                      }
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  </a>
                  <p className="truncate px-2 py-1 text-xs text-bt-meta" title={photo.photographer}>
                    {photo.photographer}
                  </p>
                  <button
                    type="button"
                    onClick={() => handleSetPrimaryImage(photo)}
                    disabled={primaryImageSavingId !== null || primaryImageManualUploading}
                    className="w-full border-t border-bt-border-soft py-1.5 text-xs font-medium text-bt-title hover:bg-bt-surface-alt disabled:opacity-50"
                  >
                    {primaryImageSavingId === photo.id ? '저장 중…' : '대표 이미지로 선택'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
        {!pexelsLoading && pexelsQuery != null && pexelsPhotos.length === 0 && !pexelsError && (
          <p className="mt-2 text-xs text-bt-meta">결과가 없습니다. 2차 분류(대표 지역·노출 카테고리)를 저장한 뒤 다시 검색해 보세요.</p>
        )}
        {assetsError && <p className="mt-2 text-xs text-bt-warning">{assetsError}</p>}
        {(assetsAttractionCandidates.length > 0 || assetsCityCandidates.length > 0) && (
          <div className="mt-4 space-y-4">
            {/* 관광지 자산(우선순위 2) — 원문에 등장한 관광지 매칭 */}
            {assetsAttractionCandidates.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold text-bt-body">관광지 자산 후보 ({assetsAttractionCandidates.length}장)</p>
                <p className="mb-2 text-[10px] text-bt-meta">상품 제목·목적지에 등장한 관광지와 매칭된 자산. 재사용 우선순위 상.</p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {assetsAttractionCandidates.map((candidate) => (
                    <div key={candidate.imageUrl + (candidate.externalId ?? '')} className="overflow-hidden rounded-lg border border-bt-border-soft bg-bt-surface-soft">
                      <a
                        href={candidate.sourceUrl ?? candidate.imageUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block aspect-video w-full bg-bt-surface-alt"
                      >
                        <img
                          src={adminPreviewImgSrc(candidate.imageUrl) ?? candidate.imageUrl ?? ''}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      </a>
                      <p className="truncate px-2 py-1 text-xs font-medium text-bt-body" title={candidate.label}>
                        {candidate.label}
                      </p>
                      {candidate.photographer && (
                        <p className="truncate px-2 pb-0.5 text-xs text-bt-meta">{candidate.photographer}</p>
                      )}
                      <button
                        type="button"
                        onClick={() => handleSetPrimaryImageFromAsset(candidate)}
                        disabled={primaryImageSavingId !== null || primaryImageManualUploading}
                        className="w-full border-t border-bt-border-soft py-1.5 text-xs font-medium text-bt-title hover:bg-bt-surface-alt disabled:opacity-50"
                      >
                        {primaryImageSavingId === candidate.imageUrl ? '저장 중…' : '대표 이미지로 선택'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {/* 도시 자산(우선순위 3) — DestinationImageSet·PhotoPool 도시 메인 */}
            {assetsCityCandidates.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold text-bt-body">도시 자산 후보 ({assetsCityCandidates.length}장)</p>
                <p className="mb-2 text-[10px] text-bt-meta">도시 대표·사진풀. 관광지 매칭이 없을 때 활용.</p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {assetsCityCandidates.map((candidate) => (
                    <div key={candidate.imageUrl + (candidate.externalId ?? '')} className="overflow-hidden rounded-lg border border-bt-border-soft bg-bt-surface-soft">
                      <a
                        href={candidate.sourceUrl ?? candidate.imageUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block aspect-video w-full bg-bt-surface-alt"
                      >
                        <img
                          src={adminPreviewImgSrc(candidate.imageUrl) ?? candidate.imageUrl ?? ''}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      </a>
                      <p className="truncate px-2 py-1 text-xs font-medium text-bt-body" title={candidate.label}>
                        {candidate.label}
                      </p>
                      {candidate.photographer && (
                        <p className="truncate px-2 pb-0.5 text-xs text-bt-meta">{candidate.photographer}</p>
                      )}
                      <button
                        type="button"
                        onClick={() => handleSetPrimaryImageFromAsset(candidate)}
                        disabled={primaryImageSavingId !== null || primaryImageManualUploading}
                        className="w-full border-t border-bt-border-soft py-1.5 text-xs font-medium text-bt-title hover:bg-bt-surface-alt disabled:opacity-50"
                      >
                        {primaryImageSavingId === candidate.imageUrl ? '저장 중…' : '대표 이미지로 선택'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        {geminiError && <p className="mt-2 text-xs text-bt-warning">{geminiError}</p>}
        {geminiResult && !geminiPromptEditMode && (
          <div className="mt-4 rounded-lg border border-bt-border-soft bg-bt-surface-soft/50 p-3">
            <p className="mb-0.5 text-[10px] text-bt-meta">
              상품 단위 보조 생성. 일정 이미지는 위「대표관광지 저장」이 본체. 자산·Pexels로 부족할 때만 사용.
            </p>
            <p className="mb-1 text-xs font-medium text-bt-muted">
              Gemini 4슬롯 후보 (상품 메타 기준 · {geminiResult.images.length}장)
            </p>
            <p className="mb-2 text-xs text-bt-meta">
              사용된 프롬프트: <span className="font-medium text-bt-body">{geminiResult.promptUsed}</span>
            </p>
            <div className="mb-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleGeminiGenerate()}
                disabled={geminiLoading}
                className="rounded-lg border border-bt-border-strong bg-bt-surface px-3 py-1.5 text-xs font-medium text-bt-body hover:bg-bt-surface-soft disabled:opacity-50"
              >
                {geminiLoading ? '생성 중…' : '다시 생성'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setGeminiEditedPrompt(geminiResult.promptUsed)
                  setGeminiPromptEditMode(true)
                }}
                disabled={geminiLoading}
                className="rounded-lg border border-bt-border-strong bg-bt-surface px-3 py-1.5 text-xs font-medium text-bt-body hover:bg-bt-surface-soft disabled:opacity-50"
              >
                프롬프트 수정
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {geminiResult.images.map((item, gi) => (
                <div
                  key={`${item.slot}_${gi}`}
                  className="flex flex-col overflow-hidden rounded-lg border border-bt-border-soft bg-bt-surface-soft"
                >
                  <span className="truncate bg-bt-surface-alt px-2 py-0.5 text-left text-[10px] font-semibold text-bt-body">
                    {geminiSlotLabelKr(item.slot)}
                  </span>
                  {item.imageUrl ? (
                    <img
                      src={adminPreviewImgSrc(item.imageUrl) ?? item.imageUrl ?? ''}
                      alt=""
                      className="aspect-video w-full object-cover"
                    />
                  ) : (
                    <div className="flex aspect-video w-full flex-col items-center justify-center bg-bt-surface-alt px-2 py-2 text-center">
                      <span className="text-[11px] font-medium text-bt-warning">생성 실패</span>
                      <span className="mt-0.5 text-[10px] text-bt-meta">{geminiSlotLabelKr(item.slot)}</span>
                      {item.error ? (
                        <span className="mt-1 max-h-24 w-full overflow-y-auto break-all text-left text-[9px] leading-tight text-bt-warning">
                          {item.error}
                        </span>
                      ) : null}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => item.imageUrl && handleSetPrimaryImageFromGemini(item.imageUrl)}
                    disabled={primaryImageSavingId !== null || !item.imageUrl || primaryImageManualUploading}
                    className="w-full border-t border-bt-border-soft py-1.5 text-xs font-medium text-bt-title hover:bg-bt-surface-alt disabled:opacity-50"
                  >
                    {primaryImageSavingId === item.imageUrl ? '저장 중…' : '대표 이미지로 선택'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
        {geminiResult && geminiPromptEditMode && (
          <div className="mt-4 rounded-lg border border-bt-border-soft bg-bt-surface-soft p-3">
            <p className="mb-2 text-xs font-medium text-bt-muted">프롬프트 수정 후 다시 생성</p>
            <textarea
              value={geminiEditedPrompt}
              onChange={(e) => setGeminiEditedPrompt(e.target.value)}
              placeholder="영문 장면 설명 (최대 500자)"
              rows={3}
              maxLength={500}
              className="mb-2 w-full resize-y rounded border border-bt-border-strong px-3 py-2 text-sm text-bt-strong placeholder:text-bt-subtle focus:border-bt-brand-blue-strong focus:outline-none focus:ring-2 focus:ring-bt-brand-blue-soft"
            />
            <p className="mb-2 text-xs text-bt-meta">{geminiEditedPrompt.length}/500</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleGeminiGenerate(geminiEditedPrompt)}
                disabled={geminiLoading}
                className="rounded-lg border border-bt-brand-blue-strong bg-bt-surface px-3 py-1.5 text-xs font-medium text-bt-title hover:bg-bt-brand-blue-soft disabled:opacity-50"
              >
                {geminiLoading ? '생성 중…' : '이 프롬프트로 다시 생성'}
              </button>
              <button
                type="button"
                onClick={() => setGeminiPromptEditMode(false)}
                disabled={geminiLoading}
                className="rounded-lg border border-bt-border-strong bg-bt-surface px-3 py-1.5 text-xs font-medium text-bt-muted hover:bg-bt-surface-soft disabled:opacity-50"
              >
                취소
              </button>
            </div>
          </div>
        )}
      </section>

      {/* 2차 분류 확정 패널 */}
      <section className="border-b border-bt-border-soft p-5">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-bt-meta">2차 분류 확정</h3>
        <div className="grid gap-3 text-sm">
          <div>
            <label className="mb-1 block text-xs font-medium text-bt-muted">대표 지역</label>
            <input
              type="text"
              value={primaryRegion}
              onChange={(e) => setPrimaryRegion(e.target.value)}
              placeholder="예: 동남아, 유럽"
              className="w-full rounded-lg border border-bt-border-strong px-3 py-2 text-bt-title placeholder:text-bt-subtle focus:border-bt-brand-blue-strong focus:outline-none focus:ring-2 focus:ring-bt-brand-blue-soft"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-bt-muted">테마 태그 (쉼표 구분)</label>
            <input
              type="text"
              value={themeTags}
              onChange={(e) => setThemeTags(e.target.value)}
              placeholder="예: 허니문, 오션뷰"
              className="w-full rounded-lg border border-bt-border-strong px-3 py-2 text-bt-title placeholder:text-bt-subtle focus:border-bt-brand-blue-strong focus:outline-none focus:ring-2 focus:ring-bt-brand-blue-soft"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-bt-muted">노출 카테고리</label>
            <input
              type="text"
              value={displayCategory}
              onChange={(e) => setDisplayCategory(e.target.value)}
              placeholder="예: 롯데몰노출, 메인베너"
              className="w-full rounded-lg border border-bt-border-strong px-3 py-2 text-bt-title placeholder:text-bt-subtle focus:border-bt-brand-blue-strong focus:outline-none focus:ring-2 focus:ring-bt-brand-blue-soft"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-bt-muted">타깃 고객 (쉼표 구분)</label>
            <input
              type="text"
              value={targetAudience}
              onChange={(e) => setTargetAudience(e.target.value)}
              placeholder="예: 성인가족, 신혼부부"
              className="w-full rounded-lg border border-bt-border-strong px-3 py-2 text-bt-title placeholder:text-bt-subtle focus:border-bt-brand-blue-strong focus:outline-none focus:ring-2 focus:ring-bt-brand-blue-soft"
            />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleSaveClassification}
            disabled={classificationSaving}
            className="rounded-lg bg-bt-cta-primary px-4 py-2 text-sm font-medium text-bt-cta-primary-fg hover:bg-bt-cta-primary-hover disabled:opacity-50"
          >
            {classificationSaving ? '저장 중…' : '분류 저장'}
          </button>
          {classificationMessage && (
            <span className={`text-sm ${classificationMessage === '저장되었습니다.' ? 'text-bt-badge-domestic-text' : 'text-bt-warning'}`}>
              {classificationMessage}
            </span>
          )}
        </div>
      </section>

      {/* 승인 / 보류 / 반려 */}
      <section className="p-5">
        {!showRejectForm ? (
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => onApproved(detail.id)}
              disabled={isRegistering || !canApprove}
              className="rounded-lg bg-bt-cta-primary px-4 py-2.5 text-sm font-medium text-bt-cta-primary-fg hover:bg-bt-cta-primary-hover disabled:opacity-50"
            >
              {isRegistering ? '처리 중…' : !canApprove ? '수집 완료 후 승인 가능' : '승인'}
            </button>
            <button
              type="button"
              onClick={() => onHold(detail.id)}
              disabled={isRegistering || isHolding || isRejecting}
              className="rounded-lg border border-bt-border-strong px-4 py-2.5 text-sm font-medium text-bt-body hover:bg-bt-surface-soft disabled:opacity-50"
            >
              {isHolding ? '처리 중…' : '보류'}
            </button>
            <button
              type="button"
              onClick={() => setShowRejectForm(true)}
              disabled={isRegistering || isHolding || isRejecting}
              className="rounded-lg border border-bt-danger px-4 py-2.5 text-sm font-medium text-bt-danger hover:bg-bt-surface-soft disabled:opacity-50"
            >
              반려
            </button>
          </div>
        ) : (
          <div className="rounded-lg border border-bt-danger bg-bt-surface-soft p-4">
            <label className="mb-2 block text-xs font-medium text-bt-body">반려 사유 (선택, 최대 200자)</label>
            <textarea
              value={rejectReasonText}
              onChange={(e) => setRejectReasonText(e.target.value.slice(0, 200))}
              placeholder="예: 중복 상품, 이미지 부족, 정보 불충분, 노출 부적합"
              rows={2}
              className="w-full rounded-lg border border-bt-border-strong bg-bt-surface px-3 py-2 text-sm text-bt-title placeholder:text-bt-subtle focus:border-bt-brand-blue-strong focus:outline-none focus:ring-2 focus:ring-bt-brand-blue-soft"
            />
            <p className="mt-1 text-xs text-bt-meta">{rejectReasonText.length}/200</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  onReject(detail.id, rejectReasonText.trim() || undefined)
                  setShowRejectForm(false)
                }}
                disabled={isRejecting}
                className="rounded-lg bg-bt-danger px-4 py-2 text-sm font-medium text-bt-inverse hover:opacity-90 disabled:opacity-50"
              >
                {isRejecting ? '처리 중…' : '반려 확인'}
              </button>
              <button
                type="button"
                onClick={() => setShowRejectForm(false)}
                disabled={isRejecting}
                className="rounded-lg border border-bt-border-strong px-4 py-2 text-sm font-medium text-bt-body hover:bg-bt-surface-soft disabled:opacity-50"
              >
                취소
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
