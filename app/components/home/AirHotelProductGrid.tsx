import AirHotelProductGridClient from '@/app/components/home/AirHotelProductGridClient'

/** 메인 항공+호텔 — RSC browse 대기 금지(콜드 시 수 분·502). 클라이언트 API만. */
export default function AirHotelProductGrid({ oceanWarm = false }: { oceanWarm?: boolean }) {
  return <AirHotelProductGridClient oceanWarm={oceanWarm} />
}
