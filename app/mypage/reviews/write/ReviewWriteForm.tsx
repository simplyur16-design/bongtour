'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { ReviewCategory, ReviewType } from '@/lib/reviews-types'
import { REVIEW_TYPE_LABELS, REVIEW_TYPES_ORDERED } from '@/lib/review-type-labels'

const CATEGORY_OPTIONS: { value: ReviewCategory; label: string }[] = [
  { value: 'overseas', label: '해외여행' },
  { value: 'domestic', label: '국내여행' },
  { value: 'training', label: '국외연수' },
]

export default function ReviewWriteForm() {
  const router = useRouter()
  const [category, setCategory] = useState<ReviewCategory>('overseas')
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setOkMsg(null)
    if (!reviewType) {
      setError('여행 유형을 선택해 주세요.')
      return
    }
    const tags = tagsRaw
      .split(/[,，]/)
      .map((t) => t.trim())
      .filter(Boolean)
    const payload = {
      category,
      review_type: reviewType,
      title,
      excerpt,
      body: body.trim() || undefined,
      customer_type: customerType.trim() || undefined,
      destination_country: destinationCountry.trim() || undefined,
      destination_city: destinationCity.trim() || undefined,
      travel_month: travelMonth.trim() || undefined,
      rating_label: ratingLabel.trim() || undefined,
      tags: tags.length ? tags : undefined,
      thumbnail_url: thumbnailUrl.trim() || undefined,
    }
    setSaving(true)
    try {
      const res = await fetch('/api/reviews/submit', {
        method: 'POST',
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
      setTimeout(() => router.push('/mypage'), 1500)
    } catch {
      setError('네트워크 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-6">
      <p className="rounded-lg border border-amber-200/80 bg-amber-50/90 px-4 py-3 text-sm leading-relaxed text-amber-950">
        작성하신 후기는 <span className="font-semibold text-amber-950">관리자 검토 후 공개</span>됩니다. 광고성 내용, 비방, 개인정보가
        포함된 경우 공개되지 않을 수 있습니다.
      </p>

      <div>
        <label className="block text-sm font-medium text-bt-ink">여행 구분</label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as ReviewCategory)}
          className="mt-1 w-full rounded-lg border border-bt-border bg-white px-3 py-2.5 text-sm"
        >
          {CATEGORY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <span className="block text-sm font-medium text-bt-ink">여행 유형</span>
        <p className="mt-1 text-xs text-bt-muted">해당에 가까운 유형을 하나 선택해 주세요.</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {REVIEW_TYPES_ORDERED.map((rt) => (
            <button
              key={rt}
              type="button"
              onClick={() => setReviewType(rt)}
              className={`rounded-full border px-3 py-1.5 text-sm transition ${
                reviewType === rt
                  ? 'border-bt-accent bg-bt-accent/10 font-semibold text-bt-accent'
                  : 'border-bt-border bg-white text-bt-body hover:bg-bt-surface'
              }`}
            >
              {REVIEW_TYPE_LABELS[rt]}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-bt-ink">제목</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          minLength={4}
          maxLength={200}
          className="mt-1 w-full rounded-lg border border-bt-border px-3 py-2.5 text-sm"
          placeholder="한 줄로 요약"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-bt-ink">요약</label>
        <textarea
          value={excerpt}
          onChange={(e) => setExcerpt(e.target.value)}
          required
          minLength={10}
          maxLength={800}
          rows={3}
          className="mt-1 w-full rounded-lg border border-bt-border px-3 py-2.5 text-sm"
          placeholder="리스트·카드에 노출될 짧은 소개 (10자 이상)"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-bt-ink">본문 (선택)</label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={20000}
          rows={8}
          className="mt-1 w-full rounded-lg border border-bt-border px-3 py-2.5 text-sm"
          placeholder="상세 경험을 적어 주세요."
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-bt-ink">표시용 상세 라벨 (선택)</label>
        <input
          value={customerType}
          onChange={(e) => setCustomerType(e.target.value)}
          maxLength={120}
          className="mt-1 w-full rounded-lg border border-bt-border px-3 py-2.5 text-sm"
          placeholder="예: 부모님동반 가족여행, 친구 6인 소규모모임"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-bt-ink">국가/지역</label>
          <input
            value={destinationCountry}
            onChange={(e) => setDestinationCountry(e.target.value)}
            maxLength={120}
            className="mt-1 w-full rounded-lg border border-bt-border px-3 py-2.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-bt-ink">도시 (선택)</label>
          <input
            value={destinationCity}
            onChange={(e) => setDestinationCity(e.target.value)}
            maxLength={120}
            className="mt-1 w-full rounded-lg border border-bt-border px-3 py-2.5 text-sm"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-bt-ink">여행 시기 (월)</label>
        <input
          type="month"
          min="2025-02"
          value={travelMonth}
          onChange={(e) => setTravelMonth(e.target.value)}
          className="mt-1 w-full rounded-lg border border-bt-border px-3 py-2.5 text-sm sm:max-w-xs"
        />
        <p className="mt-1 text-xs text-bt-muted">2025년 1월 7일 이후 여행만 선택 가능합니다.</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-bt-ink">만족도 표시 (선택)</label>
        <input
          value={ratingLabel}
          onChange={(e) => setRatingLabel(e.target.value)}
          maxLength={80}
          className="mt-1 w-full rounded-lg border border-bt-border px-3 py-2.5 text-sm"
          placeholder="예: 전반적으로 만족"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-bt-ink">태그 (쉼표로 구분, 최대 12개)</label>
        <input
          value={tagsRaw}
          onChange={(e) => setTagsRaw(e.target.value)}
          className="mt-1 w-full rounded-lg border border-bt-border px-3 py-2.5 text-sm"
          placeholder="상담만족, 일정조율"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-bt-ink">썸네일 URL (선택, https)</label>
        <input
          type="url"
          value={thumbnailUrl}
          onChange={(e) => setThumbnailUrl(e.target.value)}
          maxLength={2048}
          className="mt-1 w-full rounded-lg border border-bt-border px-3 py-2.5 text-sm"
          placeholder="https://..."
        />
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {okMsg ? <p className="text-sm text-emerald-700">{okMsg}</p> : null}

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={saving}
          className="min-h-[44px] rounded-xl bg-bt-cta-primary px-6 py-3 text-sm font-semibold text-white hover:bg-bt-cta-primary-hover disabled:opacity-50"
        >
          {saving ? '제출 중…' : '후기 제출'}
        </button>
        <Link href="/mypage" className="inline-flex min-h-[44px] items-center text-sm text-bt-muted hover:text-bt-ink">
          취소
        </Link>
      </div>
    </form>
  )
}
