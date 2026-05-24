'use client'

type Props = {
  className?: string
  compact?: boolean
  tone?: 'on-dark' | 'on-light'
}

const IMG_CLASS = {
  'compact:on-dark':
    'h-3.5 w-auto max-w-[5.25rem] object-contain object-left sm:h-4 sm:max-w-[6rem] [filter:brightness(0)_invert(1)]',
  'compact:on-light':
    'h-3.5 w-auto max-w-[5.25rem] object-contain object-left opacity-95 sm:h-4 sm:max-w-[6rem] [filter:none]',
  'default:on-dark':
    'h-5 w-auto max-w-[7rem] object-contain object-left sm:h-6 sm:max-w-[7.5rem] [filter:brightness(0)_invert(1)]',
  'default:on-light':
    'h-5 w-auto max-w-[7rem] object-contain object-left opacity-95 sm:h-6 sm:max-w-[7.5rem] [filter:none]',
} as const

/** 푸터 대표자명 — `SafeImage`/`next/image` 없이 고정 `<img>` (hydration 일치) */
export default function RepresentativeNameImage({
  className = '',
  compact = false,
  tone = 'on-dark',
}: Props) {
  const key = `${compact ? 'compact' : 'default'}:${tone}` as keyof typeof IMG_CLASS

  return (
    <span className={`inline-flex items-center align-middle ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/images/footer/representative-name-mark.webp"
        alt="황일연"
        width={220}
        height={36}
        loading="lazy"
        decoding="async"
        className={IMG_CLASS[key]}
        suppressHydrationWarning
      />
    </span>
  )
}
