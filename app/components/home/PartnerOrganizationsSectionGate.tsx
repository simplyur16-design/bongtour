'use client'

import dynamic from 'next/dynamic'
import { useEffect, useRef, useState } from 'react'

const PartnerOrganizationsSection = dynamic(() => import('./PartnerOrganizationsSection'), {
  ssr: false,
  loading: () => (
    <div className="min-h-[12rem] w-full rounded-lg bg-slate-100/70" aria-busy="true" aria-label="로딩 중" />
  ),
})

/**
 * 뷰포트 근처에 올 때만 파트너 마퀴(대량 이미지)를 마운트해 초기 네트워크·메인 스레드 부담을 줄입니다.
 */
export default function PartnerOrganizationsSectionGate() {
  const rootRef = useRef<HTMLDivElement>(null)
  const [show, setShow] = useState(false)

  useEffect(() => {
    const el = rootRef.current
    if (!el || show) return
    const io = new IntersectionObserver(
      ([e]) => {
        if (e?.isIntersecting) {
          setShow(true)
          io.disconnect()
        }
      },
      { rootMargin: '320px 0px', threshold: 0.01 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [show])

  return (
    <div ref={rootRef} className="min-h-[10rem] scroll-mt-8">
      {show ? <PartnerOrganizationsSection /> : null}
    </div>
  )
}
