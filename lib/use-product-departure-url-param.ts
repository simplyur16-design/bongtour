'use client'

import { useSearchParams } from 'next/navigation'

/** `?departure=YYYY-MM-DD` — 출발일 딥링크(클라이언트 전용, ISR 유지) */
export function useProductDepartureYmdFromUrl(): string | null {
  const raw = (useSearchParams()?.get('departure') ?? '').trim()
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null
}
