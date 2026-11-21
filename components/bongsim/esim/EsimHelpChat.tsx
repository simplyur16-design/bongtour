'use client'

import { useState } from 'react'
import {
  ESIM_AGENT_CHAT_LABEL,
  ESIM_AGENT_CHAT_URL,
  ESIM_HELP_NO_ISSUE,
  ESIM_HELP_NO_ORDERS,
  ESIM_HELP_ORDER_PROMPT,
  ESIM_HELP_QR_READY,
  ESIM_HELP_TOPICS,
  esimHelpTopic,
  esimHelpTranscript,
  type ChatMood,
} from '@/lib/esim-help-chat'

type OrderHit = {
  order_number?: string
  display_status?: string
  can_show_qr?: boolean
}

function Face({ mood }: { mood: ChatMood }) {
  const mouth =
    mood === 'sorry' ? 'M8 16 q4 0 8-3' : mood === 'think' ? 'M9 16 h6' : 'M8 15 q4 4 8 0'
  return (
    <svg viewBox="0 0 32 32" className="h-9 w-9 shrink-0" aria-hidden>
      <circle cx="16" cy="16" r="15" fill="#F2C94C" />
      <path d="M4 14c2-6 6-8 8-4" fill="#58B7E8" />
      <rect x="14" y="3" width="2" height="5" rx="1" fill="#E2B93A" />
      <rect x="18" y="3" width="2" height="5" rx="1" fill="#E2B93A" />
      <circle cx="12" cy="14" r="1.4" fill="#0F172A" />
      <circle cx="20" cy="14" r="1.4" fill="#0F172A" />
      <path d={mouth} fill="none" stroke="#0F172A" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M6 20h8l-2 4H8z" fill="#58B7E8" />
    </svg>
  )
}

export default function EsimHelpChat() {
  const [open, setOpen] = useState(false)
  const [topicId, setTopicId] = useState<string | null>(null)
  const [step, setStep] = useState(0)
  const [orderNo, setOrderNo] = useState('')
  const [orderLine, setOrderLine] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const topic = topicId ? esimHelpTopic(topicId) : null
  const line = topic?.lines[step] ?? null
  const mood: ChatMood = orderLine || (topic && step >= (topic.lines.length || 1) - 1 && step > 0) ? 'sorry' : topic ? 'help' : orderNo ? 'think' : 'hello'
  const transcript = esimHelpTranscript(
    [topic?.label, line, orderLine].filter((item): item is string => Boolean(item)),
  )

  async function lookupOrder() {
    const needle = orderNo.trim()
    if (!needle) return
    setTopicId('order')
    const res = await fetch('/api/bongsim/mypage/orders', { cache: 'no-store' })
    if (res.status === 401) {
      setOrderLine(ESIM_HELP_NO_ORDERS)
      return
    }
    const body = (await res.json().catch(() => null)) as { orders?: OrderHit[] } | null
    const orders = body?.orders ?? []
    if (orders.length === 0) {
      setOrderLine(ESIM_HELP_NO_ORDERS)
      return
    }
    const hit = orders.find((order) => String(order.order_number ?? '').trim() === needle)
    if (!hit) {
      setOrderLine(ESIM_HELP_NO_ORDERS)
      return
    }
    setOrderLine([hit.display_status, hit.can_show_qr ? ESIM_HELP_QR_READY : ESIM_HELP_NO_ISSUE].filter(Boolean).join('\n'))
  }

  async function copyTranscript() {
    try {
      await navigator.clipboard.writeText(transcript)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="pointer-events-none fixed bottom-24 right-4 z-50 flex flex-col items-end gap-2 lg:bottom-4">
      {open ? (
        <section
          className="pointer-events-auto flex max-h-[min(70vh,560px)] w-[min(100vw-2rem,22rem)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
          aria-label="봉실장"
        >
          <header className="flex items-center gap-2 border-b border-slate-100 px-3 py-2">
            <img src="/images/bongtour-logo.webp" alt="봉투어" className="h-6 w-auto" />
            <Face mood={mood} />
            <p className="text-sm font-bold text-slate-900">봉실장</p>
          </header>
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-3 text-sm leading-relaxed text-slate-800">
            {topic && line ? <p className="rounded-xl bg-sky-50 px-3 py-2">{line}</p> : null}
            {orderLine ? <p className="whitespace-pre-line rounded-xl bg-sky-50 px-3 py-2">{orderLine}</p> : null}
            {!topic && !orderLine ? (
              <div className="flex flex-wrap gap-2">
                {ESIM_HELP_TOPICS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-800"
                    onClick={() => {
                      setTopicId(item.id)
                      setStep(0)
                      setOrderLine(null)
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            ) : null}
            <label className="block text-xs text-slate-500">
              {ESIM_HELP_ORDER_PROMPT}
              <span className="mt-1 flex gap-2">
                <input
                  value={orderNo}
                  onChange={(event) => setOrderNo(event.target.value)}
                  className="min-w-0 flex-1 rounded-lg border border-slate-200 px-2 py-1 text-sm"
                  inputMode="text"
                  autoComplete="off"
                />
                <button type="button" className="rounded-lg bg-slate-900 px-2 py-1 text-xs font-semibold text-white" onClick={() => void lookupOrder()}>
                  조회
                </button>
              </span>
            </label>
          </div>
          <footer className="grid grid-cols-2 gap-2 border-t border-slate-100 p-3">
            {topic && step < topic.lines.length - 1 ? (
              <button
                type="button"
                className="col-span-2 rounded-lg border border-slate-200 py-2 text-sm font-semibold"
                onClick={() => setStep((n) => n + 1)}
              >
                다음
              </button>
            ) : null}
            <a
              href={ESIM_AGENT_CHAT_URL}
              className="rounded-lg bg-[#2f8fc7] py-2 text-center text-sm font-semibold text-white"
            >
              {ESIM_AGENT_CHAT_LABEL}
            </a>
            <button
              type="button"
              className="rounded-lg bg-[#f2c94c] py-2 text-sm font-semibold text-slate-900"
              onClick={() => void copyTranscript()}
            >
              {copied ? '복사함' : '상담 내용 복사'}
            </button>
          </footer>
        </section>
      ) : null}
      {/* REGRESSION-FREEZE[esim-help-chat-visible-1122]: 입구는 'eSIM 도움이 필요하세요?' 문구가 보이는 떠 있는 버튼 — manifest */}
      <button
        type="button"
        data-esim-help-entry
        className="pointer-events-auto flex items-center gap-2 rounded-full border-2 border-[#2f8fc7] bg-white py-1.5 pl-1.5 pr-4 shadow-lg"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label="eSIM 도움이 필요하세요? 봉실장 상담 열기"
      >
        <Face mood={open ? 'help' : 'hello'} />
        <span className="flex flex-col items-start leading-tight">
          <span className="text-[13px] font-bold text-slate-900">eSIM 도움이 필요하세요?</span>
          <span className="flex items-center gap-1 text-[11px] font-semibold text-[#2f8fc7]">
            <img src="/images/bongtour-logo.webp" alt="" className="h-3.5 w-auto" />
            봉실장에게 물어보기
          </span>
        </span>
      </button>
    </div>
  )
}
