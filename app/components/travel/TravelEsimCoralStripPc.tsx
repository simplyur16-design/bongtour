'use client'

import { usePathname } from 'next/navigation'
import EsimCoralStrip from '@/app/components/EsimCoralStrip'

/** `/travel/*` PC 전용 eSIM 코랄 띠 — eSIM 전용 경로·메인(자체 띠)에서는 숨김. */
export default function TravelEsimCoralStripPc() {
  const pathname = usePathname() ?? ''
  if (pathname.startsWith('/travel/esim')) return null

  return (
    <div className="hidden lg:block">
      <EsimCoralStrip showMobile={false} />
    </div>
  )
}
