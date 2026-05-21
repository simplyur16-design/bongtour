'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import MypagePageHeading from '@/components/mypage/MypagePageHeading'
import {
  productHref,
  readMypageWishlist,
  wishlistItemKey,
  writeMypageWishlist,
  type MypageWishlistItem,
} from '@/lib/mypage-wishlist-storage'

export default function MyWishlistClient() {
  const [items, setItems] = useState<MypageWishlistItem[]>([])

  const reload = useCallback(() => {
    setItems(readMypageWishlist())
  }, [])

  useEffect(() => {
    reload()
    const onChange = () => reload()
    window.addEventListener('bongtour:wishlist-changed', onChange)
    return () => window.removeEventListener('bongtour:wishlist-changed', onChange)
  }, [reload])

  function removeOne(kind: MypageWishlistItem['kind'], productId: string) {
    const key = wishlistItemKey(kind, productId)
    const next = items.filter((x) => wishlistItemKey(x.kind, x.productId) !== key)
    writeMypageWishlist(next)
    setItems(next)
  }

  return (
    <main className="mx-auto max-w-2xl py-2">
      <MypagePageHeading
        title="찜한 상품"
        description="관심 상품을 모아 두었습니다. 상품 상세에서 찜을 추가할 수 있습니다."
      />

      {items.length === 0 ? (
        <div className="rounded-2xl border border-[#DAD4EE] bg-white px-5 py-10 text-center shadow-sm">
          <p className="text-[15px] text-[#534AB7]">찜한 상품이 없습니다.</p>
          <Link
            href="/travel/overseas"
            className="mt-4 inline-block rounded-full bg-[#534AB7] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#4339A0]"
          >
            해외여행 상품 보기
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li
              key={item.productId}
              className="flex flex-col gap-3 rounded-2xl border border-[#DAD4EE] bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="font-semibold text-[#1F1B2D]">{item.title}</p>
                {item.destination ? (
                  <p className="mt-1 text-sm text-[#534AB7]">{item.destination}</p>
                ) : null}
                <p className="mt-1 text-xs text-[#534AB7]/70">
                  저장 {new Date(item.savedAt).toLocaleDateString('ko-KR')}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Link
                  href={productHref(item)}
                  className="rounded-full border border-[#DAD4EE] bg-[#EFEDF8] px-4 py-2 text-sm font-semibold text-[#534AB7] hover:bg-[#E8E4F4]"
                >
                  상품 보기
                </Link>
                <button
                  type="button"
                  onClick={() => removeOne(item.kind, item.productId)}
                  className="rounded-full border border-[#DAD4EE] px-4 py-2 text-sm font-medium text-[#534AB7] hover:bg-[#F5F2EA]"
                >
                  삭제
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
