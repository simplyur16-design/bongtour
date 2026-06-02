'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { Command, Loader2, MessageSquare, Search, X } from 'lucide-react'
import { normalizeAdminToolRole } from '@/lib/admin-roles'
import { INQUIRY_ADMIN_STATUSES, inquiryStatusLabel } from '@/lib/admin-inquiry'

type ProductHit = {
  id: string
  title: string
  slug: string | null
  originCode: string | null
  registrationStatus: string | null
}

type InquiryRow = {
  id: string
  inquiryNumber: string
  createdAt: string
  inquiryTypeLabel: string
  status: string
  applicantName: string
  applicantPhone: string
  applicantEmail: string | null
  message: string | null
  productId: string | null
  snapshotProductTitle: string | null
  snapshotOriginCode: string | null
  missingProduct: boolean
}

type ReplyChannel = 'email' | 'sms' | 'alimtalk'

const NAVY = '#1F1B2D'
const LAVENDER = '#EFEDF8'
const GOLD = '#d9a81e'

export default function AdminQuickActions() {
  const { data: session, status } = useSession()
  const toolRole = useMemo(
    () => normalizeAdminToolRole((session?.user as { role?: string } | undefined)?.role),
    [session],
  )

  const [open, setOpen] = useState(false)
  const [productQ, setProductQ] = useState('')
  const [products, setProducts] = useState<ProductHit[]>([])
  const [productLoading, setProductLoading] = useState(false)

  const [inquiries, setInquiries] = useState<InquiryRow[]>([])
  const [inquiriesLoading, setInquiriesLoading] = useState(false)

  const [activeInquiry, setActiveInquiry] = useState<InquiryRow | null>(null)
  const [replyText, setReplyText] = useState('')
  const [replyChannel, setReplyChannel] = useState<ReplyChannel>('sms')
  const [replyStatus, setReplyStatus] = useState('contacted')
  const [replyBusy, setReplyBusy] = useState(false)
  const [replyErr, setReplyErr] = useState('')
  const [replyOk, setReplyOk] = useState('')

  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  const loadInquiries = useCallback(async () => {
    setInquiriesLoading(true)
    try {
      const res = await fetch('/api/admin/quick-actions/inquiries?limit=20')
      const data = (await res.json().catch(() => ({}))) as { inquiries?: InquiryRow[] }
      if (res.ok) setInquiries(data.inquiries ?? [])
    } finally {
      setInquiriesLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!open || !toolRole) return
    void loadInquiries()
  }, [open, toolRole, loadInquiries])

  useEffect(() => {
    if (!toolRole) return
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((v) => !v)
      }
      if (e.key === 'Escape') {
        setActiveInquiry(null)
        setOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toolRole])

  useEffect(() => {
    if (!open || !toolRole) return
    const q = productQ.trim()
    if (searchDebounce.current) clearTimeout(searchDebounce.current)
    if (q.length < 2) {
      setProducts([])
      return
    }
    searchDebounce.current = setTimeout(() => {
      void (async () => {
        setProductLoading(true)
        try {
          const res = await fetch(`/api/admin/quick-actions/products?q=${encodeURIComponent(q)}`)
          const data = (await res.json().catch(() => ({}))) as { products?: ProductHit[] }
          if (res.ok) setProducts(data.products ?? [])
        } finally {
          setProductLoading(false)
        }
      })()
    }, 280)
    return () => {
      if (searchDebounce.current) clearTimeout(searchDebounce.current)
    }
  }, [productQ, open, toolRole])

  if (status === 'loading' || !toolRole) return null

  async function sendReply() {
    if (!activeInquiry) return
    setReplyBusy(true)
    setReplyErr('')
    setReplyOk('')
    try {
      const res = await fetch(`/api/admin/quick-actions/inquiries/${activeInquiry.id}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          replyText,
          channel: replyChannel,
          status: replyStatus,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string; ok?: boolean; detail?: string }
      if (!res.ok || !data.ok) {
        setReplyErr(data.error ?? '발송에 실패했습니다.')
        return
      }
      setReplyOk(data.detail ? `발송 완료 (${data.detail})` : '발송 완료')
      setReplyText('')
      await loadInquiries()
    } catch {
      setReplyErr('네트워크 오류가 발생했습니다.')
    } finally {
      setReplyBusy(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-20 right-4 z-[90] flex h-12 w-12 items-center justify-center rounded-full shadow-lg transition hover:scale-105 lg:bottom-6"
        style={{ backgroundColor: GOLD, color: NAVY }}
        aria-label="운영 빠른 작업 (Ctrl+K)"
        title="운영 빠른 작업 (Ctrl+K)"
      >
        <Command className="h-5 w-5" strokeWidth={2.25} />
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-label="운영 빠른 작업"
          onClick={() => {
            setActiveInquiry(null)
            setOpen(false)
          }}
        >
          <div
            className="flex max-h-[min(88vh,720px)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl shadow-2xl"
            style={{ backgroundColor: LAVENDER, color: NAVY }}
            onClick={(e) => e.stopPropagation()}
          >
            <header className="flex items-center justify-between border-b border-[#1F1B2D]/10 px-5 py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide opacity-70">BongTour Admin</p>
                <h2 className="text-lg font-bold">빠른 작업</h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-2 hover:bg-white/60"
                aria-label="닫기"
              >
                <X className="h-5 w-5" />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
              <section>
                <label className="flex items-center gap-2 text-sm font-semibold">
                  <Search className="h-4 w-4" />
                  상품 검색
                </label>
                <input
                  type="search"
                  value={productQ}
                  onChange={(e) => setProductQ(e.target.value)}
                  placeholder="제목 · slug · originCode"
                  className="mt-2 w-full rounded-xl border border-[#1F1B2D]/15 bg-white px-4 py-2.5 text-sm outline-none focus:border-[#d9a81e]"
                  autoFocus
                />
                {productLoading ? (
                  <p className="mt-2 flex items-center gap-2 text-xs opacity-70">
                    <Loader2 className="h-3 w-3 animate-spin" /> 검색 중…
                  </p>
                ) : null}
                {products.length > 0 ? (
                  <ul className="mt-2 overflow-hidden rounded-xl border border-[#1F1B2D]/10 bg-white">
                    {products.map((p) => (
                      <li key={p.id}>
                        <button
                          type="button"
                          className="flex w-full flex-col items-start gap-0.5 border-b border-[#1F1B2D]/5 px-4 py-3 text-left text-sm last:border-0 hover:bg-[#EFEDF8]"
                          onClick={() => {
                            window.open(`/admin/products/${p.id}`, '_blank', 'noopener,noreferrer')
                          }}
                        >
                          <span className="font-medium line-clamp-2">{p.title}</span>
                          <span className="text-xs opacity-60">
                            {p.originCode?.trim() || '—'} · {p.registrationStatus ?? '—'}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : productQ.trim().length >= 2 && !productLoading ? (
                  <p className="mt-2 text-xs opacity-60">결과 없음</p>
                ) : null}
              </section>

              <section>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="flex items-center gap-2 text-sm font-semibold">
                    <MessageSquare className="h-4 w-4" />
                    최근 문의
                  </h3>
                  <button
                    type="button"
                    className="text-xs font-medium underline opacity-70"
                    onClick={() => void loadInquiries()}
                  >
                    새로고침
                  </button>
                </div>
                {inquiriesLoading ? (
                  <p className="mt-3 text-xs opacity-70">불러오는 중…</p>
                ) : (
                  <ul className="mt-2 space-y-2">
                    {inquiries.map((row) => (
                      <li key={row.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveInquiry(row)
                            setReplyErr('')
                            setReplyOk('')
                            setReplyStatus(row.status === 'received' ? 'contacted' : row.status)
                          }}
                          className={`w-full rounded-xl border px-4 py-3 text-left text-sm transition hover:shadow-md ${
                            row.missingProduct
                              ? 'border-amber-400/80 bg-amber-50/90'
                              : 'border-[#1F1B2D]/10 bg-white'
                          }`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-mono text-xs font-semibold">{row.inquiryNumber}</span>
                            <span className="text-xs opacity-70">{inquiryStatusLabel(row.status)}</span>
                          </div>
                          <p className="mt-1 font-medium">
                            {row.applicantName}
                            <span className="ml-2 font-normal opacity-70">{row.inquiryTypeLabel}</span>
                          </p>
                          <p className="mt-1 line-clamp-1 text-xs opacity-80">
                            {row.snapshotProductTitle?.trim() || (row.missingProduct ? '⚠ 상품 미연결' : '—')}
                          </p>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>

            <footer className="border-t border-[#1F1B2D]/10 px-5 py-2 text-center text-[10px] opacity-60">
              Ctrl+K · {toolRole === 'ADMIN' ? '관리자' : '스태프'}
            </footer>
          </div>
        </div>
      ) : null}

      {activeInquiry ? (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="문의 답변"
          onClick={() => setActiveInquiry(null)}
        >
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl"
            style={{ color: NAVY }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-mono text-xs font-semibold">{activeInquiry.inquiryNumber}</p>
                <h3 className="text-lg font-bold">답변 보내기</h3>
              </div>
              <button type="button" onClick={() => setActiveInquiry(null)} aria-label="닫기">
                <X className="h-5 w-5" />
              </button>
            </div>

            <dl className="mt-4 grid gap-2 text-sm">
              <div>
                <dt className="text-xs opacity-60">고객</dt>
                <dd>
                  {activeInquiry.applicantName} · {activeInquiry.applicantPhone}
                  {activeInquiry.applicantEmail ? ` · ${activeInquiry.applicantEmail}` : ''}
                </dd>
              </div>
              <div>
                <dt className="text-xs opacity-60">문의 내용</dt>
                <dd className="whitespace-pre-wrap rounded-lg bg-[#EFEDF8] p-3 text-sm">
                  {activeInquiry.message?.trim() || '(본문 없음)'}
                </dd>
              </div>
            </dl>

            <label className="mt-4 block text-sm font-medium">
              답변
              <textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                rows={5}
                className="mt-1.5 w-full rounded-xl border border-[#1F1B2D]/15 px-3 py-2 text-sm"
                placeholder="고객에게 전달할 답변을 입력하세요."
              />
            </label>

            <fieldset className="mt-4">
              <legend className="text-sm font-medium">발송 채널</legend>
              <div className="mt-2 flex flex-wrap gap-3 text-sm">
                {(['sms', 'email', 'alimtalk'] as const).map((ch) => (
                  <label key={ch} className="inline-flex items-center gap-1.5">
                    <input
                      type="radio"
                      name="replyChannel"
                      checked={replyChannel === ch}
                      onChange={() => setReplyChannel(ch)}
                    />
                    {ch === 'sms' ? 'SMS' : ch === 'email' ? '이메일' : '알림톡'}
                  </label>
                ))}
              </div>
            </fieldset>

            <label className="mt-4 block text-sm font-medium">
              상태 업데이트
              <select
                value={replyStatus}
                onChange={(e) => setReplyStatus(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-[#1F1B2D]/15 px-3 py-2 text-sm"
              >
                {INQUIRY_ADMIN_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {inquiryStatusLabel(s)}
                  </option>
                ))}
              </select>
            </label>

            {replyErr ? <p className="mt-3 text-sm text-rose-700">{replyErr}</p> : null}
            {replyOk ? <p className="mt-3 text-sm text-emerald-800">{replyOk}</p> : null}

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                disabled={replyBusy}
                onClick={() => void sendReply()}
                className="flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-50"
                style={{ backgroundColor: GOLD, color: NAVY }}
              >
                {replyBusy ? '발송 중…' : '발송 · 저장'}
              </button>
              <button
                type="button"
                className="rounded-xl border border-[#1F1B2D]/20 px-4 py-2.5 text-sm"
                onClick={() => setActiveInquiry(null)}
              >
                취소
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
