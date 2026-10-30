/**
 * 사장님 10/30 (문과장 review-01 반려 35건 후속): 대표사진 자동 후보는 「상품의 실제 도시」 사진만.
 * REGRESSION-FREEZE[pexels-city-location-filter-1030]
 *
 * Pexels API 응답에는 별도 location 필드가 없다 → 위치 메타 = `alt` + 사진 페이지 URL slug(`url`).
 * 규칙 (순서대로):
 *  1) 위치 메타(alt·slug)가 비어 있으면 제외 → 'NO_LOCATION'
 *  2) 특정 호텔·간판/로고·사람 중심 사진 제외 → 'EXCLUDED_SUBJECT'
 *  3) 위치 메타에 상품 도시명(영문·별칭) 또는 지정 랜드마크명이 없으면 제외 → 'CITY_MISMATCH'
 *  통과 후보가 0이면 호출부가 Unsplash(작은 크레딧 필수)로 폴백, 그래도 없으면 현재 사진 유지.
 */
import { OVERSEAS_LOCATION_TREE } from '@/lib/overseas-location-tree'

export type CityLocationVerdict = 'OK' | 'NO_LOCATION' | 'EXCLUDED_SUBJECT' | 'CITY_MISMATCH'

export type LocationPhotoLike = {
  /** Pexels `alt` / Unsplash `alt_description`·`description` */
  alt?: string | null
  /** Pexels 사진 페이지 URL (slug에 장소명이 들어감) / Unsplash `links.html` */
  pageUrl?: string | null
  /** Unsplash `location.name`·`location.city` 등 명시 위치(있으면 같이 본다) */
  locationText?: string | null
}

/** 트리에 도시 노드가 없는 도시(유럽 등)·로마자 변형 보충 — 한글 → 영문 */
const SUPPLEMENTARY_CITY_EN: Record<string, string[]> = {
  프라하: ['prague', 'praha'],
  체스키크룸로프: ['cesky krumlov', 'český krumlov'],
  비엔나: ['vienna', 'wien'],
  빈: ['vienna', 'wien'],
  잘츠부르크: ['salzburg'],
  할슈타트: ['hallstatt'],
  부다페스트: ['budapest'],
  크라쿠프: ['krakow', 'kraków', 'cracow'],
  바르샤바: ['warsaw', 'warszawa'],
  브라티슬라바: ['bratislava'],
  류블랴나: ['ljubljana'],
  블레드: ['bled'],
  자그레브: ['zagreb'],
  두브로브니크: ['dubrovnik'],
  스플리트: ['split croatia'],
  로마: ['rome', 'roma', 'vatican'],
  피렌체: ['florence', 'firenze'],
  베네치아: ['venice', 'venezia'],
  베니스: ['venice', 'venezia'],
  밀라노: ['milan', 'milano'],
  나폴리: ['naples', 'napoli'],
  파리: ['paris'],
  런던: ['london'],
  바르셀로나: ['barcelona'],
  마드리드: ['madrid'],
  세비야: ['seville', 'sevilla'],
  그라나다: ['granada'],
  리스본: ['lisbon', 'lisboa'],
  포르투: ['porto', 'oporto'],
  취리히: ['zurich', 'zürich'],
  인터라켄: ['interlaken'],
  뮌헨: ['munich', 'münchen'],
  프랑크푸르트: ['frankfurt'],
  베를린: ['berlin'],
  암스테르담: ['amsterdam'],
  이스탄불: ['istanbul'],
  카파도키아: ['cappadocia'],
  호치민: ['ho chi minh', 'saigon'],
  다낭: ['da nang', 'danang'],
  하노이: ['hanoi', 'ha noi'],
  하롱베이: ['ha long', 'halong'],
  나트랑: ['nha trang'],
  푸꾸옥: ['phu quoc'],
  달랏: ['dalat', 'da lat'],
  호이안: ['hoi an'],
  방콕: ['bangkok'],
  파타야: ['pattaya'],
  치앙마이: ['chiang mai'],
  싱가포르: ['singapore'],
  시드니: ['sydney'],
  멜버른: ['melbourne'],
  도쿄: ['tokyo'],
  오사카: ['osaka'],
  교토: ['kyoto'],
  후쿠오카: ['fukuoka'],
  유후인: ['yufuin', 'yufu'],
  벳부: ['beppu'],
  다카마쓰: ['takamatsu'],
  요코하마: ['yokohama'],
  타이베이: ['taipei'],
  타이페이: ['taipei'],
  가오슝: ['kaohsiung'],
  타이중: ['taichung'],
  마카오: ['macau', 'macao'],
  홍콩: ['hong kong'],
  세부: ['cebu'],
  마닐라: ['manila'],
  보라카이: ['boracay'],
  발리: ['bali'],
  광저우: ['guangzhou'],
  구마모토: ['kumamoto'],
  쿠로카와: ['kurokawa'],
  나가사키: ['nagasaki'],
  사가: ['saga'],
  우레시노: ['ureshino'],
  마츠야마: ['matsuyama'],
  마쓰야마: ['matsuyama'],
  보홀: ['bohol'],
  오키나와: ['okinawa'],
  시즈오카: ['shizuoka'],
  호놀룰루: ['honolulu'],
  사이판: ['saipan'],
  카오락: ['khao lak'],
  푸켓: ['phuket'],
}

/** 호텔·간판/로고·사람 중심 — 단어 경계 기준(영문 alt/slug) */
const EXCLUDED_SUBJECT_RE =
  /\b(hotels?|resorts?|hostels?|motels?|lobby|suites?|casino|signs?|signage|signboards?|billboards?|logos?|neon|storefront|shopfront|brand|person|people|man|men|woman|women|girls?|boys?|guy|lady|couple|tourists?|travell?ers?|portrait|selfie|crowd|family|child|children|kids?|bride|groom|wedding|model|posing|rider|riders|cyclists?|divers?|swimmers?|surfers?|smiling|faces?|infinity pool|rooftop pool|pool villa)\b/i

function norm(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, ' ')
    .trim()
}

/** Pexels `/photo/<slug>-<id>/` → 'slug words' */
export function pageUrlSlugWords(pageUrl: string | null | undefined): string {
  const u = (pageUrl ?? '').trim()
  if (!u) return ''
  try {
    const parts = new URL(u).pathname.split('/').filter(Boolean)
    const last = parts[parts.length - 1] ?? ''
    if (parts.length < 2) return ''
    return norm(last.replace(/-?\d{3,}$/, '').replace(/-/g, ' '))
  } catch {
    return ''
  }
}

export function locationMetaText(p: LocationPhotoLike): string {
  return [norm(p.alt ?? ''), pageUrlSlugWords(p.pageUrl), norm(p.locationText ?? '')].filter(Boolean).join(' | ')
}

function isAscii(s: string): boolean {
  return /^[\x20-\x7e]+$/.test(s)
}

/**
 * 상품 도시 값(한글·키, 쉼표/슬래시 다중 허용) → 영문 매칭어 목록.
 * 트리 leaf(nodeLabel·aliases·nodeKey) + 보충 사전.
 */
export function englishCityTerms(cityValues: Array<string | null | undefined>): string[] {
  const out = new Set<string>()
  const tokens = cityValues
    .flatMap((v) => (v ?? '').split(/[,/·&+|]|\s{2,}/))
    .map((t) => t.trim())
    .filter(Boolean)
  for (const tok of tokens) {
    const key = tok.replace(/\s+/g, '')
    for (const en of SUPPLEMENTARY_CITY_EN[key] ?? []) out.add(norm(en))
    if (isAscii(tok) && tok.length >= 3) out.add(norm(tok.replace(/-/g, ' ')))
    for (const g of OVERSEAS_LOCATION_TREE) {
      for (const c of g.countries) {
        for (const leaf of c.children) {
          if (leaf.nodeType && leaf.nodeType !== 'city') continue
          const names = [leaf.nodeLabel, leaf.nodeKey, ...(leaf.aliases ?? [])]
          if (!names.some((n) => n.replace(/\s+/g, '') === key || n.toLowerCase() === tok.toLowerCase())) continue
          // 다도시 leaf(예: '구마모토 · 나가사키')는 별칭에 다른 도시가 섞여 있어 별칭 확장 금지 — 보충 사전·영문 토큰만
          if (leaf.nodeLabel.includes('·')) continue
          for (const n of names) if (isAscii(n) && n.length >= 3 && !/^[A-Z]{3}$/.test(n)) out.add(norm(n.replace(/-/g, ' ')))
        }
      }
    }
  }
  return [...out].filter((t) => t.length >= 3)
}

function containsTerm(hay: string, term: string): boolean {
  const t = norm(term)
  if (!t) return false
  const re = new RegExp(`(^|[^a-z0-9])${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s*')}($|[^a-z0-9])`)
  return re.test(hay)
}

export function cityLocationVerdict(
  p: LocationPhotoLike,
  cityTerms: string[],
  landmarkTerms: string[] = []
): { verdict: CityLocationVerdict; matched: string | null; meta: string } {
  const meta = locationMetaText(p)
  if (!meta.replace(/\|/g, '').trim()) return { verdict: 'NO_LOCATION', matched: null, meta }
  if (EXCLUDED_SUBJECT_RE.test(meta)) return { verdict: 'EXCLUDED_SUBJECT', matched: null, meta }
  const hit = [...landmarkTerms, ...cityTerms].find((t) => containsTerm(meta, t)) ?? null
  if (!hit) return { verdict: 'CITY_MISMATCH', matched: null, meta }
  return { verdict: 'OK', matched: hit, meta }
}

/** 후보 목록에서 도시 일치 통과분만 (순서 유지) */
export function filterCandidatesByCity<T extends LocationPhotoLike>(
  list: T[],
  cityTerms: string[],
  landmarkTerms: string[] = []
): Array<T & { cityMatched: string }> {
  const out: Array<T & { cityMatched: string }> = []
  for (const p of list) {
    const v = cityLocationVerdict(p, cityTerms, landmarkTerms)
    if (v.verdict === 'OK' && v.matched) out.push({ ...p, cityMatched: v.matched })
  }
  return out
}
