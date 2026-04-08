'use client'

/**
 * Pexels·별도 출처가 없을 때 게시 이미지가 AI 변형임을 고지.
 * 고정 우측 하단·회색 작은 글씨 (상품 상세 전용).
 */
export default function AiImageDisclaimerNotice({ variant = 'desktop' }: { variant?: 'desktop' | 'mobile' }) {
  const position =
    variant === 'mobile'
      ? 'bottom-[13rem] right-2 max-w-[11rem] sm:bottom-[12rem]'
      : 'bottom-6 right-4 max-w-[min(22rem,calc(100vw-1.5rem))]'

  return (
    <p
      className={`pointer-events-none fixed z-[38] text-right text-[10px] leading-relaxed text-gray-500 ${position}`}
      role="note"
    >
      Pexels 등에서 가져온 사진이 아니며, 별도 출처가 표시되지 않은 경우, 게시 이미지는 실제 사진을 AI로 변형·생성한
      이미지입니다.
    </p>
  )
}
