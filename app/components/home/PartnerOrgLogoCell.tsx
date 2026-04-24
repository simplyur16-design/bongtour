'use client'

import { useState } from 'react'

type Props = {
  name: string
  src: string
  /** 레거시: next/image용이었음. `<img>`에는 미사용 */
  sizes?: string
  imageClassName: string
  /** 고정 높이 로고 영역 (카드 높이와 분리) */
  wrapperClassName?: string
  /** 기관별 보정: 예 max-h-[90%], scale-110 등 */
  logoClassName?: string
}

/** `public/images/org-logos/` 로컬 로고 — 작은 정적 파일은 `<img>`로 직접 로드( `/_next/image` 큐 회피 ) */
export default function PartnerOrgLogoCell({
  name,
  src,
  imageClassName,
  wrapperClassName = 'h-[48px] w-full min-h-0 sm:h-[52px] md:h-[56px]',
  logoClassName,
}: Props) {
  const [failed, setFailed] = useState(false)

  if (failed) {
    return (
      <div className={`flex items-center justify-center px-1 ${wrapperClassName}`}>
        <span className="text-center text-[11px] font-medium leading-tight text-slate-600 sm:text-xs">
          {name}
        </span>
      </div>
    )
  }

  return (
    <div className={`relative flex w-full min-w-0 items-center justify-center ${wrapperClassName}`}>
      <img
        src={src}
        alt={name}
        width={200}
        height={80}
        loading="lazy"
        decoding="async"
        className={`max-h-full max-w-full object-contain object-center ${imageClassName} ${logoClassName ?? 'max-h-full'}`}
        onError={() => setFailed(true)}
      />
    </div>
  )
}
