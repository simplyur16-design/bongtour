import { headers } from 'next/headers'

/** Link/Router prefetch — 실제 클릭 네비게이션과 구분(헤더 누락 시 sec-fetch·rsc 보조) */
export async function isNextRouterPrefetchRequest(): Promise<boolean> {
  const h = await headers()
  if (h.get('Next-Router-Prefetch') === '1') return true
  const purpose = h.get('Purpose') ?? h.get('Sec-Purpose')
  if (purpose === 'prefetch') return true
  if (h.get('rsc') !== '1') return false
  return h.get('sec-fetch-dest') === 'empty' && h.get('sec-fetch-mode') === 'cors' && h.has('next-url')
}
