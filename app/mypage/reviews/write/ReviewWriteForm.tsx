'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { ReviewType } from '@/lib/reviews-types'
import {
  MEMBER_REVIEW_TRIP_LINES,
  mergeTripLineIntoTags,
  parseTripLineFromTags,
  type MemberReviewTripLine,
} from '@/lib/member-review-trip-line'
import { REVIEW_TYPE_LABELS, REVIEW_TYPES_ORDERED } from '@/lib/review-type-labels'

type Props = {
  editId?: string | null
}

export default function ReviewWriteForm({ editId = null }: Props) {
  const router = useRouter()
  const isEdit = Boolean(editId?.trim())
  const [tripLine, setTripLine] = useState<MemberReviewTripLine | ''>('')
  const [reviewType, setReviewType] = useState<ReviewType | ''>('')
  const [title, setTitle] = useState('')
  const [excerpt, setExcerpt] = useState('')
  const [body, setBody] = useState('')
  const [customerType, setCustomerType] = useState('')
  const [destinationCountry, setDestinationCountry] = useState('')
  const [destinationCity, setDestinationCity] = useState('')
  const [travelMonth, setTravelMonth] = useState('')
  const [ratingLabel, setRatingLabel] = useState('')
  const [tagsRaw, setTagsRaw] = useState('')
  const [thumbnailUrl, setThumbnailUrl] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [okMsg, setOkMsg] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [loadingEdit, setLoadingEdit] = useState(Boolean(isEdit))

  useEffect(() => {
    if (!editId?.trim()) return
    let cancelled = false
    ;(async () => {
      setLoadingEdit(true)
      setError(null)
      try {
        const res = await fetch(`/api/mypage/reviews/${encodeURIComponent(editId)}`, {
          cache: 'no-store',
        })
        const data = (await res.json()) as {
          ok?: boolean
          review?: {
            trip_line?: MemberReviewTripLine | null
            review_type: string
            title: string
            excerpt: string
            body: string | null
            customer_type: string | null
            destination_country: string | null
            destination_city: string | null
            travel_month: string
            rating_label: string | null
            thumbnail_url: string | null
            tags: string[]
            can_edit: boolean
            rejection_reason: string | null
          }
          error?: string
        }
        if (!res.ok || !data.ok || !data.review) {
          if (!cancelled) setError(data.error ?? '후기를 불러오지 못했습니다.')
          return
        }
        const r = data.review
        if (!r.can_edit) {
          if (!cancelled) setError('이 후기는 수정할 수 없습니다.')
          return
        }
        if (!cancelled) {
          setTripLine(r.trip_line ?? '')
          setReviewType(r.review_type as ReviewType)
          setTitle(r.title)
          setExcerpt(r.excerpt)
          setBody(r.body ?? '')
          setCustomerType(r.customer_type ?? '')
          setDestinationCountry(r.destination_country ?? '')
          setDestinationCity(r.destination_city ?? '')
          setTravelMonth(r.travel_month ?? '')
          setRatingLabel(r.rating_label ?? '')
          setThumbnailUrl(r.thumbnail_url ?? '')
          const extraTags = (r.tags ?? []).filter((t) => !t.startsWith('trip_line:'))
          setTagsRaw(extraTags.join(', '))
          if (r.rejection_reason) {
            setOkMsg(`반려 사유: ${r.rejection_reason}`)
          }
        }
      } catch {
        if (!cancelled) setError('후기 불러오기 오류')
      } finally {
        if (!cancelled) setLoadingEdit(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [editId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setOkMsg(null)
    if (!tripLine) {
      setError('여행 상품(우리끼리 / 패키지 / 자유여행)을 선택해 주세요.')
      return
    }
    if (!reviewType) {
      setError('여행 유형을 선택해 주세요.')
      return
    }
    const extraTags = tagsRaw
      .split(/[,，]/)
      .map((t) => t.trim())
      .filter(Boolean)
    const tags = mergeTripLineIntoTags(extraTags, tripLine)
    const payload = {
      category: 'overseas' as const,
      review_type: reviewType,
      title,
      excerpt,
      body: body.trim() || undefined,
      customer_type: customerType.trim() || undefined,
      destination_country: destinationCountry.trim() || undefined,
      destination_city: destinationCity.trim() || undefined,
      travel_month: travelMonth.trim() || undefined,
      rating_label: ratingLabel.trim() || undefined,
      tags,
      thumbnail_url: thumbnailUrl.trim() || undefined,
    }
    setSaving(true)
    try {
      const url = isEdit
        ? `/api/mypage/reviews/${encodeURIComponent(editId!)}`
        : '/api/reviews/submit'
      const res = await fetch(url, {
        method: isEdit ? 'PATCH' : 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? '제출에 실패했습니다.')
        return
      }
      setOkMsg(data.message ?? '접수되었습니다.')
      setTimeout(() => router.push('/mypage/reviews'), 1500)
    } catch {
      setError('네트워크 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  if (loadingEdit) {
    return <p className="text-sm text-[#534AB7]">후기 불러오는 중…</p>
  }

  return (
    <form onSubmit={handleSubmit} className="mt-2 space-y-6">
      <p className="rounded-lg border border-amber-200/80 bg-amber-50/90 px-4 py-3 text-sm leading-relaxed text-amber-950">
        작성하신 후기는 <span className="font-semibold">관리자 검토 후 공개</span>됩니다.
        {isEdit ? ' 수정 후 다시 검토합니다.' : null}
      </p>

      <div>
        <span className="block text-sm font-semibold text-[#1F1B2D]">어떤 여행 후기인가요?</span>
        <p className="mt-1 text-xs text-[#534AB7]">우리끼리 · 패키지 · 자유여행 중 하나를 선택하세요.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {MEMBER_REVIEW_TRIP_LINES.map((line) => (
            <button
              key={line.id}
              type="button"
              onClick={() => setTripLine(line.id)}
              className={`rounded-xl border px-3 py-3 text-left transition ${
                tripLine === line.id
                  ? 'border-[#534AB7] bg-[#534AB7] text-white shadow-sm'
                  : 'border-[#DAD4EE] bg-white text-[#1F1B2D] hover:bg-[#EFEDF8]'
              }`}
            >
              <span className="block text-sm font-bold">{line.label}</span>
              <span
                className={`mt-1 block text-xs ${tripLine === line.id ? 'text-white/90' : 'text-[#534AB7]'}`}
              >
                {line.hint}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <span className="block text-sm font-semibold text-[#1F1B2D]">여행 유형</span>
        <p className="mt-1 text-xs text-[#534AB7]">동행·목적에 가까운 유형을 하나 선택해 주세요.</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {REVIEW_TYPES_ORDERED.map((rt) => (
            <button
              key={rt}
              type="button"
              onClick={() => setReviewType(rt)}
              className={`rounded-full border px-3 py-1.5 text-sm transition ${
                reviewType === rt
                  ? 'border-[#534AB7] bg-[#EFEDF8] font-semibold text-[#534AB7]'
                  : 'border-[#DAD4EE] bg-white text-[#1F1B2D] hover:bg-[#EFEDF8]'
              }`}
            >
              {REVIEW_TYPE_LABELS[rt]}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-[#1F1B2D]">제목</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          minLength={4}
          maxLength={200}
          className="mt-1 w-full rounded-lg border border-[#DAD4EE] px-3 py-2.5 text-sm"
          placeholder="한 줄로 요약"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-[#1F1B2D]">요약</label>
        <textarea
          value={excerpt}
          onChange={(e) => setExcerpt(e.target.value)}
          required
          minLength={10}
          maxLength={800}
          rows={3}
          className="mt-1 w-full rounded-lg border border-[#DAD4EE] px-3 py-2.5 text-sm"
          placeholder="리스트에 노출될 짧은 소개 (10자 이상)"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-[#1F1B2D]">본문 (선택)</label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={20000}
          rows={8}
          className="mt-1 w-full rounded-lg border border-[#DAD4EE] px-3 py-2.5 text-sm"
          placeholder="상세 경험을 적어 주세요."
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-[#1F1B2D]">표시용 상세 라벨 (선택)</label>
        <input
          value={customerType}
          onChange={(e) => setCustomerType(e.target.value)}
          maxLength={120}
          className="mt-1 w-full rounded-lg border border-[#DAD4EE] px-3 py-2.5 text-sm"
          placeholder="예: 부모님동반 가족여행"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-[#1F1B2D]">국가/지역</label>
          <input
            value={destinationCountry}
            onChange={(e) => setDestinationCountry(e.target.value)}
            maxLength={120}
            className="mt-1 w-full rounded-lg border border-[#DAD4EE] px-3 py-2.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-[#1F1B2D]">도시 (선택)</label>
          <input
            value={destinationCity}
            onChange={(e) => setDestinationCity(e.target.value)}
            maxLength={120}
            className="mt-1 w-full rounded-lg border border-[#DAD4EE] px-3 py-2.5 text-sm"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-[#1F1B2D]">여행 시기</label>
        <input
          type="month"
          min="2025-02"
          value={travelMonth}
          onChange={(e) => setTravelMonth(e.target.value)}
          className="mt-1 w-full rounded-lg border border-[#DAD4EE] px-3 py-2.5 text-sm sm:max-w-xs"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-[#1F1B2D]">만족도 (선택)</label>
        <input
          value={ratingLabel}
          onChange={(e) => setRatingLabel(e.target.value)}
          maxLength={80}
          className="mt-1 w-full rounded-lg border border-[#DAD4EE] px-3 py-2.5 text-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-[#1F1B2D]">태그 (쉼표, trip_line 제외)</label>
        <input
          value={tagsRaw}
          onChange={(e) => setTagsRaw(e.target.value)}
          className="mt-1 w-full rounded-lg border border-[#DAD4EE] px-3 py-2.5 text-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-[#1F1B2D]">썸네일 URL (선택)</label>
        <input
          type="url"
          value={thumbnailUrl}
          onChange={(e) => setThumbnailUrl(e.target.value)}
          maxLength={2048}
          className="mt-1 w-full rounded-lg border border-[#DAD4EE] px-3 py-2.5 text-sm"
          placeholder="https://..."
        />
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {okMsg ? <p className="text-sm text-emerald-700">{okMsg}</p> : null}

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={saving}
          className="min-h-[44px] rounded-full bg-[#534AB7] px-6 py-3 text-sm font-semibold text-white hover:bg-[#4339A0] disabled:opacity-50"
        >
          {saving ? '저장 중…' : isEdit ? '수정 제출' : '후기 제출'}
        </button>
        <Link
          href="/mypage/reviews"
          className="inline-flex min-h-[44px] items-center text-sm font-medium text-[#534AB7]"
        >
          목록
        </Link>
      </div>
    </form>
  )
}
