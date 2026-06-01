'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

const DETAIL_LOADING_BODY_ATTR = 'data-bt-detail-loading'

type ProductDetailTransitionContextValue = {
  serverReady: boolean
  markServerReady: () => void
}

const ProductDetailTransitionContext = createContext<ProductDetailTransitionContextValue | null>(null)

export function setProductDetailRouteLoading(active: boolean) {
  if (typeof document === 'undefined') return
  if (active) {
    document.body.setAttribute(DETAIL_LOADING_BODY_ATTR, '1')
  } else {
    document.body.removeAttribute(DETAIL_LOADING_BODY_ATTR)
  }
}

export function isProductDetailRouteLoading(): boolean {
  if (typeof document === 'undefined') return false
  return document.body.hasAttribute(DETAIL_LOADING_BODY_ATTR)
}

export function ProductDetailTransitionProvider({ children }: { children: ReactNode }) {
  const [serverReady, setServerReady] = useState(false)

  const markServerReady = useCallback(() => {
    setServerReady(true)
    setProductDetailRouteLoading(false)
  }, [])

  useEffect(() => {
    setProductDetailRouteLoading(true)
    return () => setProductDetailRouteLoading(false)
  }, [])

  const value = useMemo(() => ({ serverReady, markServerReady }), [serverReady, markServerReady])

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

export function ProductDetailServerReadySignal() {
  const { markServerReady } = useProductDetailTransition()
  useEffect(() => {
    markServerReady()
  }, [markServerReady])
  return null
}
