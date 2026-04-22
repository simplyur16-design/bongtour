'use client'

import { useState } from 'react'
import { FALLBACK_IMAGE } from '../_lib/utils'

export interface PrimaryImagePreviewProps {
  url: string | null | undefined
}

export default function PrimaryImagePreview({ url }: PrimaryImagePreviewProps) {
  const [broken, setBroken] = useState(false)
  const src = !url || broken ? FALLBACK_IMAGE : url
  return (
    <img
      src={src}
      alt="대표 이미지"
      className="max-h-48 w-full rounded-lg object-contain bg-bt-title"
      onError={() => setBroken(true)}
    />
  )
}
