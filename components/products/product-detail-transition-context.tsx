'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

type ProductDetailTransitionContextValue = {
  heroReady: boolean
  serverReady: boolean
  markHeroReady: () => void
  markServerReady: () => void
}

const ProductDetailTransitionContext = createContext<ProductDetailTransitionContextValue | null>(null)

export function ProductDetailTransitionProvider({ children }: { children: ReactNode }) {
  const [heroReady, setHeroReady] = useState(false)
  const [serverReady, setServerReady] = useState(false)

  const markHeroReady = useCallback(() => setHeroReady(true), [])
  const markServerReady = useCallback(() => setServerReady(true), [])

  const value = useMemo(
    () => ({ heroReady, serverReady, markHeroReady, markServerReady }),
    [heroReady, serverReady, markHeroReady, markServerReady],
  )

  return (
    <ProductDetailTransitionContext.Provider value={value}>{children}</ProductDetailTransitionContext.Provider>
  )
}

export function useProductDetailTransition() {
  const ctx = useContext(ProductDetailTransitionContext)
  if (!ctx) {
    throw new Error('useProductDetailTransition must be used within ProductDetailTransitionProvider')
  }
  return ctx
}

export function ProductDetailHeroReadySignal() {
  const { markHeroReady } = useProductDetailTransition()
  useEffect(() => {
    markHeroReady()
  }, [markHeroReady])
  return null
}

export function ProductDetailServerReadySignal() {
  const { markServerReady } = useProductDetailTransition()
  useEffect(() => {
    markServerReady()
  }, [markServerReady])
  return null
}
