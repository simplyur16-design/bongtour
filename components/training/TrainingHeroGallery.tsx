'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import PublicImageBottomOverlay from '@/app/components/ui/PublicImageBottomOverlay'
import SafeImage from '@/app/components/SafeImage'
import type { TrainingHeroImageSlot } from '@/lib/overseas-training-meta-json'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'

type Props = {
  slides: TrainingHeroImageSlot[]
  title?: string
  className?: string
}

export default function TrainingHeroGallery({ slides, title, className = '' }: Props) {
  const items = useMemo(
    () => slides.filter((s) => s.url?.trim()).slice(0, 4),
    [slides]
  )
  const [index, setIndex] = useState(0)
  const [lightbox, setLightbox] = useState(false)

  useEffect(() => {
    setIndex(0)
  }, [items.length])

  const go = useCallback(
    (delta: number) => {
      if (items.length <= 1) return
      setIndex((i) => (i + delta + items.length) % items.length)
    },
    [items.length]
  )

  useEffect(() => {
    if (!lightbox) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightbox(false)
      if (e.key === 'ArrowLeft') go(-1)
      if (e.key === 'ArrowRight') go(1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lightbox, go])

  if (items.length === 0) {
    return (
      <div className={`relative aspect-[21/9] max-h-[420px] w-full bg-[#F5F2EA] sm:aspect-[2.4/1] ${className}`}>
        <div className="flex h-full items-center justify-center text-sm text-[#534AB7]">대표 이미지 준비 중</div>
      </div>
    )
  }

  const current = items[index]!
  const alt = title ? `${title} — 사진 ${index + 1}` : `프로그램 사진 ${index + 1}`

  return (
    <>
      <div
        className={`group relative aspect-[21/9] max-h-[420px] w-full cursor-pointer overflow-hidden bg-[#F5F2EA] sm:aspect-[2.4/1] ${className}`}
        onClick={() => setLightbox(true)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setLightbox(true)
          }
        }}
        aria-label="사진 크게 보기"
      >
        <SafeImage
          src={current.url}
          alt={alt}
          fill
          sizes="100vw"
          className="object-cover transition duration-300 group-hover:scale-[1.01]"
          priority
        />
        <PublicImageBottomOverlay rightLabel={current.credit || (current.isGenerated ? 'AI 생성 참고 이미지' : null)} />
        {items.length > 1 ? (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                go(-1)
              }}
              className="absolute left-3 top-1/2 z-20 -translate-y-1/2 rounded-full bg-black/45 p-2 text-white hover:bg-black/60"
              aria-label="이전 사진"
            >
              <ChevronLeft size={22} />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                go(1)
              }}
              className="absolute right-3 top-1/2 z-20 -translate-y-1/2 rounded-full bg-black/45 p-2 text-white hover:bg-black/60"
              aria-label="다음 사진"
            >
              <ChevronRight size={22} />
            </button>
            <div className="absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 gap-1.5">
              {items.map((_, i) => (
                <span
                  key={i}
                  className={`h-1.5 w-1.5 rounded-full ${i === index ? 'bg-white' : 'bg-white/45'}`}
                />
              ))}
            </div>
          </>
        ) : null}
      </div>

      {lightbox ? (
        <div
          className="fixed inset-0 z-[200] flex flex-col bg-black/90"
          role="dialog"
          aria-modal="true"
          onClick={() => setLightbox(false)}
        >
          <button
            type="button"
            className="absolute right-4 top-4 z-30 rounded-full bg-white/90 p-2 text-[#1F1B2D]"
            onClick={() => setLightbox(false)}
            aria-label="닫기"
          >
            <X size={22} />
          </button>
          {items.length > 1 ? (
            <>
              <button
                type="button"
                className="absolute left-4 top-1/2 z-30 -translate-y-1/2 rounded-full bg-white/20 p-3 text-white hover:bg-white/35"
                onClick={(e) => {
                  e.stopPropagation()
                  go(-1)
                }}
                aria-label="이전"
              >
                <ChevronLeft size={28} />
              </button>
              <button
                type="button"
                className="absolute right-4 top-1/2 z-30 -translate-y-1/2 rounded-full bg-white/20 p-3 text-white hover:bg-white/35"
                onClick={(e) => {
                  e.stopPropagation()
                  go(1)
                }}
                aria-label="다음"
              >
                <ChevronRight size={28} />
              </button>
            </>
          ) : null}
          <div
            className="relative mx-auto flex h-full w-full max-w-6xl flex-1 items-center justify-center px-4 py-16"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative h-full w-full min-h-[40vh]">
              <SafeImage src={current.url} alt={alt} fill className="object-contain" sizes="100vw" />
              <PublicImageBottomOverlay
                rightLabel={current.credit || (current.isGenerated ? 'AI 생성 참고 이미지' : null)}
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
