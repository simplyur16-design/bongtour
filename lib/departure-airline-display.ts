/**
 * 공개 화면 항공사 — 출발 회차(편명) 기준. 표시 전용: DB 원문(Product.airline / ProductDeparture.carrierName)은 그대로 둔다.
 * 사장님 10/31 07:25 "항공사 코드 고치고 해당 상품 재수집까지 해라".
 *
 * REGRESSION-FREEZE[airline-code-follow-departure]: 회차 항공사 = 편명 IATA 우선(원문 항공사명과 코드가 어긋날 때), 대표 항공사 = 회차 항공사 집계 — vitest
 */
import { formatPublicAirlineDisplay, AIRLINE_IATA_KO_PUBLIC } from '@/lib/airline-iata-public-display-ssot'

/**
 * 편명 접두 IATA → 한글명 — 공개 SSOT(AIRLINE_IATA_KO_PUBLIC)에 없는 코드 보강.
 * 제목 속 단독 코드 치환(BARE_IATA_RE)에는 쓰지 않는다(영문 단어 오치환 방지) — 편명 접두 판정 전용.
 */
export const FLIGHT_PREFIX_IATA_KO_EXTRA: Readonly<Record<string, string>> = {
  HX: '홍콩항공',
  UO: '홍콩익스프레스',
  NX: '에어마카오',
  D7: '에어아시아 엑스',
  AK: '에어아시아',
  FD: '타이 에어아시아',
  '9G': '썬푸꾸옥항공',
  WE: '파라타항공',
  SK: '스칸디나비아항공',
  AY: '핀에어',
  LO: 'LOT폴란드항공',
  AI: '에어인디아',
  UL: '스리랑카항공',
  BI: '로얄브루나이항공',
  JQ: '젯스타항공',
  '3U': '사천항공',
  T5: '투르크메니스탄항공',
  KC: '에어아스타나',
  AM: '아에로멕시코',
  TR: '스쿠트항공',
  SC: '산동항공',
  HY: '우즈베키스탄항공',
  MH: '말레이시아항공',
  GA: '가루다인도네시아항공',
  '5J': '세부퍼시픽항공',
  QV: '라오항공',
  LX: '스위스항공',
  LA: '라탐항공',
  MF: '샤먼항공',
  GJ: '룽에어',
  QW: '청도항공',
  M0: '에어로몽골리아',
  KN: '중국연합항공',
  JD: '베이징캐피탈항공',
  '9H': '장안항공',
}

/** 공급사 원문 항공사명(띄어쓰기 제거) → IATA. 코드 대조 전용(표시명 아님) */
const SUPPLIER_NAME_TO_IATA: Readonly<Record<string, string>> = {
  대한항공: 'KE', 아시아나항공: 'OZ', 아시아나: 'OZ', 제주항공: '7C', 제주에어: '7C', 티웨이항공: 'TW', 티웨이: 'TW',
  트리니티항공: 'TW', 이스타항공: 'ZE', 진에어: 'LJ', 에어부산: 'BX', 에어서울: 'RS', 에어프레미아: 'YP',
  파라타항공: 'WE', 에어로케이: 'RF', 에어로케이항공: 'RF', 에미레이트항공: 'EK', 에미레이트: 'EK', 터키항공: 'TK',
  비엣젯항공: 'VJ', 타이비엣젯: 'VZ', 타이비엣젯항공: 'VZ', 비엣젯타일랜드: 'VZ', 싱가포르항공: 'SQ', 싱가폴항공: 'SQ',
  중국동방항공: 'MU', 중국국제항공: 'CA', 중국남방항공: 'CZ', 베트남항공: 'VN', 썬푸꾸옥항공: '9G',
  LOT폴란드항공: 'LO', 로트폴란드항공: 'LO', 폴란드항공: 'LO', 스칸디나비아항공: 'SK', 젯스타항공: 'JQ', 젯스타: 'JQ',
  에어마카오: 'NX', 캐세이퍼시픽: 'CX', 캐세이퍼시픽항공: 'CX', 카타르항공: 'QR', 카타르: 'QR', 스쿠트항공: 'TR',
  산동항공: 'SC', 에티하드항공: 'EY', 에티하드: 'EY', 에어프랑스: 'AF', 핀에어: 'AY', 핀란드항공: 'AY',
  타이에어아시아: 'FD', 에어아시아: 'AK', 에어아시아X: 'D7', 에어아시아엑스: 'D7', 룽에어: 'GJ', 청도항공: 'QW',
  에어로몽골리아: 'M0', 중국연합항공: 'KN', 중화항공: 'CI', 우즈베키스탄항공: 'HY', 홍콩익스프레스: 'UO',
  중국사천항공: '3U', 사천항공: '3U', 라탐항공: 'LA', 홍콩항공: 'HX', 홍콩에어라인: 'HX', 투르크메니스탄항공: 'T5',
  장안항공: '9H', 루프트한자: 'LH', 루프트한자독일항공: 'LH', 세부퍼시픽항공: '5J', 가루다인도네시아항공: 'GA',
  말레이시아항공: 'MH', 에어아스타나: 'KC', 라오항공: 'QV', 북경수도항공: 'JD', 스위스항공: 'LX', 브루나이항공: 'BI',
  로얄브루나이항공: 'BI', 아에로멕시코: 'AM', 에어인디아: 'AI', 스리랑카항공: 'UL', 에어캐나다: 'AC',
  유나이티드항공: 'UA', 중국하문항공: 'MF', 샤먼항공: 'MF', 타이항공: 'TG', 필리핀항공: 'PR', 일본항공: 'JL',
  전일본공수: 'NH', 영국항공: 'BA', 델타항공: 'DL', 에바항공: 'BR', 피치항공: 'MM', 하와이안항공: 'HA',
}

const FLIGHT_NO_RE = /^\s*((?:[A-Z]{2}|[A-Z]\d|\d[A-Z]))\s*-?\s*\d{2,4}[A-Z]?\s*$/i

/** 편명(AF267, 7C 2503, VZ0851) → IATA 접두. 편명 형식이 아니면 null */
export function iataPrefixFromFlightNo(flightNo: string | null | undefined): string | null {
  const m = String(flightNo ?? '').toUpperCase().match(FLIGHT_NO_RE)
  return m?.[1] ?? null
}

/** IATA → 공개 한글명 (공개 SSOT 우선, 없으면 편명 접두 보강표). 모르면 null(추측 금지) */
export function airlineKoFromIata(code: string | null | undefined): string | null {
  const c = String(code ?? '').trim().toUpperCase()
  if (!c) return null
  const ko = (AIRLINE_IATA_KO_PUBLIC as Record<string, string>)[c] ?? FLIGHT_PREFIX_IATA_KO_EXTRA[c] ?? null
  return ko ? formatPublicAirlineDisplay(ko) ?? ko : null
}

/** 공급사 원문 항공사명 → IATA. "(구)티웨이항공" 같은 꼬리·띄어쓰기 무시, 앞에 일정 문구가 붙어도 끝말로 판정. 모르면 null */
export function iataFromSupplierAirlineName(name: string | null | undefined): string | null {
  let s = String(name ?? '').trim()
  if (!s) return null
  if (/^(?:[A-Z]{2}|[A-Z]\d|\d[A-Z])$/i.test(s)) return s.toUpperCase()
  s = s.replace(/\(\s*구\s*\).*$/, '').replace(/\s+/g, '')
  if (SUPPLIER_NAME_TO_IATA[s]) return SUPPLIER_NAME_TO_IATA[s]!
  const keys = Object.keys(SUPPLIER_NAME_TO_IATA).sort((a, b) => b.length - a.length)
  for (const k of keys) if (k.length >= 3 && s.endsWith(k)) return SUPPLIER_NAME_TO_IATA[k]!
  return null
}

/** 글자 깨짐(U+FFFD)·미표기 등 항공사명이 아닌 값 */
function isUnusableCarrierName(s: string): boolean {
  return !s || /\uFFFD/.test(s) || /^(?:미표기|미정|미확정|-+)$/.test(s)
}

export type DepartureAirlineRowLike = {
  carrierName?: string | null
  outboundFlightNo?: string | null
  inboundFlightNo?: string | null
}

/**
 * 출발 회차 하나의 공개 항공사(원문 표기).
 * - 원문 항공사명과 편명 IATA 가 어긋나면(가는편·오는편 어느 쪽 코드와도 다르면) 가는편 편명 항공사.
 *   예: carrierName '카타르' + AF267/AF264 → 에어프랑스, '에어부산' + YP151 → 에어프레미아.
 * - 원문 이름 코드가 오는편과만 같으면(KE951 / EK773 + 에미레이트) 원문 그대로 — 공동운항·다구간 보수 처리.
 * - 원문 이름이 없거나 깨졌으면 가는편(없으면 오는편) 편명 항공사.
 * 반환은 원문 표기(공개명 변환은 화면의 formatPublicAirlineDisplay 가 담당). 판정 불가 null.
 */
export function resolveDepartureRowAirlineForDisplay(row: DepartureAirlineRowLike): string | null {
  const raw = String(row.carrierName ?? '').trim()
  const name = isUnusableCarrierName(raw) ? '' : raw
  const ob = iataPrefixFromFlightNo(row.outboundFlightNo)
  const ib = iataPrefixFromFlightNo(row.inboundFlightNo)
  const prefixName = airlineKoFromIata(ob) ?? airlineKoFromIata(ib)
  if (!name) return prefixName
  const nameCode = iataFromSupplierAirlineName(name)
  if (!nameCode || (!ob && !ib)) return name
  if (nameCode === ob || nameCode === ib) return name
  const flightKo = airlineKoFromIata(ob)
  if (!flightKo) return name
  // REGRESSION-FREEZE[airline-codeshare-same-alliance]: 원문 항공사와 편명 항공사가 같은 동맹이면 공동운항 표기 (사장님 10/31 08:59 mt-0264) — vitest
  const flightCode = ob ?? ib
  if (flightCode && sameAirlineAlliance(nameCode, flightCode)) return `${flightKo}${CODESHARE_SUFFIX_KO}`
  return flightKo
}

export const CODESHARE_SUFFIX_KO = '(공동운항)'

/** 항공 동맹(공동운항 판정용). 동맹이 다르거나 없는 조합(카타르+AF, 에어부산+YP)은 단순 오기로 보고 편명 항공사. */
const AIRLINE_ALLIANCE: Readonly<Record<string, 'skyteam' | 'star' | 'oneworld'>> = {
  KE: 'skyteam', AF: 'skyteam', KL: 'skyteam', DL: 'skyteam', AM: 'skyteam', CI: 'skyteam', MU: 'skyteam',
  MF: 'skyteam', GA: 'skyteam', VN: 'skyteam', SV: 'skyteam', ME: 'skyteam', KQ: 'skyteam', AR: 'skyteam',
  RO: 'skyteam', UX: 'skyteam', SK: 'skyteam', VS: 'skyteam', AZ: 'skyteam',
  OZ: 'star', NH: 'star', UA: 'star', LH: 'star', LX: 'star', OS: 'star', LO: 'star', TK: 'star', SQ: 'star',
  TG: 'star', AI: 'star', CA: 'star', NZ: 'star', AC: 'star', ET: 'star', MS: 'star', TP: 'star', SA: 'star',
  ZH: 'star', BR: 'star', A3: 'star', CM: 'star', AV: 'star', OU: 'star', SN: 'star',
  AA: 'oneworld', BA: 'oneworld', CX: 'oneworld', JL: 'oneworld', QF: 'oneworld', QR: 'oneworld', MH: 'oneworld',
  AY: 'oneworld', IB: 'oneworld', RJ: 'oneworld', UL: 'oneworld', AS: 'oneworld', AT: 'oneworld', WY: 'oneworld',
  FJ: 'oneworld',
}

export function sameAirlineAlliance(a: string | null | undefined, b: string | null | undefined): boolean {
  const x = AIRLINE_ALLIANCE[String(a ?? '').toUpperCase()]
  const y = AIRLINE_ALLIANCE[String(b ?? '').toUpperCase()]
  return Boolean(x && y && x === y && String(a).toUpperCase() !== String(b).toUpperCase())
}

function displayKey(label: string): string {
  const f = formatPublicAirlineDisplay(label) ?? label
  return f.replace(/\(\s*구\s*\).*$/, '').replace(/\s+/g, '')
}

/**
 * 상품 대표 항공사(표시 전용) — 출발 회차 항공사 집계.
 * - 회차 항공사가 없으면 Product.airline 그대로.
 * - Product.airline 이 최다(또는 유일) 회차 항공사와 같으면 원문 그대로(예: 트리니티항공(구)티웨이항공).
 * - 1개면 그 항공사.
 * - 2개 이상: Product.airline 이 최다 회차 항공사면 그대로, 아니면 "최다 항공사 외 N개 항공사".
 * 원문 Product.airline 은 바꾸지 않는다.
 */
export function resolveProductAirlineFromDeparturesForDisplay(
  productAirline: string | null | undefined,
  departures: ReadonlyArray<DepartureAirlineRowLike>,
): string | null {
  const pa = String(productAirline ?? '').trim() || null
  const counts = new Map<string, { label: string; n: number }>()
  for (const d of departures ?? []) {
    const a = resolveDepartureRowAirlineForDisplay(d)
    if (!a) continue
    const label = formatPublicAirlineDisplay(a) ?? a
    const k = displayKey(label)
    const cur = counts.get(k)
    if (cur) cur.n += 1
    else counts.set(k, { label, n: 1 })
  }
  if (counts.size === 0) return pa
  const sorted = [...counts.values()].sort((a, b) => b.n - a.n)
  const top = sorted[0]!
  if (pa && displayKey(pa) === displayKey(top.label)) return pa
  if (sorted.length === 1) return top.label
  return `${top.label} 외 ${sorted.length - 1}개 항공사`
}
