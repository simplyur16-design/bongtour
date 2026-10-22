/**
 * 공개 상품 상세 히어로 — IATA 항공사 코드 → 한글 표시명.
 * DB Product.title / airline 원문은 덮어쓰지 않고 표시 레이어만 변환.
 *
 * REGRESSION-FREEZE[public-hero-airline-iata-ko]: IATA→한글 항공사명 — manifest
 * REGRESSION-FREEZE[airline-tway-to-trinity]: TW·티웨이 → 트리니티항공 — manifest
 */

/** 상품 제목·히어로 항공 줄에 자주 나오는 IATA → 한글 */
export const AIRLINE_IATA_KO_PUBLIC: Readonly<Record<string, string>> = {
  KE: '대한항공',
  OZ: '아시아나항공',
  LJ: '진에어',
  // REGRESSION-FREEZE[airline-tway-to-trinity]: public TW label — manifest
  TW: '트리니티항공',
  '7C': '제주항공',
  ZE: '이스타항공',
  RS: '에어서울',
  BX: '에어부산',
  RF: '에어로케이',
  YP: '에어프레미아',
  SQ: '싱가포르항공',
  TG: '타이항공',
  VN: '베트남항공',
  VJ: '비엣젯항공',
  PR: '필리핀항공',
  CX: '캐세이퍼시픽',
  KA: '캐세이드래곤',
  CI: '중화항공',
  BR: '에바항공',
  NH: '전일본공수',
  JL: '일본항공',
  MM: '피치항공',
  GK: '젯스타재팬',
  MU: '중국동방항공',
  CA: '중국국제항공',
  CZ: '중국남방항공',
  EK: '에미레이트항공',
  QR: '카타르항공',
  EY: '에티하드항공',
  TK: '터키항공',
  LH: '루프트한자',
  AF: '에어프랑스',
  KL: 'KLM',
  BA: '영국항공',
  UA: '유나이티드항공',
  DL: '델타항공',
  AA: '아메리칸항공',
  AC: '에어캐나다',
  QF: '콴타스',
  NZ: '에어뉴질랜드',
  HA: '하와이안항공',
} as const

/** 공급사 원문·구 브랜드 → 공개 표시명 (티웨이 리브랜딩) */
export const AIRLINE_LEGACY_KO_TO_PUBLIC: Readonly<Record<string, string>> = {
  티웨이항공: '트리니티항공',
  티웨이: '트리니티항공',
  "T'way Air": '트리니티항공',
  'Tway Air': '트리니티항공',
  'T WAY AIR': '트리니티항공',
}

const IATA_ALT = Object.keys(AIRLINE_IATA_KO_PUBLIC)
  .sort((a, b) => b.length - a.length)
  .map((c) => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  .join('|')

/** 편명(TW245)은 건드리지 않고, 단독 코드·브래킷만 치환 */
const BARE_IATA_RE = new RegExp(`(?<![A-Za-z0-9])(${IATA_ALT})(?![A-Za-z0-9])`, 'gi')

export function airlineIataToKoPublic(code: string | null | undefined): string | null {
  const c = String(code ?? '')
    .trim()
    .toUpperCase()
  if (!c) return null
  return AIRLINE_IATA_KO_PUBLIC[c] ?? null
}

/** 구 브랜드·별칭을 공개 표준명으로 */
export function canonicalizePublicAirlineKo(raw: string): string {
  const s = String(raw ?? '').trim()
  if (!s) return s
  const direct = AIRLINE_LEGACY_KO_TO_PUBLIC[s]
  if (direct) return direct
  // REGRESSION-FREEZE[airline-tway-to-trinity]: legacy brand scrub — manifest
  return s
    .replace(/티웨이\s*항공/gi, '트리니티항공')
    .replace(/(?<![가-힣])티웨이(?![가-힣])/gi, '트리니티')
    .replace(/T['’]?\s*way(?:\s*Air)?/gi, '트리니티항공')
}

/** 히어로 항공 줄 — `TW` → `트리니티항공` (구 티웨이명도 정규화) */
export function formatPublicAirlineDisplay(raw: string | null | undefined): string | null {
  const s = String(raw ?? '').trim()
  if (!s) return null
  if (/[가-힣]{2,}/.test(s)) return canonicalizePublicAirlineKo(s)
  const bare = s.toUpperCase().match(/^(?:[A-Z]{2}|[A-Z]\d|\d[A-Z])$/)?.[0]
  if (bare) {
    const ko = airlineIataToKoPublic(bare)
    if (ko) return ko
  }
  const fromFlight = s.toUpperCase().match(/^((?:[A-Z]{2}|[A-Z]\d|\d[A-Z]))\d{2,4}$/)?.[1]
  if (fromFlight) {
    const ko = airlineIataToKoPublic(fromFlight)
    if (ko) return ko
  }
  return expandAirlineIataCodesInPublicTitle(s)
}

/**
 * 히어로 카드 제목 표시용 — 단독 IATA를 한글 항공사명으로.
 * REGRESSION-FREEZE[public-hero-airline-iata-ko]: expandAirlineIataCodesInPublicTitle — manifest
 */
export function expandAirlineIataCodesInPublicTitle(title: string): string {
  const t = String(title ?? '')
  if (!t) return t
  const expanded = t.replace(BARE_IATA_RE, (m) => airlineIataToKoPublic(m) ?? m)
  return canonicalizePublicAirlineKo(expanded)
}
