import Image from 'next/image'

type Props = {
  className?: string
  /** 푸터 등 압축 레이아웃용 */
  compact?: boolean
}

/**
 * 대표자 성명은 법적 표시를 위해 시각적으로만 노출 (자산: /images/footer/representative-name-mark.png).
 * alt/aria·메타에 성명 문자열을 넣지 않는다.
 */
export default function RepresentativeNameImage({ className = '', compact = false }: Props) {
  const imgClass = compact
    ? 'h-3.5 w-auto max-w-[5.25rem] object-contain object-left opacity-90 sm:h-4 sm:max-w-[6rem] [filter:brightness(0)_invert(1)]'
    : 'h-5 w-auto max-w-[7rem] object-contain object-left opacity-90 sm:h-6 sm:max-w-[7.5rem] [filter:brightness(0)_invert(1)]'

  return (
    <span className={`inline-flex items-center align-middle ${className}`} aria-hidden="true">
      <Image
        src="/images/footer/representative-name-mark.webp"
        alt=""
        width={220}
        height={36}
        sizes={compact ? '96px' : '140px'}
        className={imgClass}
      />
    </span>
  )
}
