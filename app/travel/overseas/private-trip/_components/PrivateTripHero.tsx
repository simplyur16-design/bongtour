'use client'

import OverseasHero from '@/app/components/travel/overseas/OverseasHero'

/** 단독 허브 전용 — 공용 `OverseasHero`에 단독 browse 분기만 전달 */
export default function PrivateTripHero() {
  return <OverseasHero browseListingKind="private_trip" />
}
