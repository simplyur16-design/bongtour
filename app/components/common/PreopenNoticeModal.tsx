'use client'

import { useCallback, useEffect, useId, useState } from 'react'
import {
  isPreopenNoticeSuppressed,
  PREOPEN_OFFICIAL_OPEN_DATE,
  setPreopenNoticeHiddenUntilNextLocalMidnight,
} from '@/lib/preopen-notice'

/**
 * 테스트 운영·정식 오픈 전 안내. 홈(`/`)에서만 마운트.
 * SSR과 불일치 없음: 마운트 후 localStorage 확인 뒤에만 표시.
 */
export default function PreopenNoticeModal() {
  const titleId = useId()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (isPreopenNoticeSuppressed()) return
    setOpen(true)
  }, [])

  const close = useCallback(() => setOpen(false), [])

  const onSnoozeToday = useCallback(() => {
    setPreopenNoticeHiddenUntilNextLocalMidnight()
    setOpen(false)
  }, [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        close()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, close])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center p-4 sm:items-center"
      role="presentation"
    >
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/45 backdrop-blur-[2px] transition-opacity"
        aria-label="안내 닫기(배경)"
        onClick={close}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-[201] w-full max-w-md rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xl shadow-slate-900/10 sm:p-6"
        tabIndex={-1}
      >
        <h2 id={titleId} className="text-lg font-bold leading-snug tracking-tight text-slate-900 sm:text-xl">
          봉투어는 현재 테스트 운영 중입니다
        </h2>
        <div className="mt-4 space-y-3 text-sm leading-relaxed text-slate-600">
          <p>정식 오픈 전 기능과 화면을 점검하고 있습니다.</p>
          <p>일부 문의·예약·상담 기능은 테스트 중이므로 안내 방식이 달라질 수 있습니다.</p>
          <p className="font-medium text-slate-800">
            정식 오픈일은{' '}
            <span className="font-bold text-emerald-700">{PREOPEN_OFFICIAL_OPEN_DATE}</span>
            입니다.
          </p>
          <p>불편하신 점은 문의 남겨주시면 빠르게 반영하겠습니다.</p>
        </div>
        <p className="mt-4 border-t border-slate-100 pt-3 text-xs leading-relaxed text-slate-500">
          현재 접수되는 문의는 정상 확인되며, 테스트 기간 중 답변 방식이 일부 조정될 수 있습니다.
        </p>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
          <button
            type="button"
            onClick={onSnoozeToday}
            className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
          >
            오늘 하루 보지 않기
          </button>
          <button
            type="button"
            onClick={close}
            className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
          >
            확인
          </button>
        </div>
      </div>
    </div>
  )
}
