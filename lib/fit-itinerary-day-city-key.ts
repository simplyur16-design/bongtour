/**
 * 톤 1031: 예시 일정 일차 dayCityKey 는 모델 값이 아니라 코드가 그날 장소(권역 표)로 정한다.
 * (fit-hn-0061 D2 교토 하루가 dayCityKey=osaka 로 나온 문제 — 모델이 상품 cityKey 를 그대로 베낌)
 * 순서: 그날 attraction·shopping·meal location 이 권역 표에 맞는 도시(가장 많이 맞는 도시, 같으면 먼저 나온 장소) → 상품 cityKey → 모델 값.
 * 일차 요약·제목은 보지 않는다(‘기온’=날씨 같은 동음어 오탐 방지). transport·hotel 도 보지 않는다(공항·호텔명).
 */
export type FitDayCityKeyActivity = { category: string; location?: string | null; title?: string | null }

/** 간사이 권역 표 — 장소 한글·영문 토큰(location 기준). 오사카 상품에서 교토·나라·고베 하루를 가려내는 용도. */
export const FIT_DAY_CITY_ZONE_TOKENS: ReadonlyArray<{ cityKey: string; tokens: readonly string[] }> = [
  {
    cityKey: 'kyoto',
    tokens: [
      '교토', '청수사', '기요미즈', '산넨자카', '니넨자카', '기온', '하나미코지', '야사카', '고다이지', '난젠지',
      '철학의 길', '은각사', '긴카쿠지', '헤이안 신궁', '지온인', '아라시야마', '치쿠린', '대나무 숲', '도게츠교',
      '텐류지', '사가노', '노노미야', '금각사', '킨카쿠지', '료안지', '기타노 텐만구', '닌나지', '후시미', '이나리',
      '도후쿠지', '니시키', '니조성', '폰토초', '본토초',
      'Kyoto', 'Kiyomizu', 'Sannenzaka', 'Ninenzaka', 'Gion', 'Hanamikoji', 'Yasaka', 'Kodai-ji', 'Nanzen-ji',
      "Philosopher's Path", 'Ginkaku', 'Heian', 'Arashiyama', 'Togetsukyo', 'Tenryu-ji', 'Kinkaku', 'Ryoan-ji',
      'Fushimi', 'Inari', 'Tofuku-ji', 'Nishiki', 'Nijo', 'Pontocho',
    ],
  },
  {
    cityKey: 'nara',
    tokens: ['나라 공원', '나라공원', '도다이지', '동대사', '가스가 타이샤', '가스가타이샤', '고후쿠지', 'Nara Park', 'Todai-ji', 'Kasuga', 'Kofuku-ji'],
  },
  {
    cityKey: 'kobe',
    tokens: ['고베', '하버랜드', '메리켄', '기타노이진칸', '기타노 이진칸', '난킨마치', 'Kobe', 'Harborland', 'Meriken', 'Kitano Ijinkan', 'Nankinmachi'],
  },
  {
    cityKey: 'osaka',
    tokens: [
      '오사카', '도톤보리', '신세카이', '츠텐카쿠', '하루카스', '텐노지', '난바', '신사이바시', '아메리카무라', '호젠지',
      '구로몬', '덴덴', '우메다', '나카자키초', '텐진바시', '헵파이브', '유니버설 스튜디오 재팬', '가이유칸', '덴포잔',
      'Osaka', 'Dotonbori', 'Shinsekai', 'Tsutenkaku', 'Harukas', 'Tennoji', 'Namba', 'Shinsaibashi', 'Amerikamura',
      'Hozenji', 'Kuromon', 'Den Den', 'Denden', 'Umeda', 'Nakazakicho', 'Universal Studios Japan', 'Kaiyukan', 'Tempozan',
    ],
  },
]

const PLACE_CATEGORIES = new Set(['attraction', 'shopping', 'meal'])

const reCache = new Map<string, RegExp>()
/** 영문 토큰은 단어 경계로만(‘Gion’이 ‘region’에 걸리지 않게) */
function englishWordRe(w: string): RegExp {
  let re = reCache.get(w)
  if (!re) {
    re = new RegExp(`(?<![A-Za-z])${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![A-Za-z])`, 'i')
    reCache.set(w, re)
  }
  return re
}

function zoneCityOfText(text: string): string | null {
  const t = String(text ?? '')
  if (!t.trim()) return null
  for (const z of FIT_DAY_CITY_ZONE_TOKENS) {
    if (z.tokens.some((w) => (/[A-Za-z]/.test(w) ? englishWordRe(w).test(t) : t.includes(w)))) return z.cityKey
  }
  return null
}

export function resolveFitDayCityKey(args: {
  activities: ReadonlyArray<FitDayCityKeyActivity>
  productCityKey?: string | null
  modelDayCityKey?: string | null
}): string {
  const counts = new Map<string, number>()
  const firstSeen: string[] = []
  for (const a of args.activities ?? []) {
    if (!PLACE_CATEGORIES.has(String(a.category ?? ''))) continue
    const city = zoneCityOfText(String(a.location ?? '').trim() || String(a.title ?? ''))
    if (!city) continue
    if (!counts.has(city)) firstSeen.push(city)
    counts.set(city, (counts.get(city) ?? 0) + 1)
  }
  if (counts.size) {
    let best = firstSeen[0]!
    for (const c of firstSeen) if ((counts.get(c) ?? 0) > (counts.get(best) ?? 0)) best = c
    return best
  }
  const productKey = String(args.productCityKey ?? '').trim()
  if (productKey) return productKey
  return String(args.modelDayCityKey ?? '').trim()
}
