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
      <SafeImage
        src={src}
        alt=""
        aria-hidden
        fill
        className="scale-110 object-cover opacity-55 blur-2xl saturate-125"
        style={fitStyle}
        sizes={sizes}
        loading="lazy"
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
