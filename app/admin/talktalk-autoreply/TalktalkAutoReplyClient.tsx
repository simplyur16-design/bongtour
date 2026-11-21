'use client'

import { useState } from 'react'
import AdminPageHeader from '@/app/admin/components/AdminPageHeader'

type Msg =
  | { kind: 'text'; text: string }
  | { kind: 'composite'; title: string; description: string; imageUrl: string | null; linkLabel: string; linkUrl: string }

type Preview = {
  sent: false
  productRef: string | null
  productFound: boolean
  decision: { mode: string; messages: Msg[]; handover: boolean; faqIds: string[]; reason: string }
  error?: string
}

const MODE_LABEL: Record<string, string> = {
  product: '상품 사진·설명으로 답변',
  faq: 'FAQ로 답변',
  handover: '상담원 연결',
  ignore: '답변 안 함',
}

const SAMPLES = [
  '예약 취소하면 환불은 어떻게 되나요?',
  '여권 영문 이름이 틀렸어요',
  'eSIM QR 설치가 안 돼요',
  '이 상품 아이들이랑 가도 괜찮을까요?',
  '상담원 연결해 주세요',
]

export default function TalktalkAutoReplyClient({ liveEnabled }: { liveEnabled: boolean }) {
  const [text, setText] = useState('')
  const [productRef, setProductRef] = useState('')
  const [loading, setLoading] = useState(false)
  const [res, setRes] = useState<Preview | null>(null)

  async function run(t = text) {
    setLoading(true)
    try {
      const r = await fetch('/api/admin/talktalk-autoreply-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: t, productRef }),
      })
      setRes((await r.json()) as Preview)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader title="톡톡 자동답변 미리보기" />
      <p className={`rounded-lg px-4 py-3 text-sm ${liveEnabled ? 'bg-amber-50 text-amber-900' : 'bg-slate-100 text-slate-700'}`}>
        {liveEnabled
          ? '실제 자동답변이 켜져 있습니다. 이 화면은 미리보기만 하고 고객에게 보내지 않습니다.'
          : '실제 자동답변은 꺼져 있습니다(기본값). 이 화면은 고객에게 보내지 않고 답변 모양만 보여 줍니다.'}
      </p>
      <div className="grid gap-3 md:grid-cols-[1fr_220px]">
        <textarea
          className="min-h-[96px] w-full rounded-lg border border-slate-300 p-3 text-sm"
          placeholder="고객 문의 문장 (상품 링크나 상품코드를 넣으면 그 상품 사진·설명으로 답합니다)"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <div className="space-y-2">
          <input
            className="w-full rounded-lg border border-slate-300 p-2 text-sm"
            placeholder="상품코드 또는 slug (선택)"
            value={productRef}
            onChange={(e) => setProductRef(e.target.value)}
          />
          <button
            type="button"
            disabled={loading || !text.trim()}
            onClick={() => run()}
            className="w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {loading ? '만드는 중…' : '답변 미리보기'}
          </button>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {SAMPLES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => {
              setText(s)
              void run(s)
            }}
            className="rounded-full border border-slate-300 px-3 py-1 text-xs text-slate-700 hover:bg-slate-50"
          >
            {s}
          </button>
        ))}
      </div>
      {res?.decision ? (
        <section className="max-w-md space-y-3 rounded-2xl bg-[#b2c7d9]/30 p-4">
          <div className="flex justify-end">
            <div className="max-w-[80%] rounded-2xl bg-[#03c75a] px-3 py-2 text-sm text-white whitespace-pre-wrap">{text}</div>
          </div>
          <p className="text-xs text-slate-600">
            판단: {MODE_LABEL[res.decision.mode] ?? res.decision.mode}
            {res.decision.handover ? ' · 상담원에게 대화 넘김' : ''}
            {res.productRef ? ` · 상품 ${res.productFound ? '찾음' : '못 찾음'}` : ''}
          </p>
          {res.decision.messages.map((m, i) =>
            m.kind === 'text' ? (
              <div key={i} className="max-w-[85%] rounded-2xl bg-white px-3 py-2 text-sm text-slate-900 shadow-sm whitespace-pre-wrap">
                {m.text}
              </div>
            ) : (
              <div key={i} className="max-w-[85%] overflow-hidden rounded-2xl bg-white text-sm shadow-sm">
                {m.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.imageUrl} alt="" className="h-40 w-full object-cover" />
                ) : null}
                <div className="space-y-1 px-3 py-2">
                  <p className="font-semibold text-slate-900">{m.title}</p>
                  <p className="whitespace-pre-wrap text-slate-700">{m.description}</p>
                </div>
                <a href={m.linkUrl} target="_blank" rel="noreferrer" className="block border-t border-slate-100 px-3 py-2 text-center text-[#03c75a]">
                  {m.linkLabel}
                </a>
              </div>
            ),
          )}
        </section>
      ) : res?.error ? (
        <p className="text-sm text-red-600">{res.error}</p>
      ) : null}
    </div>
  )
}
