'use client'

/**
 * 동선지도 — 등록 시 저장된 이미지만 표시. 클릭 시 생성 금지.
 */

import { useEffect, useState } from 'react'

type Edge = { from: number; to: number; label: string; mode?: string }
type Node = { order: number; city: string }

type Props = {
  productKey: string
  routeSummary: string
  nodes: Node[]
  edges: Edge[]
}

type LoadState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ok'; dataUrl: string }
  | { status: 'fail'; reason: string }

export default function RouteMapGeminiImage({ productKey, routeSummary, nodes }: Props) {
  const [state, setState] = useState<LoadState>({ status: 'idle' })

  useEffect(() => {
    let cancelled = false
    setState({ status: 'loading' })
    const q = encodeURIComponent(productKey)
    fetch(`/api/dev/product-surface-route-map?slug=${q}`)
      .then(async (res) => {
        const j = (await res.json()) as { ok?: boolean; dataUrl?: string; reason?: string }
        if (cancelled) return
        if (j.ok && j.dataUrl) setState({ status: 'ok', dataUrl: j.dataUrl })
        else setState({ status: 'fail', reason: j.reason || `http_${res.status}` })
      })
      .catch((e) => {
        if (cancelled) return
        setState({ status: 'fail', reason: e instanceof Error ? e.message : 'fetch_failed' })
      })
    return () => {
      cancelled = true
    }
  }, [productKey])

  return (
    <div className="ps-map">
      <p className="ps-map-story">{routeSummary}</p>
      {state.status === 'idle' || state.status === 'loading' ? (
        <div className="ps-map-loading" role="status">
          <p>저장된 동선지도 불러오는 중…</p>
          <p className="ps-map-note">{nodes.map((n) => n.city).join(' → ')}</p>
        </div>
      ) : null}
      {state.status === 'ok' ? (
        // eslint-disable-next-line @next/next/no-img-element -- persisted map URL
        <img className="ps-map-gemini-img" src={state.dataUrl} alt={routeSummary || '동선지도'} />
      ) : null}
      {state.status === 'fail' ? (
        <div className="ps-map-loading">
          <p>등록 시 저장된 동선지도 없음</p>
          <p className="ps-map-note">{state.reason}</p>
        </div>
      ) : null}
    </div>
  )
}
