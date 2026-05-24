import { permanentRedirect } from 'next/navigation'

/** 국내여행 공개 허브 폐지 — 레거시 URL은 해외 허브로 통합 */
export default function DomesticTravelPage() {
  permanentRedirect('/travel/overseas')
}
