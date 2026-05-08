'use client'

import { useState } from 'react'
import { signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import ConsentBlock from '@/components/auth/ConsentBlock'

function safeInnerCallback(raw: string): string {
  const t = raw.trim()
  if (!t.startsWith('/') || t.startsWith('//')) return '/'
  return t
}

type Props = {
  callbackUrl: string
}

export default function ConsentClient({ callbackUrl }: Props) {
  const router = useRouter()
  const [terms, setTerms] = useState(false)
  const [privacy, setPrivacy] = useState(false)
  const [age, setAge] = useState(false)
  const [marketing, setMarketing] = useState(false)
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancelLoading, setCancelLoading] = useState(false)

  const requiredOk = terms && privacy && age
  const dest = safeInnerCallback(callbackUrl || '/')

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErr('')
    if (!requiredOk) {
      setErr('필수 동의 항목을 모두 선택해 주세요.')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/signup/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          terms: true,
          privacy: true,
          age: true,
          marketing,
          callbackUrl: dest,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        redirectTo?: string
        error?: string
      }
      if (!res.ok) {
        setErr(data.error ?? '처리에 실패했습니다.')
        return
      }
      const next = typeof data.redirectTo === 'string' ? safeInnerCallback(data.redirectTo) : dest
      router.push(next)
      router.refresh()
    } catch {
      setErr('네트워크 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  async function onCancelConfirmed() {
    setCancelLoading(true)
    setErr('')
    try {
      const res = await fetch('/api/auth/signup/consent', { method: 'DELETE' })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string }
      if (!res.ok) {
        setErr(data.error ?? '가입 취소에 실패했습니다.')
        setCancelOpen(false)
        return
      }
      await signOut({ redirect: false })
      router.push('/auth/signup')
      router.refresh()
    } catch {
      setErr('네트워크 오류가 발생했습니다.')
    } finally {
      setCancelLoading(false)
      setCancelOpen(false)
    }
  }

  return (
    <>
      <h1 className="mb-2 text-xl font-bold text-bt-strong">가입을 거의 마쳤습니다</h1>
      <p className="mb-6 text-center text-sm leading-relaxed text-bt-body">
        서비스 이용을 위해 아래 내용에 동의해 주세요. 마케팅 수신은 선택이며, 동의 시 가입 환영 쿠폰이 발급될 수 있습니다.
      </p>

      <form onSubmit={onSubmit} className="w-full space-y-3">
        <ConsentBlock type="terms" checked={terms} onChange={setTerms} required />
        <ConsentBlock type="privacy" checked={privacy} onChange={setPrivacy} required />
        <ConsentBlock type="age" checked={age} onChange={setAge} required />
        <ConsentBlock type="marketing" checked={marketing} onChange={setMarketing} required={false} />

        {err ? <p className="text-sm text-bt-danger">{err}</p> : null}

        <button
          type="submit"
          disabled={loading || !requiredOk}
          className="w-full rounded-lg bg-bt-cta-primary px-4 py-3 text-sm font-semibold text-bt-cta-primary-fg transition hover:bg-bt-cta-primary-hover disabled:opacity-60"
        >
          {loading ? '처리 중…' : '동의하고 가입 완료'}
        </button>
      </form>

      <button
        type="button"
        onClick={() => setCancelOpen(true)}
        className="mt-4 w-full rounded-lg border border-bt-border-strong bg-bt-surface px-4 py-3 text-sm font-medium text-bt-body hover:bg-bt-surface-soft"
      >
        동의하지 않고 취소
      </button>

      {cancelOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="consent-cancel-title"
        >
          <div className="w-full max-w-sm rounded-lg border border-bt-border-strong bg-bt-surface p-5 shadow-lg">
            <h2 id="consent-cancel-title" className="text-lg font-semibold text-bt-strong">
              가입을 취소할까요?
            </h2>
            <p className="mt-2 text-sm text-bt-body">
              동의하지 않으면 계정이 삭제되며, 같은 소셜 계정으로 다시 시작할 수 있습니다.
            </p>
            <div className="mt-6 flex gap-2">
              <button
                type="button"
                onClick={() => setCancelOpen(false)}
                disabled={cancelLoading}
                className="flex-1 rounded-lg border border-bt-border-strong px-3 py-2 text-sm font-medium text-bt-body hover:bg-bt-surface-soft disabled:opacity-50"
              >
                돌아가기
              </button>
              <button
                type="button"
                onClick={() => void onCancelConfirmed()}
                disabled={cancelLoading}
                className="flex-1 rounded-lg bg-bt-danger px-3 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
              >
                {cancelLoading ? '처리 중…' : '가입 취소'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
