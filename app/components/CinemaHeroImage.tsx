'use client'

import type { ImageProps } from 'next/image'
import SafeImage from '@/app/components/SafeImage'
import { CINEMA_HERO_OBJECT_POSITION } from '@/lib/cinema-hero-frame-class'

type Props = {
  src: string
  alt?: string
  sizes?: string
  priority?: boolean
  loading?: ImageProps['loading']
  onError?: React.ReactEventHandler<HTMLImageElement>
  objectPosition?: string
}

/**
 * 풀폭 히어로 — 앞·뒤 모두 cover, 초점은 사진 하단 1/3 중앙.
 * 뒤 레이어는 블러로 크롭 경계를 부드럽게(과한 줌인 느낌 완화).
 */
export default function CinemaHeroImage({
  src,
  alt = '',
  sizes = '100vw',
  priority,
  loading,
  onError,
  objectPosition = CINEMA_HERO_OBJECT_POSITION,
}: Props) {
  const fitStyle = { objectPosition, objectFit: 'cover' as const }
  return (
    <div className="relative h-full w-full min-h-0 overflow-hidden">
      {/* REGRESSION-FREEZE[cinema-hero-lcp-not-lazy-blur]: 첫 장 priority면 뒤 블러도 eager — 늦은 LCP 방지 — manifest */}
      <SafeImage
        src={src}
        alt=""
        aria-hidden
        fill
        className="scale-105 object-cover opacity-40 blur-md saturate-110"
        style={fitStyle}
        sizes={sizes}
        priority={priority}
        loading={priority ? 'eager' : 'lazy'}
      />
      <SafeImage
        src={src}
        alt={alt}
        fill
        className="object-cover"
        style={fitStyle}
        sizes={sizes}
        priority={priority}
        loading={loading}
        onError={onError}
      />
    </div>
  )
}
