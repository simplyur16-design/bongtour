import SafeImage from '@/app/components/SafeImage'

type Props = {
  className?: string
  /** 푸터 등 압축 레이아웃용 */
  compact?: boolean
}

/**
 * 대표자 성명은 법적 표시를 위해 시각적으로만 노출 (자산: /images/footer/representative-name-mark.webp).
 * 실명 문자열은 alt·aria·메타 어디에도 넣지 않는다.
 * SEO·도구 점검을 위해 역할만 밝힌 alt(예: 주식회사 봉투어 대표)는 허용한다. 부모 span의 aria-hidden으로 스크린리더는 이 블록을 건너뛴다.
 */
export default function RepresentativeNameImage({ className = '', compact = false }: Props) {
  const imgClass = compact
    ? 'h-3.5 w-auto max-w-[5.25rem] object-contain object-left opacity-90 sm:h-4 sm:max-w-[6rem] [filter:brightness(0)_invert(1)]'
    : 'h-5 w-auto max-w-[7rem] object-contain object-left opacity-90 sm:h-6 sm:max-w-[7.5rem] [filter:brightness(0)_invert(1)]'

  return (
    <span className={`inline-flex items-center align-middle ${className}`} aria-hidden="true">
      <SafeImage
        src="/images/footer/representative-name-mark.webp"
        alt="주식회사 봉투어 대표"
        width={220}
        height={36}
        sizes={compact ? '96px' : '140px'}
        className={imgClass}
      />
    </span>
  )
}
