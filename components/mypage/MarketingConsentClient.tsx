'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import ConsentBlock from '@/components/auth/ConsentBlock'
import MypagePageHeading from '@/components/mypage/MypagePageHeading'

export type MarketingConsentInitial = {
  marketingConsent: boolean
  marketingConsentAt: string | null
  marketingConsentVersion: string | null
}

type Props = {
  initial: MarketingConsentInitial
  returnTo: string
}

function formatKst(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
}

function safeReturnPath(raw: string): string {
  const t = raw.trim()
  if (!t.startsWith('/') || t.startsWith('//')) return '/mypage'
  return t
}

export default function MarketingConsentClient({ initial, returnTo }: Props) {
  const router = useRouter()
  const dest = safeReturnPath(returnTo)

  const [consented, setConsented] = useState(initial.marketingConsent)
  const [consentedAt, setConsentedAt] = useState(initial.marketingConsentAt)
  const [version, setVersion] = useState(initial.marketingConsentVersion)

  const [marketing, setMarketing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [withdrawOpen, setWithdrawOpen] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  async function onOptIn(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    setMsg(null)
    if (!marketing) {
      setErr('마케팅 정보 수신에 동의해 주세요.')
      return
    }
    setBusy(true)
    try {
      const res = await fetch('/api/mypage/marketing-consent', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ marketing: true }),
      })
      const j = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        error?: string
        marketingConsentAt?: string | null
        marketingConsentVersion?: string | null
      }
      if (!res.ok) {
        setErr(j.error ?? '저장에 실패했습니다.')
        return
      }
      setConsented(true)
      setConsentedAt(j.marketingConsentAt ?? new Date().toISOString())
      setVersion(j.marketingConsentVersion ?? null)
      setMsg('마케팅 수신에 동의했습니다.')
      router.refresh()
    } catch {
      setErr('네트워크 오류가 발생했습니다.')
    } finally {
      setBusy(false)
    }
  }

  async function onWithdraw() {
    setBusy(true)
    setErr(null)
    setMsg(null)
    try {
      const res = await fetch('/api/mypage/marketing-consent', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ marketing: false }),
      })
      const j = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string }
      if (!res.ok) {
        setErr(j.error ?? '처리에 실패했습니다.')
        return
      }
      setConsented(false)
      setConsentedAt(null)
      setVersion(null)
      setMarketing(false)
      setMsg('마케팅 수신 동의를 철회했습니다.')
      setWithdrawOpen(false)
      router.refresh()
    } catch {
      setErr('네트워크 오류가 발생했습니다.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <MypagePageHeading
        title="마케팅 수신 동의"
        description="이메일·문자 등으로 서비스 소식과 혜택을 안내받을지 설정합니다. 동의 여부는 아래에서 확인할 수 있습니다."
      />

      <div
        className={`rounded-2xl border p-5 shadow-sm ${
          consented ? 'border-emerald-200 bg-emerald-50/80' : 'border-amber-200 bg-amber-50/90'
        }`}
      >
        <p className="text-sm font-semibold text-[#1F1B2D]">현재 상태</p>
        <p className="mt-2 text-[17px] font-bold text-[#1F1B2D]">
          {consented ? '마케팅 수신 동의함' : '마케팅 수신 미동의'}
        </p>
        {consented && consentedAt ? (
          <p className="mt-1 text-sm text-[#534AB7]">동의일: {formatKst(consentedAt)}</p>
        ) : null}
        {consented && version ? (
          <p className="mt-0.5 text-xs text-[#534AB7]/80">동의 버전: {version}</p>
        ) : null}
      </div>

      {!consented ? (
        <form onSubmit={onOptIn} className="rounded-2xl border border-[#DAD4EE] bg-white p-5 shadow-sm space-y-4">
          <p className="text-sm text-[#534AB7]">
            일부 프로모션·혜택 안내는 마케팅 수신 동의가 필요합니다.
          </p>
          <ConsentBlock type="marketing" checked={marketing} onChange={setMarketing} required={false} />
          <button
            type="submit"
            disabled={busy || !marketing}
            className="w-full rounded-xl bg-[#534AB7] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#4339A0] disabled:opacity-50"
          >
            {busy ? '저장 중…' : '동의하고 저장'}
          </button>
        </form>
      ) : (
        <div className="rounded-2xl border border-[#DAD4EE] bg-white p-5 shadow-sm space-y-3">
          <p className="text-sm text-[#534AB7]">
            동의를 철회해도 기본 서비스 이용에는 제한이 없습니다. 소속 명함 인증(eSIM 할인)은 마케팅 동의와 별도로 이용할 수 있습니다.
          </p>
          <button
            type="button"
            onClick={() => setWithdrawOpen(true)}
            disabled={busy}
            className="rounded-xl border border-[#DAD4EE] px-4 py-2.5 text-sm font-medium text-[#534AB7] hover:bg-[#EFEDF8] disabled:opacity-50"
          >
            동의 철회
          </button>
        </div>
      )}

      {msg ? <p className="text-sm text-emerald-700">{msg}</p> : null}
      {err ? <p className="text-sm text-red-600">{err}</p> : null}

      <div className="flex flex-wrap gap-3">
        {consented && dest !== '/mypage/marketing-consent' ? (
          <Link
            href={dest}
            className="inline-block rounded-full bg-[#534AB7] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#4339A0]"
          >
            이전 화면으로
          </Link>
        ) : null}
        <Link
          href="/mypage"
          className="inline-block rounded-full border border-[#DAD4EE] px-5 py-2.5 text-sm font-medium text-[#534AB7] hover:bg-[#EFEDF8]"
        >
          마이페이지 홈
        </Link>
      </div>

      {withdrawOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="marketing-withdraw-title"
        >
          <div className="w-full max-w-sm rounded-2xl border border-[#DAD4EE] bg-white p-5 shadow-lg">
            <h2 id="marketing-withdraw-title" className="text-lg font-semibold text-[#1F1B2D]">
              마케팅 수신 동의를 철회할까요?
            </h2>
            <p className="mt-2 text-sm text-[#534AB7]">
              철회 후에는 마케팅 목적의 안내·혜택 안내를 받지 않습니다. 소속 명함 인증 할인은 영향을 받지 않습니다.
            </p>
            <div className="mt-6 flex gap-2">
              <button
                type="button"
                onClick={() => setWithdrawOpen(false)}
                disabled={busy}
                className="flex-1 rounded-xl border border-[#DAD4EE] px-3 py-2 text-sm font-medium text-[#534AB7] hover:bg-[#EFEDF8] disabled:opacity-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => void onWithdraw()}
                disabled={busy}
                className="flex-1 rounded-xl bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {busy ? '처리 중…' : '철회하기'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
