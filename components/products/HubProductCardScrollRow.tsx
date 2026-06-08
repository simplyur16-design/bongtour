'use client'

import HorizontalScrollWithArrows from '@/components/ui/HorizontalScrollWithArrows'
import type { ReactNode } from 'react'

type Props = {
  ariaLabel: string
  scrollClassName: string
  children: ReactNode
}

export default function HubProductCardScrollRow({ ariaLabel, scrollClassName, children }: Props) {
  return (
    <HorizontalScrollWithArrows as="ul" ariaLabel={ariaLabel} scrollClassName={scrollClassName}>
      {children}
    </HorizontalScrollWithArrows>
  )
}
