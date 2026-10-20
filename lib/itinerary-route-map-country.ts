/**
 * 상품 country/destination → 영문 국명(지도 워터마크용 UPPERCASE).
 */

const COUNTRY_KO_TO_EN: Record<string, string> = {
  일본: 'JAPAN',
  한국: 'KOREA',
  대한민국: 'KOREA',
  중국: 'CHINA',
  대만: 'TAIWAN',
  홍콩: 'HONG KONG',
  마카오: 'MACAU',
  베트남: 'VIETNAM',
  태국: 'THAILAND',
  싱가포르: 'SINGAPORE',
  말레이시아: 'MALAYSIA',
  인도네시아: 'INDONESIA',
  필리핀: 'PHILIPPINES',
  캄보디아: 'CAMBODIA',
  라오스: 'LAOS',
  미얀마: 'MYANMAR',
  인도: 'INDIA',
  네팔: 'NEPAL',
  스리랑카: 'SRI LANKA',
  몰디브: 'MALDIVES',
  괌: 'GUAM',
  사이판: 'SAIPAN',
  미국: 'UNITED STATES',
  캐나다: 'CANADA',
  호주: 'AUSTRALIA',
  뉴질랜드: 'NEW ZEALAND',
  프랑스: 'FRANCE',
  이탈리아: 'ITALY',
  스페인: 'SPAIN',
  영국: 'UNITED KINGDOM',
  독일: 'GERMANY',
  스위스: 'SWITZERLAND',
  오스트리아: 'AUSTRIA',
  네덜란드: 'NETHERLANDS',
  벨기에: 'BELGIUM',
  체코: 'CZECHIA',
  헝가리: 'HUNGARY',
  그리스: 'GREECE',
  터키: 'TURKEY',
  튀르키예: 'TURKEY',
  이집트: 'EGYPT',
  모로코: 'MOROCCO',
  두바이: 'UAE',
  아랍에미리트: 'UAE',
  UAE: 'UAE',
  포르투갈: 'PORTUGAL',
  크로아티아: 'CROATIA',
  폴란드: 'POLAND',
  러시아: 'RUSSIA',
  몽골: 'MONGOLIA',
  조지아: 'GEORGIA',
  아르메니아: 'ARMENIA',
  아제르바이잔: 'AZERBAIJAN',
  페루: 'PERU',
  브라질: 'BRAZIL',
  아르헨티나: 'ARGENTINA',
  칠레: 'CHILE',
  멕시코: 'MEXICO',
  남아프리카: 'SOUTH AFRICA',
  케냐: 'KENYA',
  탄자니아: 'TANZANIA',
}

const COUNTRY_EN_ALIASES: Record<string, string> = {
  japan: 'JAPAN',
  korea: 'KOREA',
  'south korea': 'KOREA',
  china: 'CHINA',
  taiwan: 'TAIWAN',
  'hong kong': 'HONG KONG',
  vietnam: 'VIETNAM',
  thailand: 'THAILAND',
  singapore: 'SINGAPORE',
  malaysia: 'MALAYSIA',
  indonesia: 'INDONESIA',
  philippines: 'PHILIPPINES',
  guam: 'GUAM',
  saipan: 'SAIPAN',
  usa: 'UNITED STATES',
  'united states': 'UNITED STATES',
  australia: 'AUSTRALIA',
  'new zealand': 'NEW ZEALAND',
  france: 'FRANCE',
  italy: 'ITALY',
  spain: 'SPAIN',
  germany: 'GERMANY',
  greece: 'GREECE',
  egypt: 'EGYPT',
  uae: 'UAE',
  maldives: 'MALDIVES',
}

export function resolveItineraryRouteMapCountry(input: {
  country?: string | null
  destination?: string | null
  primaryDestination?: string | null
  title?: string | null
}): { countryKo: string; countryEn: string } {
  const candidates = [input.country, input.destination, input.primaryDestination, input.title]
    .map((x) => String(x ?? '').trim())
    .filter(Boolean)

  for (const raw of candidates) {
    const first = raw.split(/[/／,，、·|]/)[0]?.trim() ?? raw
    if (COUNTRY_KO_TO_EN[first]) {
      return { countryKo: first, countryEn: COUNTRY_KO_TO_EN[first]! }
    }
    for (const [ko, en] of Object.entries(COUNTRY_KO_TO_EN)) {
      if (raw.includes(ko)) return { countryKo: ko, countryEn: en }
    }
    const lower = first.toLowerCase()
    if (COUNTRY_EN_ALIASES[lower]) {
      return { countryKo: first, countryEn: COUNTRY_EN_ALIASES[lower]! }
    }
  }

  const fallbackKo = candidates[0]?.split(/[/／,，、·|]/)[0]?.trim() || '여행지'
  return { countryKo: fallbackKo, countryEn: fallbackKo.toUpperCase() }
}
