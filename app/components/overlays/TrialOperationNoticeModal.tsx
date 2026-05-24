'use client'

import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

/** 닫기 후 같은 탭에서 재노출 안 함 — 문구·기간 변경 시 버전 올림 */
const DISMISS_KEY = 'bt-trial-notice-dismiss-v2'
/** 5월 26일까지(포함) — 27일 00:00 KST부터 비노출 */
const TRIAL_END_AT = new Date('2026-05-27T00:00:00+09:00')
const SHOW_AFTER_MS = 400

function isTrialPeriodActive(now = new Date()): boolean {
  return now < TRIAL_END_AT
}

export function TrialOperationNoticeModal() {
  const [mounted, setMounted] = useState(false)
  const [open, setOpen] = useState(false)

  const close = useCallback(() => {
    setOpen(false)
    try {
      window.sessionStorage.setItem(DISMISS_KEY, '1')
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted || !isTrialPeriodActive()) return

    try {
      if (window.sessionStorage.getItem(DISMISS_KEY)) return
    } catch {
      /* private mode */
    }

    const t = window.setTimeout(() => setOpen(true), SHOW_AFTER_MS)
    return () => window.clearTimeout(t)
  }, [mounted])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, close])

  if (!mounted || !open) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[10200] flex items-center justify-center bg-slate-900/55 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="trial-notice-title"
      onClick={close}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-teal-100 bg-white p-6 shadow-2xl sm:p-7"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-center text-3xl" aria-hidden>
          📢
        </p>
        <h2 id="trial-notice-title" className="mt-3 text-center text-xl font-bold text-slate-900">
          시범 운영 안내
        </h2>
        <p className="mt-4 text-center text-[15px] leading-relaxed text-slate-700">
          <span className="font-semibold text-teal-800">5월 26일까지 시범운영중</span>
          입니다.
          <br />
          <span className="mt-2 block text-sm text-slate-600">
            일부 서비스가 제한될 수 있으며, 이용 중 문의는 고객센터로 부탁드립니다.
          </span>
        </p>
        <button
          type="button"
          onClick={close}
          className="mt-6 flex min-h-11 w-full items-center justify-center rounded-xl bg-teal-600 text-[15px] font-semibold text-white transition hover:bg-teal-700"
        >
          확인
        </button>
      </div>
    </div>,
    document.body,
  )
}
