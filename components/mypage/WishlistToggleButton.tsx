'use client'

import { Heart } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import {
  isInMypageWishlist,
  toggleMypageWishlist,
  type MypageWishlistKind,
} from '@/lib/mypage-wishlist-storage'

type Props = {
  kind: MypageWishlistKind
  id: string
  title: string
  slug?: string | null
  destination?: string | null
  className?: string
  /** 카드 링크 클릭과 분리 */
  stopPropagation?: boolean
}

export default function WishlistToggleButton({
  kind,
  id,
  title,
  slug = null,
  destination = null,
  className = '',
  stopPropagation = true,
}: Props) {
  const [active, setActive] = useState(false)

  useEffect(() => {
    setActive(isInMypageWishlist(kind, id))
  }, [kind, id])

  const onToggle = useCallback(
    (e: React.MouseEvent) => {
      if (stopPropagation) {
        e.preventDefault()
        e.stopPropagation()
      }
      const next = toggleMypageWishlist({
        kind,
        productId: id,
        title,
        slug,
        destination,
      })
      setActive(next)
      window.dispatchEvent(new CustomEvent('bongtour:wishlist-changed'))
    },
    [kind, id, title, slug, destination, stopPropagation]
  )

  return (
    <button
      type="button"
      onClick={onToggle}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/80 bg-white/90 shadow-md transition hover:scale-105 ${className}`}
      aria-label={active ? '찜 해제' : '찜하기'}
      aria-pressed={active}
    >
      <Heart
        className={`h-5 w-5 ${active ? 'fill-[#B42318] text-[#B42318]' : 'text-[#534AB7]'}`}
        aria-hidden
      />
    </button>
  )
}
