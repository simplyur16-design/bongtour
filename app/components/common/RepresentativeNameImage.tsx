import SafeImage from '@/app/components/SafeImage'

type Props = {
  className?: string
  /** 푸터 등 압축 레이아웃용 */
  compact?: boolean
}

// 푸터 대표자명: 시각적으로는 이미지 처리(개인정보 노출 방지),
// 접근성과 SEO를 위해 alt 속성에만 한글 실명 부여.
// 절대 이미지를 텍스트로 대체하지 말 것.

export default function RepresentativeNameImage({ className = '', compact = false }: Props) {
  const imgClass = compact
    ? 'h-3.5 w-auto max-w-[5.25rem] object-contain object-left opacity-90 sm:h-4 sm:max-w-[6rem] [filter:brightness(0)_invert(1)]'
    : 'h-5 w-auto max-w-[7rem] object-contain object-left opacity-90 sm:h-6 sm:max-w-[7.5rem] [filter:brightness(0)_invert(1)]'

  return (
    <span className={`inline-flex items-center align-middle ${className}`}>
      <SafeImage
        src="/images/footer/representative-name-mark.webp"
        alt="황일연"
        width={220}
        height={36}
        sizes={compact ? '96px' : '140px'}
        className={imgClass}
      />
    </span>
  )
}
