'use client'

import HorizontalScrollWithArrows from '@/components/ui/HorizontalScrollWithArrows'
import type { ReactNode } from 'react'

export default function OverseasProductScrollRow({
  ariaLabel,
  children,
}: {
  ariaLabel: string
  children: ReactNode
}) {
  return (
    <HorizontalScrollWithArrows
      as="ul"
      className="mt-5 -mx-4 sm:mx-0"
      scrollClassName="flex snap-x snap-mandatory gap-4 overflow-x-auto overflow-y-visible overscroll-x-contain px-4 pb-2 pt-0.5 [-webkit-overflow-scrolling:touch] [scrollbar-gutter:stable] sm:px-0"
      ariaLabel={ariaLabel}
    >
      {children}
    </HorizontalScrollWithArrows>
  )
}
