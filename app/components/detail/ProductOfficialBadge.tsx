'use client'

import Image from 'next/image'
import { useState } from 'react'
import { getLogoPathForDisplayName } from '@/lib/brands'
import { formatOriginSourceForDisplay } from '@/lib/supplier-origin'
type Props = {
  /** 업체명. 로고 파일 있으면 로고, 없으면 굵은 텍스트로 표시 */
  organizerName: string | null | undefined
}

/**
 * 상세 페이지 상단: 로고 있으면 120px 로고, 없으면 업체명 굵은 텍스트 + Bong투어 검수 완료 배지.
 */
export default function ProductOfficialBadge({ organizerName }: Props) {
  const [logoError, setLogoError] = useState(false)
  const raw = organizerName?.trim() || ''
  const name = raw ? formatOriginSourceForDisplay(raw) : ''
  const logoPath = getLogoPathForDisplayName(name)
  const showLogo = logoPath && !logoError

  if (!name) return null

  return (
    <div className="flex flex-wrap items-center gap-4 border border-gray-200 bg-white px-4 py-3 sm:gap-5">
      {showLogo ? (
        <Image
          src={logoPath}
          alt={name}
          width={120}
          height={40}
          className="h-8 w-[120px] object-contain object-left"
          onError={() => setLogoError(true)}
        />
      ) : (
        <span className="text-base font-bold text-gray-900">{name}</span>
      )}
      <span className="border-l-4 border-[#0f172a] bg-white py-1 pl-2 text-xs font-semibold text-[#0f172a]">Bong투어 검수 완료</span>
    </div>
  )
}
