import { permanentRedirect } from 'next/navigation'

/** 예전 소메뉴 URL — 하위메뉴 제거 후 해외 허브로 이동 */
export default function ToursActivitiesLegacyRedirect() {
  permanentRedirect('/travel/overseas')
}
