import { MAIN_REGISTRATION_NOTICE } from '@/lib/main-hub-copy'

/** 헤더 직하단 — 사업자·통신판매 등 한 줄 표지 (전 구간 동일 노출) */
export default function RegistrationNoticeStrip() {
  return (
    <div className="border-b border-amber-900/10 bg-bt-trust-beige px-4 py-1.5 text-center text-xs font-medium leading-snug text-amber-900">
      {MAIN_REGISTRATION_NOTICE}
    </div>
  )
}
