'use client'

/** 관리자 미리보기용: `source`가 있을 때만 우측 하단 캡션 표시 */
type Props = {
  imageUrl?: string | null
  /** 비우면 출처 캡션 미표시(잘못된 Pexels 기본값 방지) */
  source?: string | null
  alt?: string
  className?: string
  children?: React.ReactNode
}

export default function AdminImageAttribution({
  imageUrl,
  source,
  alt = '',
  className = '',
  children,
}: Props) {
  return (
    <div className={`relative overflow-hidden rounded-lg border border-gray-200 bg-gray-50 ${className}`}>
      {children ?? (imageUrl ? (
        <img
          src={imageUrl}
          alt={alt}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-1 text-center text-gray-400 text-xs">
          <span>이미지 준비 중</span>
          <span className="text-[10px] text-gray-300">새로고침하면 반영됩니다</span>
        </div>
      ))}
      {source?.trim() ? (
        <span
          className="absolute bottom-1 right-2 text-[10px] font-light text-gray-400 select-none"
          aria-hidden
        >
          Source: {source.trim()}
        </span>
      ) : null}
    </div>
  )
}
