'use client'

import SafeImage from '@/app/components/SafeImage'
import { useState } from 'react'
import { getBrandLabel } from '@/lib/brands'

type Props = { brandKey: string }

export default function HqBrandBadge({ brandKey }: Props) {
  const label = getBrandLabel(brandKey)
  const [logoError, setLogoError] = useState(false)
  if (!label) return null

  const logoSrc = `/image/brands/${brandKey}.png`

  return (
    <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-sm">
      <span className="text-xs font-medium text-gray-500">공식 제휴 상품</span>
      <span className="text-gray-300">|</span>
      {!logoError ? (
        <SafeImage
          src={logoSrc}
          alt={label}
          width={120}
          height={24}
          className="h-6 max-w-[120px] object-contain object-left"
          onError={() => setLogoError(true)}
        />
      ) : null}
      <span className="text-sm font-semibold text-gray-700">{label}</span>
    </div>
  )
}
