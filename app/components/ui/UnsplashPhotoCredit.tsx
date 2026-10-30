'use client'

import type { MouseEvent, KeyboardEvent } from 'react'
import type { UnsplashCredit } from '@/lib/unsplash-credit'

type Props = {
  credit: UnsplashCredit | null | undefined
  /** 카드처럼 이미 링크(<a>) 안에 있으면 true — 중첩 <a> 대신 role=link 로 새 창 열기 */
  insideLink?: boolean
  className?: string
}

/**
 * Unsplash 사진 아주 작은 크레딧 'Photo: [작가] / Unsplash' (사진 모서리, 눈에 띄지 않게).
 * REGRESSION-FREEZE[unsplash-credit-1030]: Unsplash에만, 작가 프로필+Unsplash 링크 — manifest
 */
export default function UnsplashPhotoCredit({ credit, insideLink = false, className = '' }: Props) {
  if (!credit) return null
  const linkCls = 'underline-offset-2 hover:underline'
  const open = (href: string) => (e: MouseEvent | KeyboardEvent) => {
    if ('key' in e && e.key !== 'Enter' && e.key !== ' ') return
    e.preventDefault()
    e.stopPropagation()
    window.open(href, '_blank', 'noopener,noreferrer')
  }
  const link = (href: string, label: string) =>
    insideLink ? (
      <span role="link" tabIndex={0} className={`cursor-pointer ${linkCls}`} onClick={open(href)} onKeyDown={open(href)}>
        {label}
      </span>
    ) : (
      <a href={href} target="_blank" rel="noopener noreferrer" className={linkCls}>
        {label}
      </a>
    )
  return (
    <span
      data-testid="unsplash-photo-credit"
      className={`pointer-events-auto absolute bottom-1 right-1.5 z-[45] max-w-[70%] truncate rounded-sm bg-black/25 px-1 py-px text-[9px] leading-tight text-white/75 ${className}`.trim()}
    >
      Photo: {link(credit.authorHref, credit.authorName)} / {link(credit.unsplashHref, 'Unsplash')}
    </span>
  )
}
