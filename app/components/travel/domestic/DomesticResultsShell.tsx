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

  clear(['regionPref', 'tripDays', 'companions', 'sort'])

  if (a.kind === 'region') {
    const pref = a.destinationTerms?.length ? a.destinationTerms.join(',') : a.summaryLabel
    if (pref.trim()) sp.set('regionPref', pref)
    return sp
  }

  if (a.kind === 'terms') {
    if (a.terms.length > 0) sp.set('regionPref', a.terms.join(','))
    if (a.pillar === 'schedule') {
      if (a.secondKey === 'day') sp.set('tripDays', '1')
      else if (a.secondKey === 'n1') sp.set('tripDays', '2')
      else if (a.secondKey === 'n2p') sp.set('tripDays', '3')
    }
    if (a.pillar === 'audience') {
      const companionMap: Record<string, string> = {
        filial: 'parents',
        family: 'kids',
        couple: 'couple',
        friends: 'friends',
      }
      const companion = companionMap[a.secondKey]
      if (companion) sp.set('companions', companion)
    }
    return sp
  }

  // special
  if (a.mode === 'value') sp.set('sort', 'price_asc')
  else if (a.mode === 'closing') sp.set('sort', 'departure_asc')
  else sp.set('sort', 'popular')
  return sp
}

export default function DomesticResultsShell() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const onApply = useCallback(
    (a: DomesticNavApply) => {
      const next = applyDomesticNavToQuery(new URLSearchParams(searchParams.toString()), a)
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
