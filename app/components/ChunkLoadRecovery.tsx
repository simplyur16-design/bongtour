'use client'

import { useEffect } from 'react'

const SESSION_KEY = 'bongtour.chunkload.autoReloadOnce'

function isChunkLoadFailure(reason: unknown, message: string): boolean {
  const m = `${message} ${reason instanceof Error ? reason.message : ''} ${reason && typeof reason === 'object' && 'name' in reason ? String((reason as { name?: string }).name) : ''}`
  return /ChunkLoadError|Loading chunk \d+ failed/i.test(m)
}

/**
 * 배포 후 구 빌드 HTML + 신규 `_next/static/chunks/*` 불일치 시 webpack이 ChunkLoadError를 낸다.
 * 탭당 1회 자동 새로고침으로 대부분 해소(무한 루프 방지).
 */
export default function ChunkLoadRecovery() {
  useEffect(() => {
    const tryReloadOnce = () => {
      if (typeof sessionStorage === 'undefined') return
      if (sessionStorage.getItem(SESSION_KEY)) return
      sessionStorage.setItem(SESSION_KEY, '1')
      window.location.reload()
    }

    const onWindowError = (ev: ErrorEvent) => {
      if (isChunkLoadFailure(ev.error, ev.message)) tryReloadOnce()
    }

    const onUnhandledRejection = (ev: PromiseRejectionEvent) => {
      if (isChunkLoadFailure(ev.reason, '')) tryReloadOnce()
    }

    window.addEventListener('error', onWindowError)
    window.addEventListener('unhandledrejection', onUnhandledRejection)
    return () => {
      window.removeEventListener('error', onWindowError)
      window.removeEventListener('unhandledrejection', onUnhandledRejection)
    }
  }, [])

  return null
}
