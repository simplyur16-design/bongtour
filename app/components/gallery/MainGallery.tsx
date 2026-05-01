'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import AgentCard from './AgentCard'
import type { GalleryProduct } from '@/app/api/gallery/route'

const LIMIT = 6
const PAGE_SIZE = 6

type GalleryResponse = {
  items: GalleryProduct[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export default function MainGallery() {
  const [data, setData] = useState<GalleryResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)

  const fetchPage = useCallback(async (p: number) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/gallery?page=${p}&limit=${PAGE_SIZE}`)
      if (!res.ok) throw new Error('Failed to fetch')
      const json: GalleryResponse = await res.json()
      setData(json)
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPage(page)
  }, [page, fetchPage])

  const totalPages = data?.totalPages ?? 0
  const hasPagination = (data?.total ?? 0) > LIMIT

  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <h2 className="sr-only">상품 갤러리</h2>

      {loading && !data ? (
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-lg overflow-hidden" style={{ animationDelay: `${i * 50}ms` }}>
              <div className="flex gap-px">
                {[1, 2, 3, 4, 5].map((j) => (
                  <div
                    key={j}
                    className="aspect-[4/3] w-[42vw] min-w-[140px] max-w-[220px] sm:w-[180px] sm:max-w-[200px] flex-shrink-0 animate-pulse bg-primary/10"
                  />
                ))}
              </div>
              <div className="h-20 animate-pulse bg-primary/5" />
            </div>
          ))}
        </div>
      ) : (
        <>
          <AnimatePresence mode="wait">
            <motion.div
              key={page}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3"
            >
              {data?.items.map((product, i) => (
                <AgentCard
                  key={product.id}
                  product={product}
                  priority={page === 1 && i === 0}
                  editorial
                />
              ))}
            </motion.div>
          </AnimatePresence>

          {hasPagination && totalPages > 1 && (
            <nav
              className="mt-12 flex items-center justify-center gap-2 border-t border-primary/10 pt-8"
              aria-label="페이지 이동"
            >
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="rounded border border-primary/20 px-3 py-2 text-sm font-medium text-primary disabled:opacity-40 disabled:cursor-not-allowed hover:bg-primary/5"
              >
                이전
              </button>
              <span className="px-4 py-2 text-sm font-medium tracking-tighter text-primary/80">
                {page} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="rounded border border-primary/20 px-3 py-2 text-sm font-medium text-primary disabled:opacity-40 disabled:cursor-not-allowed hover:bg-primary/5"
              >
                다음
              </button>
            </nav>
          )}
        </>
      )}
    </section>
  )
}
