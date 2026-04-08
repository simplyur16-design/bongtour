'use client'

import Link from 'next/link'
import { CTA_LABELS, type BongtourCtaVariant } from '@/lib/bongtour-copy'

export type BongtourCtaButtonVariant = BongtourCtaVariant

type Size = 'sm' | 'md' | 'lg'

const sizeClasses: Record<Size, string> = {
  sm: 'px-3.5 py-2 text-sm',
  md: 'px-5 py-2.5 text-sm',
  lg: 'px-6 py-3 text-base',
}

const baseVisual =
  'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bt-ui-accent/50 disabled:pointer-events-none disabled:opacity-50'

/** 상담·접수 톤: 단정한 테두리·은은한 배경 (특가몰형 강조색 사용 안 함) */
const variantVisual: Record<BongtourCtaButtonVariant, string> = {
  bookRequest:
    'border border-slate-700/90 bg-slate-900 text-white hover:bg-slate-800 active:bg-slate-950',
  consult:
    'border border-bt-ui-accent/30 bg-bt-ui-accent-soft text-bt-ink hover:bg-bt-brand-blue-soft active:bg-bt-brand-blue-soft',
  customItinerary:
    'border border-slate-300 bg-white text-slate-800 hover:border-slate-400 hover:bg-slate-50 active:bg-slate-100',
  kakao:
    'border border-[#c5b358]/60 bg-[#FFFBF0] text-[#191919] hover:bg-[#FFF8DC] active:bg-[#FFF5D6]',
  phone:
    'border border-slate-300 bg-white text-slate-800 hover:border-slate-400 hover:bg-slate-50 active:bg-slate-100',
}

export type BongtourCtaButtonProps = {
  variant: BongtourCtaButtonVariant
  href?: string
  onClick?: () => void
  size?: Size
  className?: string
  children?: React.ReactNode
  /** 링크일 때 새 탭 (카카오 오픈채팅 등) */
  openInNewTab?: boolean
  type?: 'button' | 'submit'
  disabled?: boolean
  'aria-label'?: string
}

function defaultHrefForVariant(variant: BongtourCtaButtonVariant): string | undefined {
  if (variant === 'kakao') {
    const url = process.env.NEXT_PUBLIC_KAKAO_OPEN_CHAT_URL
    return url && url.length > 0 ? url : undefined
  }
  return undefined
}

export default function BongtourCtaButton({
  variant,
  href: hrefProp,
  onClick,
  size = 'md',
  className = '',
  children,
  openInNewTab = false,
  type = 'button',
  disabled = false,
  'aria-label': ariaLabel,
}: BongtourCtaButtonProps) {
  const label = children ?? CTA_LABELS[variant]
  const href = hrefProp ?? defaultHrefForVariant(variant)
  const combined = `${baseVisual} ${variantVisual[variant]} ${sizeClasses[size]} ${className}`.trim()

  /* submit은 폼 onSubmit과 함께 쓰일 수 있어 href/onClick 없이 허용 */
  if (!href && !onClick && type !== 'submit') {
    return (
      <button
        type="button"
        disabled
        className={combined}
        title="연결 주소(href) 또는 동작(onClick)이 필요합니다"
        aria-label={ariaLabel ?? (typeof label === 'string' ? label : undefined)}
      >
        {label}
      </button>
    )
  }

  if (href) {
    const isExternal = /^https?:\/\//i.test(href) || href.startsWith('//')
    if (isExternal) {
      return (
        <a
          href={href}
          className={combined}
          {...(openInNewTab ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
          aria-label={ariaLabel ?? (typeof label === 'string' ? label : undefined)}
        >
          {label}
        </a>
      )
    }
    return (
      <Link
        href={href}
        className={combined}
        {...(openInNewTab ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        aria-label={ariaLabel ?? (typeof label === 'string' ? label : undefined)}
      >
        {label}
      </Link>
    )
  }

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={combined}
      aria-label={ariaLabel ?? (typeof label === 'string' ? label : undefined)}
    >
      {label}
    </button>
  )
}
