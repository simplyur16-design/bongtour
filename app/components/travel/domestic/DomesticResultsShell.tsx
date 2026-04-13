'use client'

import { useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import DomesticTravelSubMainNav, { type DomesticNavApply } from '@/app/components/travel/domestic/DomesticTravelSubMainNav'
import ProductsBrowseClient from '@/components/products/ProductsBrowseClient'

function applyDomesticNavToQuery(search: URLSearchParams, a: DomesticNavApply): URLSearchParams {
  const sp = new URLSearchParams(search.toString())
  const clear = (keys: string[]) => keys.forEach((k) => sp.delete(k))

  sp.set('page', '1')
  sp.set('dmPillar', a.pillar)
  sp.set('dmItem', a.secondKey)

  clear(['regionPref', 'tripDays', 'companions', 'sort', 'domesticTransport', 'domesticSpecialTheme'])

  if (a.kind === 'region') {
    const pref = a.destinationTerms?.length ? a.destinationTerms.join(',') : a.summaryLabel
    if (pref.trim()) sp.set('regionPref', pref)
    return sp
  }

  if (a.kind === 'terms') {
    if (a.pillar === 'bus') {
      sp.set('domesticTransport', 'bus')
      sp.set('sort', 'popular')
      return sp
    }
    if (a.pillar === 'train') {
      sp.set('domesticTransport', 'train')
      sp.set('sort', 'popular')
      return sp
    }
    if (a.pillar === 'ship') {
      sp.set('domesticTransport', 'ship')
      sp.set('sort', 'popular')
      return sp
    }
    // schedule: 제목·dmItem 기반 browse 전용 — regionPref/tripDays 미설정
    return sp
  }

  sp.set('domesticSpecialTheme', '1')
  sp.set('sort', 'popular')
  return sp
}

export default function DomesticResultsShell() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const onApply = useCallback(
    (nav: DomesticNavApply) => {
      const next = applyDomesticNavToQuery(new URLSearchParams(searchParams.toString()), nav)
      router.replace(`/travel/domestic?${next.toString()}`)
    },
    [router, searchParams]
  )

  return (
    <>
      <DomesticTravelSubMainNav onApply={onApply} />
      <ProductsBrowseClient
        basePath="/travel/domestic"
        defaultScope="domestic"
        pageTitle="국내여행 상품"
      />
    </>
  )
}
