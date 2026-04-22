'use client'

import { useState } from 'react'
import { FALLBACK_IMAGE } from '../_lib/utils'

export interface ScheduleImageProps {
  url: string | null | undefined
  alt: string
}

export default function ScheduleImage({ url, alt }: ScheduleImageProps) {
  const [broken, setBroken] = useState(false)
  const src = !url || broken ? FALLBACK_IMAGE : url
  return (
    <img
      src={src}
      alt={alt}
      className="h-24 w-full rounded object-cover"
      onError={() => setBroken(true)}
    />
  )
}
