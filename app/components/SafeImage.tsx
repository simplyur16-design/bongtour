'use client'

import { useState } from 'react'
import Image, { type ImageProps } from 'next/image'
import { isSrcOptimizableByNextImage } from '@/lib/is-src-optimizable-by-next-image'

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
