import { headers } from 'next/headers'
import type { CurationScope, PublicCurationCard } from '@/lib/monthly-curation'

export type MainCurationFetchResult = {
  items: PublicCurationCard[]
  error: string | null
  /** 요청한 `yearMonth`에 맞는 카드가 없어 scope만으로 재조회했을 때 */
  usedLooseMonth: boolean
}

async function getServerOrigin(): Promise<string> {
  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host')
  const proto =
    h.get('x-forwarded-proto') ?? (host?.includes('localhost') || host?.startsWith('127.') ? 'http' : 'https')
  if (host) return `${proto}://${host}`
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXTAUTH_URL?.trim() ||
    'http://localhost:3000'
  return raw.replace(/\/$/, '')
}

async function fetchMonthlyJson(
  base: string,
  scope: CurationScope,
  yearMonth?: string
): Promise<{ ok: boolean; items: PublicCurationCard[]; error?: string }> {
  const q = new URLSearchParams({ scope })
  if (yearMonth) q.set('yearMonth', yearMonth)
  const res = await fetch(`${base}/api/curations/monthly?${q}`, {
    next: { revalidate: 300 },
  })
  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean
    items?: PublicCurationCard[]
    error?: string
  }
  if (!res.ok || data.ok === false) {
    return {
      ok: false,
      items: [],
      error: typeof data.error === 'string' ? data.error : `HTTP ${res.status}`,
    }
  }
  return { ok: true, items: Array.isArray(data.items) ? data.items : [] }
}

/**
 * 메인 전용: P5 공개 API를 호출해 큐레이션 카드 로드.
 * 1) `yearMonth` 지정 조회 → 비어 있으면 2) 동일 scope에서 월 무관 조회(최대 `maxItems`건).
 */
export async function fetchCurationsForMainPage(
  scope: CurationScope,
  yearMonth: string,
  maxItems = 3
): Promise<MainCurationFetchResult> {
  try {
    const base = await getServerOrigin()
    const first = await fetchMonthlyJson(base, scope, yearMonth)
    if (!first.ok) {
      return { items: [], error: first.error ?? '큐레이션을 불러오지 못했습니다.', usedLooseMonth: false }
    }
    let items = first.items
    let usedLooseMonth = false
    if (items.length === 0) {
      const second = await fetchMonthlyJson(base, scope)
      if (second.ok && second.items.length > 0) {
        items = second.items
        usedLooseMonth = true
      }
    }
    return {
      items: items.slice(0, maxItems),
      error: null,
      usedLooseMonth,
    }
  } catch {
    return {
      items: [],
      error: '큐레이션을 불러오지 못했습니다.',
      usedLooseMonth: false,
    }
  }
}
