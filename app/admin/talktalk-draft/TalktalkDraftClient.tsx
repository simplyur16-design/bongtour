'use client'

import { useState } from 'react'
import AdminPageHeader from '@/app/admin/components/AdminPageHeader'

type Candidate = {
  productId: string
  title: string
  supplierLabel: string
  departureDate: string
  priceLabel: string
  seatsLabel: string
  href: string
}

type FaqHit = { id: string; question: string; answer: string; source: string }
type Need = { question: string; why: string }
type FaqGroup = { id: string; label: string; items: FaqHit[] }

type DraftResponse = {
  sent: false
  draftText: string
  candidates: Candidate[]
  faq: FaqHit[]
  needsAnswer: Need[]
  error?: string
}

export default function TalktalkDraftClient({
  groups,
  needsAnswer,
}: {
  groups: FaqGroup[]
  needsAnswer: Need[]
}) {
  const [inquiryText, setInquiryText] = useState('')
  const [activeCategory, setActiveCategory] = useState(groups[0]?.id ?? '')
  const [openId, setOpenId] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [destination, setDestination] = useState('')
  const [departureDate, setDepartureDate] = useState('')
  const [budgetKrw, setBudgetKrw] = useState('')
  const [partySize, setPartySize] = useState('')
  const [duration, setDuration] = useState('')
  const [productCode, setProductCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [result, setResult] = useState<DraftResponse | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setCopied(false)
    try {
      const res = await fetch('/api/admin/talktalk-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inquiryText,
          destination,
          departureDate,
          budgetKrw: budgetKrw.trim() ? Number(budgetKrw.replace(/,/g, '')) : null,
          partySize: partySize.trim() ? Number(partySize) : null,
          duration,
          productCode,
        }),
      })
      const data = (await res.json()) as DraftResponse
      if (!res.ok) {
        setResult(null)
        setError(data.error ?? '초안을 만들지 못했습니다.')
        return
      }
      setResult(data)
    } catch {
      setResult(null)
      setError('네트워크 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  async function copyDraft() {
    if (!result?.draftText) return
    try {
      await navigator.clipboard.writeText(result.draftText)
      setCopied(true)
    } catch {
      setCopied(false)
      setError('복사하지 못했습니다. 초안을 직접 선택해 주세요.')
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <AdminPageHeader
        title="톡톡 답변 초안"
        subtitle="등록 상품 비교와 저장해 둔 안내 문장으로 초안만 만듭니다. 발송하지 않습니다."
      />
      <form onSubmit={onSubmit} className="space-y-4">
        <label className="block text-sm font-medium text-slate-800">
          문의 내용
          <textarea
            value={inquiryText}
            onChange={(e) => setInquiryText(e.target.value)}
            required
            rows={8}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="고객이 남긴 문의를 붙여 넣으세요."
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-medium text-slate-800">
            목적지
            <input
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="비우면 문의 문장에서 찾습니다."
            />
          </label>
          <label className="block text-sm font-medium text-slate-800">
            출발일
            <input
              value={departureDate}
              onChange={(e) => setDepartureDate(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="2026-12-08"
            />
          </label>
          <label className="block text-sm font-medium text-slate-800">
            예산 (원)
            <input
              value={budgetKrw}
              onChange={(e) => setBudgetKrw(e.target.value)}
              inputMode="numeric"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm font-medium text-slate-800">
            인원
            <input
              value={partySize}
              onChange={(e) => setPartySize(e.target.value)}
              inputMode="numeric"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm font-medium text-slate-800 sm:col-span-2">
            상품코드
            <input
              value={productCode}
              onChange={(e) => setProductCode(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="1인실 금액을 읽을 때 사용합니다."
            />
          </label>
          <label className="block text-sm font-medium text-slate-800 sm:col-span-2">
            박·일
            <input
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="3박 4일. 비우면 일정 길이는 맞추지 않습니다."
            />
          </label>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-bt-text-navy px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {loading ? '만드는 중…' : '초안 만들기'}
        </button>
      </form>

      {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}

      {result ? (
        <section className="mt-8 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-slate-900">초안</h2>
            <button
              type="button"
              onClick={copyDraft}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
            >
              {copied ? '복사함' : '복사'}
            </button>
          </div>
          <textarea
            readOnly
            value={result.draftText}
            rows={16}
            className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm"
          />
          <p className="text-xs text-slate-500">발송 버튼은 없습니다. 복사해서 상담원이 직접 확인한 뒤에만 쓰세요.</p>
          {result.candidates.length === 0 ? (
            <p className="text-sm text-slate-600">조건에 맞는 등록 상품이 없습니다.</p>
          ) : (
            <ul className="space-y-2 text-sm text-slate-800">
              {result.candidates.map((c) => (
                <li key={c.productId}>
                  {c.title} · {c.supplierLabel} · {c.departureDate} · {c.priceLabel} · 잔여 {c.seatsLabel}
                </li>
              ))}
            </ul>
          )}
          {result.faq.length > 0 ? (
            <p className="text-xs text-slate-500">
              초안에 넣은 근거: {result.faq.map((f) => `${f.question} (${f.source})`).join(' · ')}
            </p>
          ) : null}
        </section>
      ) : null}

      <FaqBrowser
        groups={groups}
        activeCategory={activeCategory}
        setActiveCategory={setActiveCategory}
        openId={openId}
        setOpenId={setOpenId}
        copiedId={copiedId}
        setCopiedId={setCopiedId}
      />
      <div className="mt-8">
        <h3 className="text-sm font-semibold text-slate-900">답 필요</h3>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
          {needsAnswer.map((item) => (
            <li key={item.question}>
              {item.question} — {item.why}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function FaqBrowser({
  groups,
  activeCategory,
  setActiveCategory,
  openId,
  setOpenId,
  copiedId,
  setCopiedId,
}: {
  groups: FaqGroup[]
  activeCategory: string
  setActiveCategory: (id: string) => void
  openId: string | null
  setOpenId: (id: string | null) => void
  copiedId: string | null
  setCopiedId: (id: string | null) => void
}) {
  const group = groups.find((item) => item.id === activeCategory) ?? groups[0]
  return (
    <section className="mt-10">
      <h2 className="text-base font-semibold text-slate-900">FAQ</h2>
      <div className="mt-3 flex flex-wrap gap-2">
        {groups.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              setActiveCategory(item.id)
              setOpenId(null)
            }}
            className={
              item.id === group?.id
                ? 'rounded-full bg-bt-text-navy px-3 py-1.5 text-sm font-semibold text-white'
                : 'rounded-full border border-slate-300 px-3 py-1.5 text-sm text-slate-800'
            }
          >
            {item.label} {item.items.length}
          </button>
        ))}
      </div>
      <ul className="mt-4 divide-y divide-slate-200 rounded-lg border border-slate-200">
        {(group?.items ?? []).map((item) => {
          const open = openId === item.id
          return (
            <li key={item.id} className="px-3 py-2">
              <button
                type="button"
                className="w-full text-left text-sm font-medium text-slate-900"
                onClick={() => setOpenId(open ? null : item.id)}
              >
                {item.question}
              </button>
              {open ? (
                <div className="mt-2">
                  <p className="whitespace-pre-wrap text-sm text-slate-700">{item.answer}</p>
                  <p className="mt-1 text-xs text-slate-500">{item.source}</p>
                  <button
                    type="button"
                    className="mt-2 rounded-lg border border-slate-300 px-3 py-1 text-sm"
                    onClick={() => {
                      void navigator.clipboard.writeText(item.answer).then(() => setCopiedId(item.id))
                    }}
                  >
                    {copiedId === item.id ? '복사함' : '답변 복사'}
                  </button>
                </div>
              ) : null}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
