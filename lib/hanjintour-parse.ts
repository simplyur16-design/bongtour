/**
 * 한진관광 JSON 응답 → 수집 구조. 가격은 응답 필드의 원문 숫자만 쓴다(추정·보정·LLM 금지).
 * REGRESSION-FREEZE[hanjintour-supplier-collect]: 가격 원문 값만, 출발일 없는 상품은 등록대기 금지 — manifest
 */

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v)
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '')
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])

/** 원문 금액: 정수 원 단위 숫자(또는 숫자 문자열)만 인정. 0·음수·소수·빈 값은 null. */
export function hanjintourRawPrice(v: unknown): number | null {
  if (typeof v === 'number') return Number.isInteger(v) && v > 0 ? v : null
  if (typeof v === 'string' && /^\d{1,3}(,?\d{3})*$/.test(v.trim())) {
    const n = Number(v.replace(/,/g, ''))
    return n > 0 ? n : null
  }
  return null
}

/** YYYYMMDD(또는 YYYYMMDDhhmm) → YYYY-MM-DD. 형식이 아니면 null. */
export function hanjintourIsoDate(v: unknown): string | null {
  const m = str(v).match(/^(\d{4})(\d{2})(\d{2})/)
  if (!m) return null
  const [, y, mo, d] = m
  const dt = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d)))
  if (dt.getUTCMonth() !== Number(mo) - 1 || dt.getUTCDate() !== Number(d)) return null
  return `${y}-${mo}-${d}`
}

export type HanjintourCategoryLeaf = { dspCtgNo: string; path: string[]; level: number }

/** 메뉴 → '패키지여행' 아래 목록 화면(displayList) 말단 분류만. */
export function parseHanjintourPackageLeaves(gnb: unknown): HanjintourCategoryLeaf[] {
  const list = isObj(gnb) ? arr(gnb.gnbMenuListVoList) : []
  const nodes = list.filter(isObj)
  const parents = new Set(nodes.map((n) => str(n.uprDspCtgNo)).filter(Boolean))
  const out: HanjintourCategoryLeaf[] = []
  for (const n of nodes) {
    const no = str(n.dspCtgNo)
    if (!no || parents.has(no)) continue
    if (str(n.tmplFlnm) !== '/dp/display/displayList') continue
    const path = str(n.dspCtgPath)
      .split('>')
      .map((s) => s.trim())
      .filter(Boolean)
    if (path[0] === '메인') path.shift()
    if (path[0] !== '패키지여행') continue
    out.push({ dspCtgNo: no, path: path.slice(1), level: Number(n.ctgLvVal) || path.length })
  }
  return out
}

export type HanjintourListingItem = {
  gdsNo: string
  title: string
  nights: number | null
  days: number | null
  minPrice: number | null
  minPriceDate: string | null
  airline: string | null
  imageUrl: string | null
}

export function parseHanjintourDisplayList(body: unknown): { items: HanjintourListingItem[]; totalCnt: number } {
  if (!isObj(body) || body.result === false) return { items: [], totalCnt: 0 }
  const items: HanjintourListingItem[] = []
  for (const g of arr(body.goodsList).filter(isObj)) {
    const gdsNo = str(g.gdsNo)
    const title = str(g.gdsNm)
    if (!gdsNo || !title) continue
    const airline = arr(g.airlines).filter(isObj).map((a) => str(a.arlnNm)).find(Boolean) ?? null
    items.push({
      gdsNo,
      title,
      nights: Number(str(g.trPrdLodgNody)) || null,
      days: Number(str(g.trPrdNody)) || null,
      minPrice: hanjintourRawPrice(g.gdsMinPrice),
      minPriceDate: hanjintourIsoDate(g.tofde),
      airline,
      imageUrl: str(g.s3Url) || null,
    })
  }
  return { items, totalCnt: Number(body.totalCnt) || items.length }
}

export type HanjintourDeparture = {
  evtNo: string
  date: string
  rawDate: string
  status: string | null
  adultPrice: number | null
  childPrice?: number | null
  infantPrice?: number | null
  airline?: string | null
  departAt?: string | null
  returnAt?: string | null
}

/** 출발일 달력 → 출발일별 행사(evtNo)·상태·성인 요금(원문). 날짜 형식이 아니거나 evtNo 없는 행은 버린다. */
export function parseHanjintourCalendar(body: unknown): HanjintourDeparture[] {
  if (!isObj(body) || body.result === false) return []
  const out: HanjintourDeparture[] = []
  const seen = new Set<string>()
  for (const r of arr(body.eventCalendarList).filter(isObj)) {
    const evtNo = str(r.evtNo)
    const date = hanjintourIsoDate(r.tofDe)
    if (!evtNo || !date || seen.has(evtNo)) continue
    seen.add(evtNo)
    out.push({ evtNo, date, rawDate: str(r.tofDe), status: str(r.tktrrDstgNm) || null, adultPrice: hanjintourRawPrice(r.adltFare) })
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.evtNo.localeCompare(b.evtNo))
}

/** "27.03.21 (일) 12:10" → "2027-03-21 12:10" */
function hanjintourShortDateTime(v: unknown): string | null {
  const m = str(v).match(/^(\d{2})\.(\d{2})\.(\d{2})(?:\s*\([^)]*\))?(?:\s+(\d{2}):(\d{2}))?/)
  if (!m) return null
  return `20${m[1]}-${m[2]}-${m[3]}${m[4] ? ` ${m[4]}:${m[5]}` : ''}`
}

/** 출발일별 행사 목록 → 성인·아동·유아 요금(원문)·항공·출발/귀국 시각 */
export function parseHanjintourEventList(body: unknown, date: string | null = null): HanjintourDeparture[] {
  if (!isObj(body) || body.result === false) return []
  const out: HanjintourDeparture[] = []
  for (const r of arr(body.eventList).filter(isObj)) {
    const evtNo = str(r.evtNo)
    const departAt = hanjintourShortDateTime(r.deptDt)
    const d = hanjintourIsoDate(r.tofDe) ?? departAt?.slice(0, 10) ?? date
    if (!evtNo || !d) continue
    out.push({
      evtNo,
      date: d,
      rawDate: d.replace(/-/g, ''),
      status: str(r.tktrrDstgNm) || null,
      adultPrice: hanjintourRawPrice(r.adltFare),
      childPrice: hanjintourRawPrice(r.chldFare),
      infantPrice: hanjintourRawPrice(r.infntFare),
      airline: str(r.dpfcArlnNm) || null,
      departAt,
      returnAt: hanjintourShortDateTime(r.rthcDt),
    })
  }
  return out
}

export type HanjintourScheduleDay = {
  day: number
  cities: string[]
  spots: string[]
  descriptions: string[]
  hotels: string[]
  meals: { breakfast: string | null; lunch: string | null; dinner: string | null }
}

const stripHtml = (s: string) =>
  s
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/[ \t]+\n/g, '\n')
    .trim()

/** 일정 → 일차별 방문 도시·관광지·설명·숙소·식사. 공개 화면과 같이 schdlDtlSn 으로 묶는다. */
export function parseHanjintourSchedule(body: unknown): { days: HanjintourScheduleDay[] } {
  if (!isObj(body) || body.result === false) return { days: [] }
  const by = (k: string) => {
    const m = new Map<number, Obj[]>()
    for (const r of arr(body[k]).filter(isObj)) {
      const sn = Number(r.schdlDtlSn)
      if (!m.has(sn)) m.set(sn, [])
      m.get(sn)!.push(r)
    }
    for (const list of m.values()) list.sort((a, b) => (Number(a.srtSeq) || 0) - (Number(b.srtSeq) || 0) || (Number(a.schdlDtlSeqSn) || 0) - (Number(b.schdlDtlSeqSn) || 0))
    return m
  }
  const trips = by('tripList')
  const descs = by('descList')
  const lodgs = by('lodgList')
  const uniq = (xs: string[]) => [...new Set(xs.filter(Boolean))]
  const meal = (code: unknown, text: unknown) => str(text) || (str(code) && str(code) !== 'ML_TP_900' ? str(code) : '') || null
  const days = arr(body.eventScheduleDayList)
    .filter(isObj)
    .map((d) => {
      const sn = Number(d.schdlDtlSn)
      const t = trips.get(sn) ?? []
      return {
        day: Number(d.schdlDyo) || 0,
        cities: uniq(t.filter((x) => str(x.schdDstgCd)).map((x) => str(x.cityKorNm))),
        spots: uniq(t.filter((x) => str(x.trdstnClsfCd) === 'TRDSTN_CLSF_002').map((x) => str(x.trdstnNm))),
        descriptions: (descs.get(sn) ?? []).map((x) => stripHtml(str(x.amplDescCntn))).filter(Boolean),
        hotels: uniq((lodgs.get(sn) ?? []).map((x) => str(x.htlKrnm) || str(x.crusKrnm))),
        meals: { breakfast: meal(d.bfMlTpCd, d.bfMlCntn), lunch: meal(d.lncMlTpCd, d.lncMlCntn), dinner: meal(d.dnrMlTpCd, d.dnrMlCntn) },
      }
    })
    .filter((d) => d.day > 0)
    .sort((a, b) => a.day - b.day)
  return { days }
}

/** 출발일·성인 요금(원문)이 있는 오늘 이후 출발이 하나도 없으면 등록대기에 넣지 않는다. */
export function hanjintourShouldEnqueuePending(p: { departures: HanjintourDeparture[] }, todayIso: string = new Date().toISOString().slice(0, 10)): boolean {
  return p.departures.some((d) => !!d.date && d.date >= todayIso && d.adultPrice != null)
}

/** 보존용 원본에서 전화·메일 등 연락처 필드 제거 (fixture·산출물 저장 전) */
export function stripHanjintourContactFields<T>(v: T): T {
  if (Array.isArray(v)) return v.map(stripHanjintourContactFields) as T
  if (!isObj(v)) return v
  const out: Obj = {}
  for (const [k, x] of Object.entries(v)) {
    if (/tel|phone|mobile|email|hpno|faxno/i.test(k)) continue
    out[k] = stripHanjintourContactFields(x)
  }
  return out as T
}
