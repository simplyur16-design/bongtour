'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'

type EditorialItem = {
  id: string
  pageScope: string
  regionKey: string | null
  countryCode: string | null
  title: string
  subtitle: string | null
  bodyKr: string
  heroImageUrl: string | null
  heroImageAlt: string | null
  heroImageStorageKey: string | null
  heroImageWidth: number | null
  heroImageHeight: number | null
  sourceType: string | null
  sourceName: string | null
  sourceUrl: string | null
  seoTitle: string | null
  seoDescription: string | null
  slug: string | null
  isPublished: boolean
  sortOrder: number
  updatedAt: string
  privateTripHeroSlot?: boolean
  ctaLabel?: string | null
  ctaHref?: string | null
  cardTags?: string | null
}

type MonthlyItem = {
  id: string
  monthKey: string
  pageScope: string
  regionKey: string | null
  countryCode: string | null
  title: string
  subtitle: string | null
  bodyKr: string
  ctaLabel: string | null
  linkedProductId: string | null
  linkedHref: string | null
  imageUrl: string | null
  imageAlt: string | null
  imageStorageKey: string | null
  imageWidth: number | null
  imageHeight: number | null
  sourceType: string | null
  sourceName: string | null
  sourceUrl: string | null
  seoTitle: string | null
  seoDescription: string | null
  slug: string | null
  isPublished: boolean
  sortOrder: number
  updatedAt: string
}

const SOURCE_TYPE_OPTIONS = [
  { value: '', label: '(출처 유형)' },
  { value: 'self', label: '자체' },
  { value: 'stock', label: '스톡' },
  { value: 'partner', label: '제휴' },
  { value: 'press', label: '보도·자료' },
  { value: 'other', label: '기타' },
] as const

const blankEditorial = {
  pageScope: 'overseas',
  regionKey: '',
  countryCode: '',
  title: '',
  subtitle: '',
  bodyKr: '',
  heroImageUrl: '',
  heroImageAlt: '',
  heroImageStorageKey: '',
  heroImageWidth: '',
  heroImageHeight: '',
  sourceType: '',
  sourceName: '',
  sourceUrl: '',
  seoTitle: '',
  seoDescription: '',
  slug: '',
  isPublished: false,
  sortOrder: 0,
  privateTripHeroSlot: false,
  ctaLabel: '',
  ctaHref: '',
  cardTags: '',
}

const blankMonthly = {
  pageScope: 'overseas',
  monthKey: '',
  regionKey: '',
  countryCode: '',
  title: '',
  subtitle: '',
  bodyKr: '',
  ctaLabel: '',
  linkedProductId: '',
  linkedHref: '',
  imageUrl: '',
  imageAlt: '',
  imageStorageKey: '',
  imageWidth: '',
  imageHeight: '',
  sourceType: '',
  sourceName: '',
  sourceUrl: '',
  seoTitle: '',
  seoDescription: '',
  slug: '',
  isPublished: false,
  sortOrder: 0,
}

function isMonthKey(v: string): boolean {
  return /^\d{4}-\d{2}$/.test(v)
}

export default function OverseasContentAdminClient() {
  const [editorials, setEditorials] = useState<EditorialItem[]>([])
  const [monthlies, setMonthlies] = useState<MonthlyItem[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editingEditorialId, setEditingEditorialId] = useState<string | null>(null)
  const [editingMonthlyId, setEditingMonthlyId] = useState<string | null>(null)
  const [editorialForm, setEditorialForm] = useState(blankEditorial)
  const [monthlyForm, setMonthlyForm] = useState(blankMonthly)
  const [uploadingMonthlyImage, setUploadingMonthlyImage] = useState(false)
  const [uploadingEditorialImage, setUploadingEditorialImage] = useState(false)
  /** 시즌 추천: 스토리지 업로드만 하고 아직「저장」으로 DB 반영 전 */
  const [monthlySeasonAwaitingDbSave, setMonthlySeasonAwaitingDbSave] = useState(false)

  async function reload() {
    setLoading(true)
    setError(null)
    try {
      const [a, b] = await Promise.all([
        fetch('/api/admin/editorial-contents?scope=overseas', { cache: 'no-store' }),
        fetch('/api/admin/monthly-curation-contents?scope=overseas', { cache: 'no-store' }),
      ])
      const aj = (await a.json()) as { items?: EditorialItem[]; error?: string }
      const bj = (await b.json()) as { items?: MonthlyItem[]; error?: string }
      if (!a.ok) throw new Error(aj.error ?? '목록을 불러오지 못했습니다.')
      if (!b.ok) throw new Error(bj.error ?? '목록을 불러오지 못했습니다.')
      setEditorials(Array.isArray(aj.items) ? aj.items : [])
      setMonthlies(Array.isArray(bj.items) ? bj.items : [])
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void reload()
  }, [])

  async function saveEditorial() {
    setError(null)
    setMessage(null)
    if (!editorialForm.title.trim()) {
      setError('제목을 입력해주세요.')
      return
    }
    if (!editorialForm.bodyKr.trim()) {
      setError('본문을 입력해주세요.')
      return
    }

    const payload = {
      ...editorialForm,
      regionKey: editorialForm.regionKey || null,
      countryCode: editorialForm.countryCode || null,
      subtitle: editorialForm.subtitle || null,
      heroImageUrl: editorialForm.heroImageUrl.trim() || null,
      heroImageAlt: editorialForm.heroImageAlt.trim() || null,
      heroImageStorageKey: editorialForm.heroImageStorageKey.trim() || null,
      heroImageWidth:
        editorialForm.heroImageWidth === ''
          ? null
          : (() => {
              const n = parseInt(String(editorialForm.heroImageWidth), 10)
              return Number.isFinite(n) ? n : null
            })(),
      heroImageHeight:
        editorialForm.heroImageHeight === ''
          ? null
          : (() => {
              const n = parseInt(String(editorialForm.heroImageHeight), 10)
              return Number.isFinite(n) ? n : null
            })(),
      sourceType: editorialForm.sourceType || null,
      sourceName: editorialForm.sourceName.trim() || null,
      sourceUrl: editorialForm.sourceUrl.trim() || null,
      seoTitle: editorialForm.seoTitle.trim() || null,
      seoDescription: editorialForm.seoDescription.trim() || null,
      slug: editorialForm.slug.trim() || null,
      privateTripHeroSlot: Boolean(editorialForm.privateTripHeroSlot),
      ctaLabel: editorialForm.ctaLabel.trim() || null,
      ctaHref: editorialForm.ctaHref.trim() || null,
      cardTags: editorialForm.cardTags.trim() || null,
    }

    const isEdit = Boolean(editingEditorialId)
    const res = await fetch(
      isEdit ? `/api/admin/editorial-contents/${editingEditorialId}` : '/api/admin/editorial-contents',
      {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      }
    )
    const json = (await res.json().catch(() => ({}))) as { error?: string }
    if (!res.ok) {
      setError(json.error ?? '입력값을 다시 확인해주세요.')
      return
    }
    setMessage(isEdit ? '수정되었습니다.' : '등록이 완료되었습니다.')
    setEditorialForm(blankEditorial)
    setEditingEditorialId(null)
    await reload()
  }

  async function saveMonthly() {
    setError(null)
    setMessage(null)
    if (!monthlyForm.monthKey.trim()) {
      setError('대상 월을 입력해주세요.')
      return
    }
    if (!isMonthKey(monthlyForm.monthKey.trim())) {
      setError('대상 월은 YYYY-MM 형식이어야 합니다.')
      return
    }
    if (!monthlyForm.title.trim()) {
      setError('제목을 입력해주세요.')
      return
    }
    if (!monthlyForm.bodyKr.trim()) {
      setError('본문을 입력해주세요.')
      return
    }

    const payload = {
      ...monthlyForm,
      regionKey: monthlyForm.regionKey || null,
      countryCode: monthlyForm.countryCode || null,
      subtitle: monthlyForm.subtitle || null,
      ctaLabel: monthlyForm.ctaLabel.trim() || null,
      linkedProductId: monthlyForm.linkedProductId.trim() || null,
      linkedHref: monthlyForm.linkedHref.trim() || null,
      imageUrl: monthlyForm.imageUrl.trim() || null,
      imageAlt: monthlyForm.imageAlt.trim() || null,
      imageStorageKey: monthlyForm.imageStorageKey.trim() || null,
      imageWidth:
        monthlyForm.imageWidth === ''
          ? null
          : (() => {
              const n = parseInt(String(monthlyForm.imageWidth), 10)
              return Number.isFinite(n) ? n : null
            })(),
      imageHeight:
        monthlyForm.imageHeight === ''
          ? null
          : (() => {
              const n = parseInt(String(monthlyForm.imageHeight), 10)
              return Number.isFinite(n) ? n : null
            })(),
      sourceType: monthlyForm.sourceType || null,
      sourceName: monthlyForm.sourceName.trim() || null,
      sourceUrl: monthlyForm.sourceUrl.trim() || null,
      seoTitle: monthlyForm.seoTitle.trim() || null,
      seoDescription: monthlyForm.seoDescription.trim() || null,
      slug: monthlyForm.slug.trim() || null,
    }

    const isEdit = Boolean(editingMonthlyId)
    const res = await fetch(
      isEdit ? `/api/admin/monthly-curation-contents/${editingMonthlyId}` : '/api/admin/monthly-curation-contents',
      {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      }
    )
    const json = (await res.json().catch(() => ({}))) as { error?: string }
    if (!res.ok) {
      setError(json.error ?? '입력값을 다시 확인해주세요.')
      return
    }
    setMonthlySeasonAwaitingDbSave(false)
    setMessage('저장되었습니다.')
    setMonthlyForm(blankMonthly)
    setEditingMonthlyId(null)
    await reload()
  }

  async function toggleEditorialPublish(row: EditorialItem) {
    const res = await fetch(`/api/admin/editorial-contents/${row.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...row, isPublished: !row.isPublished }),
    })
    if (!res.ok) {
      setError('저장 중 오류가 발생했습니다.')
      return
    }
    setMessage('발행 상태가 변경되었습니다.')
    await reload()
  }

  async function toggleMonthlyPublish(row: MonthlyItem) {
    const res = await fetch(`/api/admin/monthly-curation-contents/${row.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...row, isPublished: !row.isPublished }),
    })
    if (!res.ok) {
      setError('저장 중 오류가 발생했습니다.')
      return
    }
    setMessage('발행 상태가 변경되었습니다.')
    await reload()
  }

  async function removeEditorial(id: string) {
    if (!confirm('삭제하시겠습니까?')) return
    const res = await fetch(`/api/admin/editorial-contents/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      setError('저장 중 오류가 발생했습니다.')
      return
    }
    setMessage('삭제되었습니다.')
    await reload()
  }

  async function removeMonthly(id: string) {
    if (!confirm('삭제하시겠습니까?')) return
    const res = await fetch(`/api/admin/monthly-curation-contents/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      setError('저장 중 오류가 발생했습니다.')
      return
    }
    setMessage('삭제되었습니다.')
    await reload()
  }

  const editorialCount = useMemo(() => editorials.length, [editorials])
  const monthlyCount = useMemo(() => monthlies.length, [monthlies])

  /** 시즌 추천 카드 미리보기용 짧은 설명 — 부제목 우선, 없으면 본문 앞부분 */
  const seasonCardPreviewLead = useMemo(() => {
    const sub = monthlyForm.subtitle.trim()
    if (sub) return sub.length > 140 ? `${sub.slice(0, 137)}…` : sub
    const b = monthlyForm.bodyKr.replace(/\s+/g, ' ').trim()
    if (!b) return '부제목 또는 본문을 입력하면 여기에 요약이 보입니다.'
    return b.length > 140 ? `${b.slice(0, 137)}…` : b
  }, [monthlyForm.subtitle, monthlyForm.bodyKr])

  async function uploadMonthlyImage(file: File) {
    setUploadingMonthlyImage(true)
    setError(null)
    const fd = new FormData()
    fd.set('file', file)
    fd.set('monthKey', monthlyForm.monthKey || '')
    fd.set('title', monthlyForm.title || '')
    const res = await fetch('/api/admin/monthly-curation-contents/upload', { method: 'POST', body: fd })
    const json = (await res.json().catch(() => ({}))) as {
      error?: string
      imageUrl?: string
      imageStorageKey?: string
      imageWidth?: number
      imageHeight?: number
    }
    if (!res.ok) {
      setUploadingMonthlyImage(false)
      setError(json.error ?? '저장 중 오류가 발생했습니다.')
      return
    }
    setMonthlyForm((p) => ({
      ...p,
      imageUrl: json.imageUrl ?? '',
      imageStorageKey: json.imageStorageKey ?? '',
      imageWidth: json.imageWidth != null ? String(json.imageWidth) : '',
      imageHeight: json.imageHeight != null ? String(json.imageHeight) : '',
    }))
    setUploadingMonthlyImage(false)
    setMonthlySeasonAwaitingDbSave(true)
    setMessage('이미지를 업로드했습니다. 최종 반영하려면 아래 저장을 눌러주세요.')
  }

  async function uploadEditorialHeroImage(file: File) {
    setUploadingEditorialImage(true)
    setError(null)
    const fd = new FormData()
    fd.set('file', file)
    fd.set('title', editorialForm.title || 'editorial')
    const res = await fetch('/api/admin/editorial-contents/upload', { method: 'POST', body: fd })
    const json = (await res.json().catch(() => ({}))) as {
      error?: string
      heroImageUrl?: string
      heroImageStorageKey?: string
      heroImageWidth?: number
      heroImageHeight?: number
    }
    if (!res.ok) {
      setUploadingEditorialImage(false)
      setError(json.error ?? '저장 중 오류가 발생했습니다.')
      return
    }
    setEditorialForm((p) => ({
      ...p,
      heroImageUrl: json.heroImageUrl ?? '',
      heroImageStorageKey: json.heroImageStorageKey ?? '',
      heroImageWidth: json.heroImageWidth != null ? String(json.heroImageWidth) : '',
      heroImageHeight: json.heroImageHeight != null ? String(json.heroImageHeight) : '',
    }))
    setUploadingEditorialImage(false)
    setMessage('이미지가 반영되었습니다.')
  }

  function editorialFormFromRow(row: EditorialItem) {
    return {
      pageScope: row.pageScope,
      regionKey: row.regionKey ?? '',
      countryCode: row.countryCode ?? '',
      title: row.title,
      subtitle: row.subtitle ?? '',
      bodyKr: row.bodyKr,
      heroImageUrl: row.heroImageUrl ?? '',
      heroImageAlt: row.heroImageAlt ?? '',
      heroImageStorageKey: row.heroImageStorageKey ?? '',
      heroImageWidth: row.heroImageWidth != null ? String(row.heroImageWidth) : '',
      heroImageHeight: row.heroImageHeight != null ? String(row.heroImageHeight) : '',
      sourceType: row.sourceType ?? '',
      sourceName: row.sourceName ?? '',
      sourceUrl: row.sourceUrl ?? '',
      seoTitle: row.seoTitle ?? '',
      seoDescription: row.seoDescription ?? '',
      slug: row.slug ?? '',
      isPublished: row.isPublished,
      sortOrder: row.sortOrder,
      privateTripHeroSlot: Boolean(row.privateTripHeroSlot),
      ctaLabel: row.ctaLabel ?? '',
      ctaHref: row.ctaHref ?? '',
      cardTags: row.cardTags ?? '',
    }
  }

  function monthlyFormFromRow(row: MonthlyItem) {
    return {
      pageScope: row.pageScope,
      monthKey: row.monthKey,
      regionKey: row.regionKey ?? '',
      countryCode: row.countryCode ?? '',
      title: row.title,
      subtitle: row.subtitle ?? '',
      bodyKr: row.bodyKr,
      ctaLabel: row.ctaLabel ?? '',
      linkedProductId: row.linkedProductId ?? '',
      linkedHref: row.linkedHref ?? '',
      imageUrl: row.imageUrl ?? '',
      imageAlt: row.imageAlt ?? '',
      imageStorageKey: row.imageStorageKey ?? '',
      imageWidth: row.imageWidth != null ? String(row.imageWidth) : '',
      imageHeight: row.imageHeight != null ? String(row.imageHeight) : '',
      sourceType: row.sourceType ?? '',
      sourceName: row.sourceName ?? '',
      sourceUrl: row.sourceUrl ?? '',
      seoTitle: row.seoTitle ?? '',
      seoDescription: row.seoDescription ?? '',
      slug: row.slug ?? '',
      isPublished: row.isPublished,
      sortOrder: row.sortOrder,
    }
  }

  return (
    <div className="mx-auto max-w-[1400px] p-6">
      <div className="mb-4">
        <Link href="/admin" className="text-sm text-gray-500 hover:text-gray-800">
          ← 대시보드
        </Link>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h1 className="text-2xl font-semibold text-gray-900">목적지 브리핑 관리</h1>
        <p className="mt-2 text-sm text-gray-600">
          해외 허브·우리여행 등에 쓰이는 브리핑입니다. 권역/국가 미지정 항목은 기본 허브에 노출되며, 아래「우리여행 히어로 슬롯」을 켜면 /travel/overseas/private-trip 우측 운영 카드에 우선
          노출됩니다. 이미지·CTA·칩 문구는 여기서 바꾸면 공개 화면에 반영됩니다.
        </p>
      </section>

      {message && <div className="mt-4 rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</div>}
      {error && <div className="mt-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>}

      <section className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-semibold text-slate-900">{editingEditorialId ? '목적지 브리핑 수정' : '새 목적지 브리핑 등록'}</h2>
        <div className="mt-4 space-y-6">
          <fieldset className="space-y-3 rounded-lg border border-slate-100 bg-slate-50/50 p-4">
            <legend className="px-1 text-sm font-semibold text-slate-800">콘텐츠</legend>
            <label htmlFor="oc-editorial-title" className="block text-sm font-medium">
              제목 (카드/본문)
            </label>
            <input
              id="oc-editorial-title"
              name="editorialTitle"
              className="w-full rounded border px-3 py-2 text-sm"
              value={editorialForm.title}
              onChange={(e) => setEditorialForm((p) => ({ ...p, title: e.target.value }))}
            />
            <label htmlFor="oc-editorial-subtitle" className="block text-sm font-medium">
              부제목
            </label>
            <input
              id="oc-editorial-subtitle"
              name="editorialSubtitle"
              className="w-full rounded border px-3 py-2 text-sm"
              value={editorialForm.subtitle}
              onChange={(e) => setEditorialForm((p) => ({ ...p, subtitle: e.target.value }))}
            />
            <label htmlFor="oc-editorial-bodyKr" className="block text-sm font-medium">
              본문
            </label>
            <p className="text-xs text-slate-500">한국어 문안을 붙여넣어 저장합니다.</p>
            <textarea
              id="oc-editorial-bodyKr"
              name="editorialBodyKr"
              rows={8}
              className="w-full rounded border px-3 py-2 text-sm"
              value={editorialForm.bodyKr}
              onChange={(e) => setEditorialForm((p) => ({ ...p, bodyKr: e.target.value }))}
            />
          </fieldset>

          <fieldset className="space-y-3 rounded-lg border border-slate-100 bg-slate-50/50 p-4">
            <legend className="px-1 text-sm font-semibold text-slate-800">우리여행 히어로 · CTA (운영 슬롯)</legend>
            <p className="text-xs text-slate-600">
              예약·상담 유도용 우측 카드. CTA를 비우면 우리여행 문의 링크와 기본 버튼 문구가 쓰입니다. 칩은 쉼표로 구분해 입력합니다.
            </p>
            <label htmlFor="oc-editorial-privateTripHeroSlot" className="flex items-center gap-2 text-sm">
              <input
                id="oc-editorial-privateTripHeroSlot"
                name="editorialPrivateTripHeroSlot"
                type="checkbox"
                checked={editorialForm.privateTripHeroSlot}
                onChange={(e) => setEditorialForm((p) => ({ ...p, privateTripHeroSlot: e.target.checked }))}
              />
              우리여행 히어로 슬롯으로 우선 노출
            </label>
            <label htmlFor="oc-editorial-ctaLabel" className="block text-sm font-medium">
              CTA 버튼 문구
            </label>
            <input
              id="oc-editorial-ctaLabel"
              name="editorialCtaLabel"
              className="w-full rounded border px-3 py-2 text-sm"
              placeholder="예: 지금 일정 상담 받기"
              value={editorialForm.ctaLabel}
              onChange={(e) => setEditorialForm((p) => ({ ...p, ctaLabel: e.target.value }))}
            />
            <label htmlFor="oc-editorial-ctaHref" className="block text-sm font-medium">
              CTA 링크 (비우면 우리여행 문의 URL)
            </label>
            <input
              id="oc-editorial-ctaHref"
              name="editorialCtaHref"
              className="w-full rounded border px-3 py-2 text-sm"
              placeholder="/inquiry?type=travel&source=... 또는 https://"
              value={editorialForm.ctaHref}
              onChange={(e) => setEditorialForm((p) => ({ ...p, ctaHref: e.target.value }))}
            />
            <label htmlFor="oc-editorial-cardTags" className="block text-sm font-medium">
              카드 칩 (쉼표 구분)
            </label>
            <input
              id="oc-editorial-cardTags"
              name="editorialCardTags"
              className="w-full rounded border px-3 py-2 text-sm"
              placeholder="예: 인기 일정, 상담 가능, 맞춤 견적"
              value={editorialForm.cardTags}
              onChange={(e) => setEditorialForm((p) => ({ ...p, cardTags: e.target.value }))}
            />
          </fieldset>

          <fieldset className="space-y-3 rounded-lg border border-slate-100 bg-slate-50/50 p-4">
            <legend className="px-1 text-sm font-semibold text-slate-800">대표 이미지 (우리여행 히어로 등)</legend>
            <div className="flex flex-wrap items-center gap-2">
              <label htmlFor="oc-editorial-hero-image-upload" className="inline-flex cursor-pointer rounded border bg-white px-3 py-2 text-sm">
                이미지 업로드
              </label>
              <input
                id="oc-editorial-hero-image-upload"
                name="editorialHeroImageUpload"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) void uploadEditorialHeroImage(f)
                }}
              />
              {uploadingEditorialImage && <span className="text-xs text-slate-500">업로드 중…</span>}
              {editorialForm.heroImageUrl ? (
                <button
                  type="button"
                  className="rounded border px-3 py-2 text-sm"
                  onClick={() =>
                    setEditorialForm((p) => ({
                      ...p,
                      heroImageUrl: '',
                      heroImageStorageKey: '',
                      heroImageWidth: '',
                      heroImageHeight: '',
                      heroImageAlt: '',
                    }))
                  }
                >
                  이미지 제거
                </button>
              ) : null}
            </div>
            {editorialForm.heroImageUrl ? (
              <div className="mt-2">
                <img src={editorialForm.heroImageUrl} alt="" className="h-28 w-auto rounded border object-cover" />
                <p className="mt-1 text-[11px] text-slate-500">{editorialForm.heroImageStorageKey}</p>
              </div>
            ) : null}
            <label htmlFor="oc-editorial-heroImageAlt" className="block text-sm font-medium">
              이미지 alt (SEO·접근성)
            </label>
            <input
              id="oc-editorial-heroImageAlt"
              name="editorialHeroImageAlt"
              className="w-full rounded border px-3 py-2 text-sm"
              value={editorialForm.heroImageAlt}
              onChange={(e) => setEditorialForm((p) => ({ ...p, heroImageAlt: e.target.value }))}
            />
          </fieldset>

          <fieldset className="space-y-3 rounded-lg border border-slate-100 bg-slate-50/50 p-4">
            <legend className="px-1 text-sm font-semibold text-slate-800">출처 (수동 이미지)</legend>
            <label htmlFor="oc-editorial-sourceType" className="block text-sm font-medium">
              출처 유형
            </label>
            <select
              id="oc-editorial-sourceType"
              name="editorialSourceType"
              className="w-full rounded border px-3 py-2 text-sm"
              value={editorialForm.sourceType}
              onChange={(e) => setEditorialForm((p) => ({ ...p, sourceType: e.target.value }))}
            >
              {SOURCE_TYPE_OPTIONS.map((o) => (
                <option key={o.value || 'empty'} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <label htmlFor="oc-editorial-sourceName" className="block text-sm font-medium">
              출처 표기명
            </label>
            <input
              id="oc-editorial-sourceName"
              name="editorialSourceName"
              className="w-full rounded border px-3 py-2 text-sm"
              value={editorialForm.sourceName}
              onChange={(e) => setEditorialForm((p) => ({ ...p, sourceName: e.target.value }))}
            />
            <label htmlFor="oc-editorial-sourceUrl" className="block text-sm font-medium">
              출처 URL (https)
            </label>
            <input
              id="oc-editorial-sourceUrl"
              name="editorialSourceUrl"
              className="w-full rounded border px-3 py-2 text-sm"
              value={editorialForm.sourceUrl}
              onChange={(e) => setEditorialForm((p) => ({ ...p, sourceUrl: e.target.value }))}
            />
          </fieldset>

          <fieldset className="space-y-3 rounded-lg border border-slate-100 bg-slate-50/50 p-4">
            <legend className="px-1 text-sm font-semibold text-slate-800">SEO</legend>
            <label htmlFor="oc-editorial-seoTitle" className="block text-sm font-medium">
              검색·메타용 제목 (비우면 본 제목 — 우리여행 카드 표시 제목은 위 본 제목 우선)
            </label>
            <input
              id="oc-editorial-seoTitle"
              name="editorialSeoTitle"
              className="w-full rounded border px-3 py-2 text-sm"
              value={editorialForm.seoTitle}
              onChange={(e) => setEditorialForm((p) => ({ ...p, seoTitle: e.target.value }))}
            />
            <label htmlFor="oc-editorial-seoDescription" className="block text-sm font-medium">
              메타 설명
            </label>
            <textarea
              id="oc-editorial-seoDescription"
              name="editorialSeoDescription"
              rows={3}
              className="w-full rounded border px-3 py-2 text-sm"
              value={editorialForm.seoDescription}
              onChange={(e) => setEditorialForm((p) => ({ ...p, seoDescription: e.target.value }))}
            />
            <label htmlFor="oc-editorial-slug" className="block text-sm font-medium">
              slug (선택, 향후 전용 URL)
            </label>
            <input
              id="oc-editorial-slug"
              name="editorialSlug"
              className="w-full rounded border px-3 py-2 text-sm"
              value={editorialForm.slug}
              onChange={(e) => setEditorialForm((p) => ({ ...p, slug: e.target.value }))}
            />
          </fieldset>

          <fieldset className="space-y-3 rounded-lg border border-slate-100 bg-slate-50/50 p-4">
            <legend className="px-1 text-sm font-semibold text-slate-800">노출 범위</legend>
            <div className="grid grid-cols-2 gap-2">
              <div className="min-w-0">
                <label htmlFor="oc-editorial-pageScope" className="mb-0.5 block text-xs font-medium text-slate-600">
                  pageScope
                </label>
                <input
                  id="oc-editorial-pageScope"
                  name="editorialPageScope"
                  placeholder="pageScope"
                  className="w-full rounded border px-3 py-2 text-sm"
                  value={editorialForm.pageScope}
                  onChange={(e) => setEditorialForm((p) => ({ ...p, pageScope: e.target.value }))}
                />
              </div>
              <div className="min-w-0">
                <label htmlFor="oc-editorial-regionKey" className="mb-0.5 block text-xs font-medium text-slate-600">
                  권역 키
                </label>
                <input
                  id="oc-editorial-regionKey"
                  name="editorialRegionKey"
                  placeholder="권역 키"
                  className="w-full rounded border px-3 py-2 text-sm"
                  value={editorialForm.regionKey}
                  onChange={(e) => setEditorialForm((p) => ({ ...p, regionKey: e.target.value }))}
                />
              </div>
              <div className="min-w-0">
                <label htmlFor="oc-editorial-countryCode" className="mb-0.5 block text-xs font-medium text-slate-600">
                  국가 코드
                </label>
                <input
                  id="oc-editorial-countryCode"
                  name="editorialCountryCode"
                  placeholder="국가 코드"
                  className="w-full rounded border px-3 py-2 text-sm"
                  value={editorialForm.countryCode}
                  onChange={(e) => setEditorialForm((p) => ({ ...p, countryCode: e.target.value }))}
                />
              </div>
              <div className="min-w-0">
                <label htmlFor="oc-editorial-sortOrder" className="mb-0.5 block text-xs font-medium text-slate-600">
                  노출 순서
                </label>
                <input
                  id="oc-editorial-sortOrder"
                  name="editorialSortOrder"
                  placeholder="노출 순서"
                  type="number"
                  className="w-full rounded border px-3 py-2 text-sm"
                  value={editorialForm.sortOrder}
                  onChange={(e) => setEditorialForm((p) => ({ ...p, sortOrder: parseInt(e.target.value || '0', 10) }))}
                />
              </div>
              <label htmlFor="oc-editorial-isPublished" className="col-span-2 flex items-center gap-2 rounded border px-3 py-2 text-sm">
                <input
                  id="oc-editorial-isPublished"
                  name="editorialIsPublished"
                  type="checkbox"
                  checked={editorialForm.isPublished}
                  onChange={(e) => setEditorialForm((p) => ({ ...p, isPublished: e.target.checked }))}
                />
                발행
              </label>
            </div>
          </fieldset>

          <div className="flex gap-2">
            <button onClick={() => void saveEditorial()} className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white">
              {editingEditorialId ? '수정 저장' : '저장'}
            </button>
            {editingEditorialId && (
              <button
                type="button"
                onClick={() => {
                  setEditingEditorialId(null)
                  setEditorialForm(blankEditorial)
                }}
                className="rounded border px-4 py-2 text-sm"
              >
                취소
              </button>
            )}
          </div>
        </div>
      </section>

      <section className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="text-base font-semibold text-slate-900">등록된 목적지 브리핑 항목 ({editorialCount}건)</h3>
        {loading ? <p className="mt-3 text-sm text-slate-500">로딩 중…</p> : (
          <div className="mt-3 space-y-2">
            {editorials.map((row) => (
              <div key={row.id} className="rounded border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">{row.title}</p>
                  <p className="text-xs text-slate-500">
                    scope:{row.pageScope} · country:{row.countryCode ?? '-'} · region:{row.regionKey ?? '-'} · #{row.sortOrder} ·{' '}
                    {row.isPublished ? '발행' : '비발행'}
                    {row.privateTripHeroSlot ? ' · 우리여행히어로슬롯' : ''}
                  </p>
                </div>
                <p className="mt-1 line-clamp-2 whitespace-pre-line text-sm text-slate-600">{row.bodyKr}</p>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    className="rounded border px-3 py-1.5 text-xs"
                    aria-label={`목적지 브리핑 수정 · ${row.title}`}
                    onClick={() => {
                      setEditingEditorialId(row.id)
                      setEditorialForm(editorialFormFromRow(row))
                    }}
                  >
                    수정
                  </button>
                  <button
                    type="button"
                    className="rounded border px-3 py-1.5 text-xs"
                    aria-label={`목적지 브리핑 ${row.isPublished ? '비발행' : '발행'} · ${row.title}`}
                    onClick={() => void toggleEditorialPublish(row)}
                  >
                    {row.isPublished ? '비발행' : '발행'}
                  </button>
                  <button
                    type="button"
                    className="rounded border px-3 py-1.5 text-xs"
                    aria-label={`목적지 브리핑 삭제 · ${row.title}`}
                    onClick={() => void removeEditorial(row.id)}
                  >
                    삭제
                  </button>
                </div>
              </div>
            ))}
            {editorials.length === 0 && <p className="text-sm text-slate-500">등록된 목적지 브리핑 항목이 없습니다.</p>}
          </div>
        )}
      </section>

      <section className="mt-8 rounded-xl border border-slate-200 bg-white p-5">
        <h1 className="text-2xl font-semibold text-gray-900">시즌 추천 관리</h1>
        <p className="mt-2 text-sm text-gray-600">
          해외 허브·모바일 홈 시즌 추천 카드에 올라갈 1건을 등록합니다. 아래 핵심 입력만으로도 저장할 수 있고, 출처·SEO 등은 필요할 때만 펼쳐 주세요.
        </p>
      </section>

      <section className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-semibold text-slate-900">{editingMonthlyId ? '시즌 추천 수정' : '시즌 추천 1건 등록'}</h2>

        <div className="mt-4 flex flex-col gap-8 lg:flex-row lg:items-start">
          <div className="min-w-0 flex-1 space-y-6">
            <fieldset className="space-y-3 rounded-lg border border-slate-100 bg-slate-50/50 p-4">
              <legend className="px-1 text-sm font-semibold text-slate-800">기본 정보</legend>
              <div>
                <label htmlFor="oc-monthly-monthKey" className="block text-sm font-medium text-slate-800">
                  대상 월
                </label>
                <p className="text-xs text-slate-500">YYYY-MM (예: 2026-05)</p>
                <input
                  id="oc-monthly-monthKey"
                  name="monthlyMonthKey"
                  className="mt-1 w-full rounded border px-3 py-2 text-sm"
                  placeholder="2026-05"
                  value={monthlyForm.monthKey}
                  onChange={(e) => setMonthlyForm((p) => ({ ...p, monthKey: e.target.value }))}
                />
              </div>
              <div>
                <label htmlFor="oc-monthly-title" className="block text-sm font-medium text-slate-800">
                  제목
                </label>
                <input
                  id="oc-monthly-title"
                  name="monthlyTitle"
                  className="mt-1 w-full rounded border px-3 py-2 text-sm"
                  value={monthlyForm.title}
                  onChange={(e) => setMonthlyForm((p) => ({ ...p, title: e.target.value }))}
                />
              </div>
              <div>
                <label htmlFor="oc-monthly-subtitle" className="block text-sm font-medium text-slate-800">
                  부제목
                </label>
                <input
                  id="oc-monthly-subtitle"
                  name="monthlySubtitle"
                  className="mt-1 w-full rounded border px-3 py-2 text-sm"
                  value={monthlyForm.subtitle}
                  onChange={(e) => setMonthlyForm((p) => ({ ...p, subtitle: e.target.value }))}
                />
              </div>
              <div>
                <label htmlFor="oc-monthly-bodyKr" className="block text-sm font-medium text-slate-800">
                  본문
                </label>
                <p className="mt-0.5 text-xs text-slate-600">왜 지금 가기 좋은지 2~4문단으로 적어주세요.</p>
                <textarea
                  id="oc-monthly-bodyKr"
                  name="monthlyBodyKr"
                  rows={8}
                  className="mt-1 w-full rounded border px-3 py-2 text-sm"
                  value={monthlyForm.bodyKr}
                  onChange={(e) => setMonthlyForm((p) => ({ ...p, bodyKr: e.target.value }))}
                />
              </div>
            </fieldset>

            <fieldset className="space-y-3 rounded-lg border border-slate-100 bg-slate-50/50 p-4">
              <legend className="px-1 text-sm font-semibold text-slate-800">이미지 · CTA</legend>
              <p className="text-xs text-slate-500">대표 사진과 버튼·연결만 맞추면 모바일 홈 카드에 바로 반영됩니다.</p>
              <div className="flex flex-wrap items-center gap-2">
                <label htmlFor="oc-monthly-image-upload" className="inline-flex cursor-pointer rounded border bg-white px-3 py-2 text-sm font-medium shadow-sm">
                  대표 이미지 업로드
                </label>
                <input
                  id="oc-monthly-image-upload"
                  name="monthlyImageUpload"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) void uploadMonthlyImage(f)
                  }}
                />
                {uploadingMonthlyImage && <span className="text-xs text-slate-500">업로드 중…</span>}
                {monthlyForm.imageUrl ? (
                  <button
                    type="button"
                    className="rounded border border-slate-300 bg-white px-3 py-2 text-sm"
                    onClick={() => {
                      setMonthlyForm((p) => ({ ...p, imageUrl: '', imageStorageKey: '', imageWidth: '', imageHeight: '', imageAlt: '' }))
                      setMonthlySeasonAwaitingDbSave(true)
                    }}
                  >
                    이미지 제거
                  </button>
                ) : null}
              </div>
              {monthlyForm.imageUrl ? (
                <div className="mt-1">
                  <img src={monthlyForm.imageUrl} alt="" className="max-h-36 w-auto rounded border object-cover" />
                  <p className="mt-1.5 text-[11px] leading-snug text-amber-900/85">
                    이미지를 업로드했습니다. 최종 반영하려면 아래 저장을 눌러주세요.
                  </p>
                  {monthlyForm.imageStorageKey ? (
                    <p className="mt-1 font-mono text-[11px] text-slate-400">{monthlyForm.imageStorageKey}</p>
                  ) : null}
                </div>
              ) : null}
              <div>
                <label htmlFor="oc-monthly-imageAlt" className="block text-sm font-medium text-slate-800">
                  이미지 alt
                </label>
                <input
                  id="oc-monthly-imageAlt"
                  name="monthlyImageAlt"
                  className="mt-1 w-full rounded border px-3 py-2 text-sm"
                  value={monthlyForm.imageAlt}
                  onChange={(e) => setMonthlyForm((p) => ({ ...p, imageAlt: e.target.value }))}
                />
              </div>
              <div>
                <label htmlFor="oc-monthly-ctaLabel" className="block text-sm font-medium text-slate-800">
                  CTA 버튼 문구
                </label>
                <input
                  id="oc-monthly-ctaLabel"
                  name="monthlyCtaLabel"
                  className="mt-1 w-full rounded border px-3 py-2 text-sm"
                  placeholder="예: 관련 상품 보기"
                  value={monthlyForm.ctaLabel}
                  onChange={(e) => setMonthlyForm((p) => ({ ...p, ctaLabel: e.target.value }))}
                />
              </div>
              <div>
                <label htmlFor="oc-monthly-linkedProductId" className="block text-sm font-medium text-slate-800">
                  연결 상품 ID
                </label>
                <p className="text-xs text-slate-500">상품 상세로 연결할 때만 입력. 비우면 아래 링크가 사용됩니다.</p>
                <input
                  id="oc-monthly-linkedProductId"
                  name="monthlyLinkedProductId"
                  className="mt-1 w-full rounded border px-3 py-2 text-sm font-mono"
                  placeholder="상품 cuid"
                  value={monthlyForm.linkedProductId}
                  onChange={(e) => setMonthlyForm((p) => ({ ...p, linkedProductId: e.target.value }))}
                />
              </div>
              <div>
                <label htmlFor="oc-monthly-linkedHref" className="block text-sm font-medium text-slate-800">
                  연결 링크
                </label>
                <p className="text-xs text-slate-500">https URL 또는 사이트 내 경로(/travel/overseas 등)</p>
                <input
                  id="oc-monthly-linkedHref"
                  name="monthlyLinkedHref"
                  className="mt-1 w-full rounded border px-3 py-2 text-sm"
                  placeholder="https://… 또는 /travel/overseas"
                  value={monthlyForm.linkedHref}
                  onChange={(e) => setMonthlyForm((p) => ({ ...p, linkedHref: e.target.value }))}
                />
              </div>
            </fieldset>

            <fieldset className="space-y-3 rounded-lg border border-emerald-100 bg-emerald-50/30 p-4">
              <legend className="px-1 text-sm font-semibold text-slate-800">발행</legend>
              <label htmlFor="oc-monthly-isPublished" className="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-800">
                <input
                  id="oc-monthly-isPublished"
                  name="monthlyIsPublished"
                  type="checkbox"
                  checked={monthlyForm.isPublished}
                  onChange={(e) => setMonthlyForm((p) => ({ ...p, isPublished: e.target.checked }))}
                />
                발행
              </label>
              <p className="text-xs text-slate-600">켜면 공개 화면(해외 허브·모바일 홈 등) 노출 후보에 포함됩니다.</p>
            </fieldset>

            <details className="rounded-lg border border-slate-200 bg-slate-50/80">
              <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-slate-800 [&::-webkit-details-marker]:hidden">
                <span className="mr-1 inline-block text-slate-400">▸</span>
                고급 설정 (출처 · SEO · 권역 · 정렬)
              </summary>
              <div className="space-y-4 border-t border-slate-200 p-4">
                <fieldset className="space-y-2 rounded-md border border-slate-100 bg-white/80 p-3">
                  <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-600">출처</legend>
                  <label htmlFor="oc-monthly-sourceType" className="sr-only">
                    출처 유형
                  </label>
                  <select
                    id="oc-monthly-sourceType"
                    name="monthlySourceType"
                    className="w-full rounded border px-3 py-2 text-sm"
                    value={monthlyForm.sourceType}
                    onChange={(e) => setMonthlyForm((p) => ({ ...p, sourceType: e.target.value }))}
                  >
                    {SOURCE_TYPE_OPTIONS.map((o) => (
                      <option key={`m-${o.value || 'empty'}`} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <label htmlFor="oc-monthly-sourceName" className="sr-only">
                    출처 표기명
                  </label>
                  <input
                    id="oc-monthly-sourceName"
                    name="monthlySourceName"
                    placeholder="출처 표기명"
                    className="w-full rounded border px-3 py-2 text-sm"
                    value={monthlyForm.sourceName}
                    onChange={(e) => setMonthlyForm((p) => ({ ...p, sourceName: e.target.value }))}
                  />
                  <label htmlFor="oc-monthly-sourceUrl" className="sr-only">
                    출처 URL (https)
                  </label>
                  <input
                    id="oc-monthly-sourceUrl"
                    name="monthlySourceUrl"
                    placeholder="출처 URL (https)"
                    className="w-full rounded border px-3 py-2 text-sm"
                    value={monthlyForm.sourceUrl}
                    onChange={(e) => setMonthlyForm((p) => ({ ...p, sourceUrl: e.target.value }))}
                  />
                </fieldset>

                <fieldset className="space-y-2 rounded-md border border-slate-100 bg-white/80 p-3">
                  <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-600">SEO</legend>
                  <label htmlFor="oc-monthly-seoTitle" className="sr-only">
                    검색용 제목 (비우면 본 제목)
                  </label>
                  <input
                    id="oc-monthly-seoTitle"
                    name="monthlySeoTitle"
                    placeholder="검색용 제목 (비우면 본 제목)"
                    className="w-full rounded border px-3 py-2 text-sm"
                    value={monthlyForm.seoTitle}
                    onChange={(e) => setMonthlyForm((p) => ({ ...p, seoTitle: e.target.value }))}
                  />
                  <label htmlFor="oc-monthly-seoDescription" className="sr-only">
                    메타 설명
                  </label>
                  <textarea
                    id="oc-monthly-seoDescription"
                    name="monthlySeoDescription"
                    placeholder="메타 설명"
                    rows={3}
                    className="w-full rounded border px-3 py-2 text-sm"
                    value={monthlyForm.seoDescription}
                    onChange={(e) => setMonthlyForm((p) => ({ ...p, seoDescription: e.target.value }))}
                  />
                  <label htmlFor="oc-monthly-slug" className="sr-only">
                    slug (선택)
                  </label>
                  <input
                    id="oc-monthly-slug"
                    name="monthlySlug"
                    placeholder="slug (선택)"
                    className="w-full rounded border px-3 py-2 text-sm"
                    value={monthlyForm.slug}
                    onChange={(e) => setMonthlyForm((p) => ({ ...p, slug: e.target.value }))}
                  />
                </fieldset>

                <fieldset className="space-y-2 rounded-md border border-slate-100 bg-white/80 p-3">
                  <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-600">공개 범위 · 정렬</legend>
                  <p className="text-xs text-slate-500">허브 필터·목록 순서가 필요할 때만 수정합니다. 기본은 해외 전체입니다.</p>
                  <label htmlFor="oc-monthly-pageScope" className="sr-only">
                    pageScope (기본 overseas)
                  </label>
                  <input
                    id="oc-monthly-pageScope"
                    name="monthlyPageScope"
                    placeholder="pageScope (기본 overseas)"
                    className="w-full rounded border px-3 py-2 text-sm"
                    value={monthlyForm.pageScope}
                    onChange={(e) => setMonthlyForm((p) => ({ ...p, pageScope: e.target.value }))}
                  />
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <div className="min-w-0">
                      <label htmlFor="oc-monthly-regionKey" className="sr-only">
                        권역 키
                      </label>
                      <input
                        id="oc-monthly-regionKey"
                        name="monthlyRegionKey"
                        placeholder="권역 키"
                        className="w-full rounded border px-3 py-2 text-sm"
                        value={monthlyForm.regionKey}
                        onChange={(e) => setMonthlyForm((p) => ({ ...p, regionKey: e.target.value }))}
                      />
                    </div>
                    <div className="min-w-0">
                      <label htmlFor="oc-monthly-countryCode" className="sr-only">
                        국가 코드
                      </label>
                      <input
                        id="oc-monthly-countryCode"
                        name="monthlyCountryCode"
                        placeholder="국가 코드"
                        className="w-full rounded border px-3 py-2 text-sm"
                        value={monthlyForm.countryCode}
                        onChange={(e) => setMonthlyForm((p) => ({ ...p, countryCode: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="oc-monthly-sortOrder" className="text-xs font-medium text-slate-600">
                      노출 순서 (숫자 작을수록 앞)
                    </label>
                    <input
                      id="oc-monthly-sortOrder"
                      name="monthlySortOrder"
                      type="number"
                      className="mt-0.5 w-full rounded border px-3 py-2 text-sm"
                      value={monthlyForm.sortOrder}
                      onChange={(e) => setMonthlyForm((p) => ({ ...p, sortOrder: parseInt(e.target.value || '0', 10) }))}
                    />
                  </div>
                </fieldset>
              </div>
            </details>

            <div className="flex flex-wrap items-center gap-2">
              {monthlySeasonAwaitingDbSave ? (
                <span className="inline-flex items-center rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-900">
                  아직 저장되지 않음
                </span>
              ) : null}
              <button type="button" onClick={() => void saveMonthly()} className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white">
                {editingMonthlyId ? '수정 저장' : '저장'}
              </button>
              {editingMonthlyId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingMonthlyId(null)
                    setMonthlyForm(blankMonthly)
                    setMonthlySeasonAwaitingDbSave(false)
                  }}
                  className="rounded border border-slate-300 bg-white px-4 py-2 text-sm"
                >
                  취소
                </button>
              )}
            </div>
          </div>

          <aside className="w-full shrink-0 rounded-xl border border-dashed border-slate-200 bg-slate-50/90 p-4 lg:sticky lg:top-4 lg:w-[min(100%,320px)]" aria-label="시즌 추천 카드 미리보기">
            <p className="text-center text-[11px] font-semibold uppercase tracking-wide text-slate-500">미리보기</p>
            <p className="mt-1 text-center text-xs text-slate-500">모바일 홈 시즌 추천 슬롯과 유사</p>
            <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="relative aspect-[16/10] w-full bg-gradient-to-br from-teal-100 via-slate-100 to-slate-200">
                {monthlyForm.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- 관리자 미리보기(임의 URL)
                  <img src={monthlyForm.imageUrl} alt={monthlyForm.imageAlt || monthlyForm.title || '미리보기'} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs font-medium text-slate-500">이미지 없음</div>
                )}
              </div>
              <div className="border-t border-slate-100 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">시즌 추천</p>
                <p className="mt-1 text-sm font-bold text-slate-900">{monthlyForm.title.trim() || '(제목)'}</p>
                <p className="mt-2 line-clamp-4 text-xs leading-relaxed text-slate-600">{seasonCardPreviewLead}</p>
                <div className="mt-3 rounded-lg bg-teal-700 py-2.5 text-center text-xs font-semibold text-white">
                  {(monthlyForm.ctaLabel || '').trim() || '관련 상품 보기'}
                </div>
              </div>
            </div>
          </aside>
        </div>
      </section>

      <section className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="text-base font-semibold text-slate-900">등록된 시즌 추천 항목 ({monthlyCount}건)</h3>
        {loading ? <p className="mt-3 text-sm text-slate-500">로딩 중…</p> : (
          <div className="mt-3 space-y-2">
            {monthlies.map((row) => (
              <div key={row.id} className="rounded border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">{row.monthKey} · {row.title}</p>
                  <p className="text-xs text-slate-500">scope:{row.pageScope} · country:{row.countryCode ?? '-'} · region:{row.regionKey ?? '-'} · #{row.sortOrder} · {row.isPublished ? '발행' : '비발행'}</p>
                </div>
                <p className="mt-1 line-clamp-2 whitespace-pre-line text-sm text-slate-600">{row.bodyKr}</p>
                <p className="mt-1 text-xs text-slate-500">{row.imageUrl ? '이미지 있음' : '이미지 없음'}</p>
                {row.imageUrl && <img src={row.imageUrl} alt={row.imageAlt ?? row.title} className="mt-2 h-16 w-auto rounded border object-cover" />}
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    className="rounded border px-3 py-1.5 text-xs"
                    aria-label={`시즌 추천 수정 · ${row.monthKey} ${row.title}`}
                    onClick={() => {
                      setEditingMonthlyId(row.id)
                      setMonthlyForm(monthlyFormFromRow(row))
                      setMonthlySeasonAwaitingDbSave(false)
                    }}
                  >
                    수정
                  </button>
                  <button
                    type="button"
                    className="rounded border px-3 py-1.5 text-xs"
                    aria-label={`시즌 추천 ${row.isPublished ? '비발행' : '발행'} · ${row.monthKey} ${row.title}`}
                    onClick={() => void toggleMonthlyPublish(row)}
                  >
                    {row.isPublished ? '비발행' : '발행'}
                  </button>
                  <button
                    type="button"
                    className="rounded border px-3 py-1.5 text-xs"
                    aria-label={`시즌 추천 삭제 · ${row.monthKey} ${row.title}`}
                    onClick={() => void removeMonthly(row.id)}
                  >
                    삭제
                  </button>
                </div>
              </div>
            ))}
            {monthlies.length === 0 && <p className="text-sm text-slate-500">등록된 시즌 추천 항목이 없습니다.</p>}
          </div>
        )}
      </section>
    </div>
  )
}
