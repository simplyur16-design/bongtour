'use client'

import { useState } from 'react'
import Image, { type ImageProps } from 'next/image'

/**
 * `next.config.js` `images.remotePatterns`에 등록된 원격 호스트는 기본적으로 Next 이미지 최적화를 사용합니다.
 * 그 외 URL은 기존과 같이 `unoptimized`로 안전하게 둡니다. 호출부에서 `unoptimized`를 넘기면 그 값이 우선합니다.
 */
function isSrcOptimizableByNextImage(src: ImageProps['src']): boolean {
  if (typeof src !== 'string') {
    return true
  }
  const t = src.trim()
  if (t.startsWith('/')) return true
  if (t.startsWith('data:')) return false
  try {
    const u = new URL(t)
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return false
    const host = u.hostname.toLowerCase()
    if (host === 'picsum.photos') return true
    if (host === 'images.unsplash.com') return true
    if (host === 'images.pexels.com') return true
    if (host === 'flagcdn.com' || host.endsWith('.flagcdn.com')) return true
    if (host === 'kr.object.ncloudstorage.com') return true
    if (host.endsWith('.object.ncloudstorage.com')) return true
    if (host.endsWith('.supabase.co') && u.pathname.startsWith('/storage/v1')) return true
    return false
  } catch {
    return false
  }
}

/**
 * 이미지 로딩 실패(404 등) 시 레이아웃이 깨지지 않고 placeholder를 보여줍니다.
 * 콘솔에 에러가 나와도 애니메이션 흐름은 계속 진행됩니다.
 */
export default function SafeImage({
  src,
  alt,
  width,
  height,
  className,
  unoptimized: unoptimizedProp,
  ...rest
}: ImageProps) {
  const [error, setError] = useState(false)

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

  const resolvedUnoptimized =
    unoptimizedProp !== undefined ? unoptimizedProp : !isSrcOptimizableByNextImage(src)

  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      className={className}
      onError={handleError}
      draggable={false}
      onDragStart={(e) => e.preventDefault()}
      {...rest}
      unoptimized={resolvedUnoptimized}
    />
  )
}
