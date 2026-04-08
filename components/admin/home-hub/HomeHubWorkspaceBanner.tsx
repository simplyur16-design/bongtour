'use client'

import { useEffect } from 'react'

type Props = {
  variant: 'success' | 'error'
  message: string
  onDismiss: () => void
}

export function HomeHubWorkspaceBanner({ variant, message, onDismiss }: Props) {
  useEffect(() => {
    const t = window.setTimeout(onDismiss, 7000)
    return () => window.clearTimeout(t)
  }, [message, onDismiss])

  const styles =
    variant === 'success'
      ? 'border-teal-500/60 bg-teal-950/50 text-teal-100'
      : 'border-red-500/50 bg-red-950/40 text-red-100'

  return (
    <div
      role="status"
      className={`fixed bottom-6 left-1/2 z-[60] flex max-w-lg -translate-x-1/2 items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-lg shadow-black/40 ${styles}`}
    >
      <p className="flex-1 leading-relaxed">{message}</p>
      <button
        type="button"
        onClick={onDismiss}
        className="shrink-0 rounded px-2 py-0.5 text-xs opacity-80 hover:opacity-100"
      >
        닫기
      </button>
    </div>
  )
}
