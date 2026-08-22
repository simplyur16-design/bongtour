'use client'

import { useEffect, useState } from 'react'
import Image, { type ImageProps } from 'next/image'
import { isSrcOptimizableByNextImage } from '@/lib/is-src-optimizable-by-next-image'

function isNcloudHostUrl(src: string): boolean {
  const lower = src.toLowerCase()
  return lower.includes('ncloudstorage.com') || lower.includes('ncloud.com')
}

/** dev 콘솔 스팸 방지 — URL당 1회만 non-webp 경고 */
const warnedNonWebpNcloud = new Set<string>()

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
 * 경로가 `.webp`가 아니면 개발 모드에서만 `console.warn`으로 WebP 변환 후보를 표시합니다. 그 외 호스트만 `next/image` 사용.
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
  style,
  loading: loadingProp,
  onError: onErrorProp,
  ...rest
}: ImageProps) {
  const [error, setError] = useState(false)

  useEffect(() => {
    if (typeof src !== 'string' || error) return
    if (!isNcloudHostUrl(src)) return
    if (urlPathEndsWithWebp(src)) return
    if (process.env.NODE_ENV !== 'development') return
    if (warnedNonWebpNcloud.has(src)) return
    warnedNonWebpNcloud.add(src)
    if (process.env.NEXT_PUBLIC_SAFEIMAGE_LEGACY_LOG === '1') {
      console.debug(
        '[SafeImage] Ncloud JPG/PNG(레거시) — 표시는 정상. 마이그레이션 대상:',
        src,
      )
    }
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
          width: 48,
          height: 48,
          maxWidth: '100%',
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

  const useNativeImg =
    typeof src === 'string' &&
    (src.startsWith('/') || isNcloudHostUrl(src) || resolvedUnoptimized)

  if (useNativeImg) {
    const loading = priority ? 'eager' : (loadingProp ?? 'lazy')
    const imgClassName = [fill ? 'absolute inset-0 block h-full w-full' : '', className].filter(Boolean).join(' ') || undefined
    const sizesAttr = typeof rest.sizes === 'string' ? rest.sizes : undefined
    /** HTML width/height가 크면 `height:auto` 인라인이 Tailwind 높이를 깨뜨려 로고가 화면을 채움 */
    const layoutW =
      !fill && typeof width === 'number' && width > 0 && width <= 640 ? width : undefined
    const layoutH =
      !fill && typeof height === 'number' && height > 0 && height <= 640 ? height : undefined
    const mergedStyle = fill
      ? { width: '100%', height: '100%', objectFit: 'cover' as const, ...style }
      : { objectFit: 'contain' as const, maxWidth: '100%', ...style }
    return (
      // eslint-disable-next-line @next/next/no-img-element -- 로컬·Ncloud·unoptimized: SSR/CSR 동일 (next/image hydration 불일치 방지)
      <img
        src={src}
        alt={alt}
        width={layoutW}
        height={layoutH}
        loading={loading}
        {...(priority ? { fetchPriority: 'high' as const } : {})}
        decoding="async"
        {...(sizesAttr ? { sizes: sizesAttr } : {})}
        className={imgClassName}
        style={mergedStyle}
        onError={(e) => {
          handleError()
          onErrorProp?.(e)
        }}
        draggable={false}
        onDragStart={(e) => e.preventDefault()}
        suppressHydrationWarning
      />
    )
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      className={className}
      fill={fill}
      priority={priority}
      style={style}
      loading={loadingProp}
      onError={(e) => {
        handleError()
        onErrorProp?.(e)
      }}
      draggable={false}
      onDragStart={(e) => e.preventDefault()}
      {...rest}
      unoptimized={resolvedUnoptimized}
    />
  )
}
