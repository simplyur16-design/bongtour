'use client'

import { useEffect, useState } from 'react'
import Image, { type ImageProps } from 'next/image'
import { isSrcOptimizableByNextImage } from '@/lib/is-src-optimizable-by-next-image'

function isNcloudHostUrl(src: string): boolean {
  const lower = src.toLowerCase()
  return lower.includes('ncloudstorage.com') || lower.includes('ncloud.com')
}

/** Ncloud 객체 URL의 경로가 `.webp`로 끝나는지(대소문자 무시). */
function urlPathEndsWithWebp(src: string): boolean {
  try {
    return new URL(src).pathname.toLowerCase().endsWith('.webp')
  } catch {
    return /\.webp(\?|#|$)/i.test(src)
  }
}

/**
 * 이미지 로딩 실패(404 등) 시 레이아웃이 깨지지 않고 placeholder를 보여줍니다.
 * 콘솔에 에러가 나와도 애니메이션 흐름은 계속 진행됩니다.
 *
 * **Ncloud** (`ncloudstorage` / `ncloud`) URL은 `next/image`를 쓰지 않고 `<img>`로 직접 로드합니다(프록시·재인코딩 없음).
 * 경로가 `.webp`가 아니면 `console.warn`으로 이후 WebP 변환 후보를 표시합니다. 그 외 호스트만 `next/image` 사용.
 */
export default function SafeImage({
  src,
  alt,
  width,
  height,
  className,
  unoptimized: unoptimizedProp,
  fill,
  priority,
  ...rest
}: ImageProps) {
  const [error, setError] = useState(false)

  useEffect(() => {
    if (typeof src !== 'string' || error) return
    if (!isNcloudHostUrl(src)) return
    if (urlPathEndsWithWebp(src)) return
    console.warn('[SafeImage] non-webp ncloud image:', src)
  }, [src, error])

  const handleError = () => {
    setError(true)
    // 개발 시 확인용 (필요시 주석 해제)
    // console.warn('[Bong투어] 이미지를 불러올 수 없습니다:', src)
  }

  if (error) {
    return (
      <div
        className={className}
        style={{
          width: typeof width === 'number' ? width : 120,
          height: typeof height === 'number' ? height : 120,
          minWidth: typeof width === 'number' ? width : 120,
          minHeight: typeof height === 'number' ? height : 120,
          backgroundColor: 'rgba(255, 140, 0, 0.15)',
          borderRadius: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        title={`이미지 없음: ${src}`}
      >
        <span className="text-xs text-bong-orange/70">🖼</span>
      </div>
    )
  }

  if (typeof src === 'string' && isNcloudHostUrl(src)) {
    const loading = priority ? 'eager' : 'lazy'
    const imgClassName = [fill ? 'absolute inset-0 block h-full w-full' : '', className].filter(Boolean).join(' ') || undefined
    return (
      // eslint-disable-next-line @next/next/no-img-element -- Ncloud는 원본 URL 직접 로드(최적화 프록시 미사용)
      <img
        src={src}
        alt={alt}
        width={fill ? undefined : typeof width === 'number' ? width : undefined}
        height={fill ? undefined : typeof height === 'number' ? height : undefined}
        loading={loading}
        decoding="async"
        className={imgClassName}
        style={fill ? { objectFit: 'cover', width: '100%', height: '100%' } : { objectFit: 'cover', maxWidth: '100%', height: 'auto' }}
        onError={handleError}
        draggable={false}
        onDragStart={(e) => e.preventDefault()}
      />
    )
  }

  const resolvedUnoptimized =
    unoptimizedProp !== undefined ? unoptimizedProp : !isSrcOptimizableByNextImage(src)

  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      className={className}
      fill={fill}
      priority={priority}
      onError={handleError}
      draggable={false}
      onDragStart={(e) => e.preventDefault()}
      {...rest}
      unoptimized={resolvedUnoptimized}
    />
  )
}
