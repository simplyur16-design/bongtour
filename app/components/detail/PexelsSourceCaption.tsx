'use client'

type Props = {
  className?: string
  children: React.ReactNode
  showCaption?: boolean
}

/**
 * 이미지 우측 하단에 아주 작고 투명한 "Source: Pexels" 표기.
 * 사용자 시선을 방해하지 않는 수준으로 저작권 출처 표기.
 */
export default function PexelsSourceCaption({ className = '', children, showCaption = false }: Props) {
  return (
    <div className={`relative ${className}`}>
      {children}
      {showCaption ? (
        <span
          className="absolute bottom-1 right-2 text-[10px] text-white/60 select-none pointer-events-none"
          aria-hidden
        >
          Source: Pexels
        </span>
      ) : null}
    </div>
  )
}
