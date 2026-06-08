'use client'

import HorizontalScrollWithArrows from '@/components/ui/HorizontalScrollWithArrows'
import type { ReactNode } from 'react'

type Props = {
  children: ReactNode
  /** Outer spacing, e.g. `mt-3` */
  className?: string
}

export function HubExploreHorizontalScrollRow({
  children,
  className = '',
}: Props) {
  return (
    <HorizontalScrollWithArrows
      className={className}
      scrollClassName="flex flex-nowrap gap-3 overflow-x-auto pb-2 pl-0 pr-0 [-webkit-overflow-scrolling:touch] overscroll-x-contain md:pl-10 md:pr-10"
      scrollRatio={0.72}
    >
      {children}
    </HorizontalScrollWithArrows>
  )
}
