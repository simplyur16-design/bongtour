import Link from 'next/link'
import { MessageCircle, Phone, Wifi } from 'lucide-react'
import {
  MOBILE_STICKY_ESIM_HREF,
  MOBILE_STICKY_ESIM_LABEL,
  MOBILE_STICKY_KAKAO_HREF,
  MOBILE_STICKY_KAKAO_LABEL,
  MOBILE_STICKY_PHONE_HREF,
  MOBILE_STICKY_PHONE_LABEL,
} from '@/lib/main-hub-copy'

const SLOT_BASE =
  'flex flex-1 flex-col items-center justify-center gap-1.5 rounded-lg px-1 py-2.5 text-center text-xs font-semibold leading-tight transition active:scale-[0.98] mx-1 my-1.5 min-h-[3rem]'

/** 메인 전용 모바일 하단 sticky — 전화 / 카톡 / eSIM 3등분 (lg 이상 숨김) */
export default function MobileStickyBar() {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 border-t-[0.5px] border-bt-bg-lavender bg-white pt-1.5 lg:hidden"
      style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
      aria-label="빠른 상담 및 eSIM"
    >
      <div className="flex items-stretch justify-between px-0.5">
        <a href={MOBILE_STICKY_PHONE_HREF} className={`${SLOT_BASE} bg-bt-trust-beige text-bt-brand-gold-strong`}>
          <Phone className="h-4 w-4 shrink-0" strokeWidth={2.25} aria-hidden />
          <span>{MOBILE_STICKY_PHONE_LABEL}</span>
        </a>
        <a
          href={MOBILE_STICKY_KAKAO_HREF}
          target="_blank"
          rel="noopener noreferrer"
          className={`${SLOT_BASE} bg-[#FAE100] text-[#3C1E1E]`}
        >
          <MessageCircle className="h-4 w-4 shrink-0" strokeWidth={2.25} aria-hidden />
          <span>{MOBILE_STICKY_KAKAO_LABEL}</span>
        </a>
        <Link
          href={MOBILE_STICKY_ESIM_HREF}
          className={`${SLOT_BASE} bg-gradient-to-r from-bt-coral to-bt-coral-soft text-white shadow-sm`}
        >
          <Wifi className="h-4 w-4 shrink-0" strokeWidth={2.25} aria-hidden />
          <span>{MOBILE_STICKY_ESIM_LABEL}</span>
        </Link>
      </div>
    </nav>
  )
}
