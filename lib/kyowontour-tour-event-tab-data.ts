/**
 * 교원이지(kyowontour) 상세 탭 AJAX — `POST /goods/tourEventTabData`.
 * UI 「선택관광/쇼핑」 탭은 `goodsEvtTab_7`.
 *
 * REGRESSION-FREEZE[kyowontour-tour-event-tab-opt-shop]: goodsEvtTab_1/2/3/7 tourEventTabData 파싱 — manifest
 */
import type {
  KyowontourOptionalTourFromBody,
  KyowontourShoppingItemFromBody,
} from '@/lib/kyowontour-admin-preview-card-types'
import { normalizeRegisterOptionalTourCurrency } from '@/lib/register-admin-preview-card-build'

export const KYOWONTOUR_TAB_SCHEDULE_ID = 'goodsEvtTab_2' as const
export const KYOWONTOUR_TAB_OPT_SHOP_ID = 'goodsEvtTab_7' as const
/** 상품 핵심포인트·포함/불포함·예약안내 요약 */
export const KYOWONTOUR_TAB_CORE_ID = 'goodsEvtTab_1' as const
/** 예약안내 상세(여권·비자·안전) */
export const KYOWONTOUR_TAB_RESERVATION_ID = 'goodsEvtTab_3' as const

/** 등록 자동수집 — 핵심·일정·선택관광/쇼핑 탭 */
export const KYOWONTOUR_REGISTER_TAB_IDS = [
  KYOWONTOUR_TAB_CORE_ID,
  KYOWONTOUR_TAB_SCHEDULE_ID,
  KYOWONTOUR_TAB_OPT_SHOP_ID,
] as const

/** probe·운영 문서용 — UI 탭과 내부 탭 구분 */
export const KYOWONTOUR_TAB_PROBE_IDS = [
  { tabId: 'goodsEvtTab_1', label: '상품 핵심포인트' },
  { tabId: 'goodsEvtTab_2', label: '여행일정표' },
  { tabId: KYOWONTOUR_TAB_OPT_SHOP_ID, label: '선택관광/쇼핑' },
  { tabId: 'goodsEvtTab_8', label: '여행후기' },
  { tabId: 'goodsEvtTab_9', label: '안내사항' },
  { tabId: 'goodsEvtTab_3', label: '예약안내(내부)' },
  { tabId: 'goodsEvtTab_5', label: '약관(내부)' },
] as const

export type KyowontourTourEventHiddenFields = {
  tourCode: string
  menuCode: string
  tourId: string
  masterCode: string
  masterId: string
}

export type KyowontourOptShopTabParsed = {
  optionalTours: KyowontourOptionalTourFromBody[]
  shoppingItems: KyowontourShoppingItemFromBody[]
  shoppingVisitCount: number
}

export type KyowontourScheduleRowParsed = {
  day: number
  step: number
  type: string
  nameKo: string
  duration: string
}

export type KyowontourScheduleMealRowParsed = {
  day: number
  breakfast: string | null
  lunch: string | null
  dinner: string | null
}

export type KyowontourScheduleTabParsed = {
  rows: KyowontourScheduleRowParsed[]
  meals: KyowontourScheduleMealRowParsed[]
  meetingText: string | null
  dayCount: number
}

/** CSP302260621KE01 실측 `goodsEvtTab_7.detail` — 회귀·probe 검증용 */
export const CSP302_OPT_SHOP_TAB7_DETAIL_FIXTURE = {
  evtType: [
    {
      productId: 3998376,
      etc: {
        shopping_list: [
          { item: '보이차', location: '곤명', time: '약 1시간', cancel: '개별확인' },
          { item: '침향', location: '곤명', time: '약 1시간', cancel: '개별확인' },
        ],
      },
      typeName: '쇼핑정보',
      id: 39073959,
      type: 8,
    },
  ],
  etcTour: [
    {
      nameKo: '빙천세계 케이블카',
      adultPrice: 50,
      childPrice: 50,
      infantPrice: 0,
      currency: 'USD',
      timeRequired: '약 1시간',
      otherSchedule: '지정장소 자유시간',
      description: '옥룡설산 빙하도',
    },
    {
      nameKo: '여강고성 나이트 투어(맥주1잔제공)',
      adultPrice: 30,
      childPrice: 30,
      infantPrice: 0,
      currency: 'USD',
      timeRequired: '약 1시간',
      otherSchedule: '지정장소 자유 시간(가이드 비동행)',
      descriptionShort: '밤에도 활기찬 여강 고성',
    },
    {
      nameKo: '발마사지(60분)',
      adultPrice: 30,
      childPrice: 30,
      infantPrice: 0,
      currency: 'USD',
      timeRequired: '60분',
      otherSchedule: '주변 자유시간 (가이드 미동행)',
    },
    {
      nameKo: '발+전신마사지(90분)',
      adultPrice: 40,
      childPrice: 40,
      infantPrice: 0,
      currency: 'USD',
      timeRequired: '90분',
    },
    {
      nameKo: '양꼬치 무제한',
      adultPrice: 30,
      childPrice: 30,
      infantPrice: 0,
      currency: 'USD',
    },
    {
      nameKo: '호도협 미니트래킹',
      adultPrice: 50,
      childPrice: 50,
      infantPrice: 0,
      currency: 'USD',
      timeRequired: '약 1시간30분~2시간 소요',
    },
  ],
} as const

/** CSP302260621KE01 실측 `goodsEvtTab_1.detail` — 핵심포인트·포함/불포함 회귀용 */
export const CSP302_CORE_TAB1_DETAIL_FIXTURE = {
  evtType: [
    {
      etc3: '①결제 안내\n- 예약 후 익일까지 20만원/인 예약금 입금',
      productId: 3998376,
      typeName: '예약안내사항',
      id: 39073956,
      type: 5,
      etc5: '- 현지 연락처는 출발 당일 공항에서 확정서를 통해 안내드립니다.',
    },
    {
      etc3: [
        { tag: '왕복항공권', val: 'I1', remark: '' },
        { tag: '일정표상의 숙박', val: 'I5', remark: '2인1실 기준' },
        { tag: '여행자 보험', val: 'I8', remark: '' },
      ],
      productId: 3998376,
      typeName: '포함/불포함',
      id: 39073957,
      type: 2,
      etc4: [
        { tag: '싱글룸 사용료', val: 'I11', remark: '21만원/1인/전일정' },
        { tag: '기타경비', val: 'E1', remark: '유류할증료 인상분, 개인경비 및 매너팁 등' },
        { tag: '가이드/기사 경비', val: 'I10', remark: 'USD50' },
      ],
    },
  ],
  point: [
    {
      productId: 3998376,
      typeName: '핵심포인트',
      nameKo: '여강 고성 야경',
      descriptionShort: '밤에도 활기찬 여강 고성 거리 산책',
    },
    {
      productId: 3998376,
      typeName: '핵심포인트',
      nameKo: '옥룡설산',
      descriptionShort: '빙천세계 케이블카와 자연 경관',
    },
  ],
} as const

/** CSP302260621KE01 실측 `goodsEvtTab_3.detail` — 예약안내(비자·여권) 회귀용 */
export const CSP302_RESERVATION_TAB3_DETAIL_FIXTURE = {
  reservation: {
    type: 5,
    beforeTourInfo:
      '① 예약 진행 안내\n- 예약 접수 시 바로 확정이 되는 것이 아니며, 담당자의 해피콜 유선 안내 후 예약의 확정여부가 결정됩니다.\n\n③ 중국 비자 안내\n- 중국 일시적 무비자 입국 실시',
    etcInfo: '① 여행 전 준비사항\n- 신발(운동화), 간단한 세면도구',
    safetyInfo: '- 현지 연락처는 출발 당일 공항에서 확정서를 통해 안내드립니다.',
  },
} as const

/** CSP302260621KE01 실측 `goodsEvtTab_2.detail` — 일정 회귀·probe 검증용 */
export const CSP302_SCHEDULE_TAB2_DETAIL_FIXTURE = {
  schedule: [
    { day: 1, step: 1, type: '직접입력', nameKo: '인천 국제공항 출발' },
    { day: 1, step: 2, type: '국가/도시', nameKo: '쿤밍' },
    { day: 1, step: 3, type: '호텔', nameKo: '쿤밍 4성급 호텔' },
    { day: 2, step: 1, type: '관광지', nameKo: '▶여강고성 관광' },
    { day: 2, step: 2, type: '관광지', nameKo: '▶대,소석림 관광(전동카 탑승)' },
    { day: 2, step: 3, type: '호텔', nameKo: '리장 호텔' },
  ],
  scheduleMeal: [
    { day: 1, breakfast: '-', lunch: '기내식', dinner: '현지식(중식)' },
    { day: 2, breakfast: '호텔식', lunch: '현지식', dinner: '현지식' },
  ],
  meeting: { departportName: '인천국제공항', terminal: '제1터미널', nameKo: '인천국제공항 제1터미널' },
} as const

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null
}

export function extractKyowontourHiddenFieldsFromDetailHtml(html: string): KyowontourTourEventHiddenFields | null {
  function hidden(name: string): string | null {
    const re1 = new RegExp(`id=["']${name}["'][^>]*value=["']([^"']*)["']`, 'i')
    const re2 = new RegExp(`name=["']${name}["'][^>]*value=["']([^"']*)["']`, 'i')
    return html.match(re1)?.[1] ?? html.match(re2)?.[1] ?? null
  }
  const tourCode = hidden('tourCode')?.trim()
  const menuCode = hidden('menuCode')?.trim()
  const tourId = hidden('tourId')?.trim()
  const masterCode = hidden('masterCode')?.trim()
  const masterId = hidden('masterId')?.trim()
  if (!tourCode || !menuCode || !tourId || !masterCode || !masterId) return null
  return { tourCode, menuCode, tourId, masterCode, masterId }
}

export function parseKyowontourEtcTourRow(raw: unknown): KyowontourOptionalTourFromBody | null {
  const o = asRecord(raw)
  if (!o) return null
  const name = String(o.nameKo ?? o.name ?? '').trim()
  if (!name) return null
  const curRaw = String(o.currency ?? o.currencyCode ?? o.currencyName ?? 'KRW')
  const currency = normalizeRegisterOptionalTourCurrency(curRaw)
  return {
    name,
    description: String(o.description ?? o.descriptionShort ?? '').trim(),
    priceAdult: Math.max(0, Math.floor(Number(o.adultPrice ?? 0))),
    priceChild: Math.max(0, Math.floor(Number(o.childPrice ?? 0))),
    priceInfant: Math.max(0, Math.floor(Number(o.infantPrice ?? 0))),
    currency,
    duration: String(o.timeRequired ?? o.duration ?? '').trim(),
    alternativeProgram: String(o.otherSchedule ?? o.alternateSchedule ?? '').trim(),
  }
}

export function parseKyowontourShoppingListRow(raw: unknown): KyowontourShoppingItemFromBody | null {
  const o = asRecord(raw)
  if (!o) return null
  const itemName = String(o.item ?? o.shoppingItem ?? o.itemName ?? '').trim()
  if (!itemName) return null
  return {
    itemName,
    shopLocation: String(o.location ?? o.shoppingPlace ?? '').trim(),
    duration: String(o.time ?? o.duration ?? '').trim(),
    refundable: String(o.cancel ?? o.refund ?? o.refundPolicy ?? '').trim(),
  }
}

export function extractKyowontourShoppingListFromEvtType(evtType: unknown): KyowontourShoppingItemFromBody[] {
  if (!Array.isArray(evtType)) return []
  const out: KyowontourShoppingItemFromBody[] = []
  for (const row of evtType) {
    const r = asRecord(row)
    if (!r) continue
    const type = Number(r.type)
    const typeName = String(r.typeName ?? '')
    const isShop = type === 8 || /쇼핑/.test(typeName)
    if (!isShop) continue
    const etc = asRecord(r.etc)
    const list = etc?.shopping_list
    if (!Array.isArray(list)) continue
    for (const item of list) {
      const parsed = parseKyowontourShoppingListRow(item)
      if (parsed) out.push(parsed)
    }
  }
  return out
}

export function parseKyowontourScheduleRow(raw: unknown): KyowontourScheduleRowParsed | null {
  const o = asRecord(raw)
  if (!o) return null
  const day = Number(o.day)
  if (!Number.isInteger(day) || day < 1 || day > 99) return null
  const nameKo = String(o.nameKo ?? o.name ?? '').trim()
  if (!nameKo) return null
  return {
    day,
    step: Math.max(0, Math.floor(Number(o.step ?? 0))),
    type: String(o.type ?? o.typeName ?? '').trim() || '직접입력',
    nameKo,
    duration: String(o.duration ?? o.timeRequired ?? '').trim(),
  }
}

export function parseKyowontourScheduleMealRow(raw: unknown): KyowontourScheduleMealRowParsed | null {
  const o = asRecord(raw)
  if (!o) return null
  const day = Number(o.day)
  if (!Number.isInteger(day) || day < 1 || day > 99) return null
  const mealCell = (v: unknown): string | null => {
    const t = String(v ?? '').trim()
    if (!t || t === '-' || t === '—' || t === '–') return null
    return t
  }
  return {
    day,
    breakfast: mealCell(o.breakfast),
    lunch: mealCell(o.lunch),
    dinner: mealCell(o.dinner),
  }
}

export function parseKyowontourScheduleTabDetail(detail: unknown): KyowontourScheduleTabParsed {
  const d = asRecord(detail)
  const rows: KyowontourScheduleRowParsed[] = []
  const schedule = d?.schedule
  if (Array.isArray(schedule)) {
    for (const row of schedule) {
      const parsed = parseKyowontourScheduleRow(row)
      if (parsed) rows.push(parsed)
    }
  }
  rows.sort((a, b) => (a.day !== b.day ? a.day - b.day : a.step - b.step))

  const meals: KyowontourScheduleMealRowParsed[] = []
  const scheduleMeal = d?.scheduleMeal
  if (Array.isArray(scheduleMeal)) {
    for (const row of scheduleMeal) {
      const parsed = parseKyowontourScheduleMealRow(row)
      if (parsed) meals.push(parsed)
    }
  }

  const meeting = asRecord(d?.meeting)
  const meetingBits = [
    String(meeting?.departportName ?? meeting?.nameKo ?? '').trim(),
    String(meeting?.terminal ?? '').trim(),
  ].filter(Boolean)
  const dayCount = rows.length > 0 ? Math.max(...rows.map((r) => r.day)) : 0

  return {
    rows,
    meals,
    meetingText: meetingBits.length > 0 ? meetingBits.join(' ') : null,
    dayCount,
  }
}

export type KyowontourCoreTabParsed = {
  includedItems: string[]
  excludedItems: string[]
  corePoints: Array<{ title: string; body: string }>
  mustKnowNotes: Array<{ title: string; body: string }>
  singleRoomSurchargeRaw: string | null
  singleRoomSurchargeAmount: number | null
  guideTipRaw: string | null
  mandatoryLocalFee: number | null
  mandatoryCurrency: string | null
  visaNoteRaw: string | null
}

export type KyowontourReservationTabParsed = {
  beforeTourInfo: string | null
  etcInfo: string | null
  safetyInfo: string | null
}

function stripKyowontourHtmlEntities(text: string): string {
  return text
    .replace(/&middot;/gi, '·')
    .replace(/&times;/gi, '×')
    .replace(/&rarr;/gi, '→')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function formatKyowontourTagBullet(row: unknown): string {
  const o = asRecord(row)
  if (!o) return ''
  const tag = stripKyowontourHtmlEntities(String(o.tag ?? '').trim())
  const remark = stripKyowontourHtmlEntities(String(o.remark ?? '').trim())
  if (!tag) return remark
  if (!remark) return tag
  return `${tag} ${remark}`.trim()
}

function parseKyowontourTagBulletArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw.map(formatKyowontourTagBullet).filter((s) => s.length > 1)
}

function parseKyowontourGuideFeeFromRemark(remark: string): { amount: number | null; currency: string | null } {
  const t = remark.trim()
  const m = t.match(/([A-Z]{3})\s*(\d+)|(\d+)\s*([A-Z]{3})/i)
  if (!m) return { amount: null, currency: null }
  return {
    currency: (m[1] ?? m[4] ?? 'USD').toUpperCase(),
    amount: Number(m[2] ?? m[3]),
  }
}

function parseKyowontourSingleRoomKrw(remark: string): number | null {
  const t = remark.trim()
  const man = t.match(/([0-9]+)\s*만\s*원/)
  if (man) {
    const n = Number(man[1])
    return Number.isFinite(n) && n > 0 ? n * 10_000 : null
  }
  const won = t.match(/([0-9]{1,3}(?:,[0-9]{3})+|[0-9]{4,})\s*원/)
  if (won) {
    const n = Number(won[1]!.replace(/,/g, ''))
    return Number.isFinite(n) && n > 0 ? n : null
  }
  return null
}

function applyKyowontourExcludedFeeHints(
  parsed: KyowontourCoreTabParsed,
  excludedRows: unknown,
): void {
  if (!Array.isArray(excludedRows)) return
  for (const row of excludedRows) {
    const o = asRecord(row)
    if (!o) continue
    const tag = String(o.tag ?? '').trim()
    const remark = String(o.remark ?? '').trim()
    const bullet = formatKyowontourTagBullet(row)
    if (!bullet) continue
    if (!parsed.singleRoomSurchargeRaw && /(싱글|1인\s*객실|객실\s*1인|싱글룸)/i.test(tag + remark)) {
      parsed.singleRoomSurchargeRaw = bullet
      parsed.singleRoomSurchargeAmount = parseKyowontourSingleRoomKrw(remark)
    }
    if (!parsed.guideTipRaw && /(가이드|기사)/i.test(tag) && /(경비|팁)/i.test(tag + remark)) {
      parsed.guideTipRaw = bullet
      const fee = parseKyowontourGuideFeeFromRemark(remark)
      parsed.mandatoryLocalFee = fee.amount
      parsed.mandatoryCurrency = fee.currency
    }
    if (!parsed.visaNoteRaw && /비자/i.test(tag + remark)) {
      parsed.visaNoteRaw = bullet
    }
  }
}

export function parseKyowontourCoreTabDetail(detail: unknown): KyowontourCoreTabParsed {
  const d = asRecord(detail)
  const out: KyowontourCoreTabParsed = {
    includedItems: [],
    excludedItems: [],
    corePoints: [],
    mustKnowNotes: [],
    singleRoomSurchargeRaw: null,
    singleRoomSurchargeAmount: null,
    guideTipRaw: null,
    mandatoryLocalFee: null,
    mandatoryCurrency: null,
    visaNoteRaw: null,
  }
  if (!d) return out

  const evtType = d.evtType
  if (Array.isArray(evtType)) {
    for (const row of evtType) {
      const r = asRecord(row)
      if (!r) continue
      const typeName = String(r.typeName ?? '')
      const type = Number(r.type)
      if (type === 2 || /포함\s*\/\s*불포함/.test(typeName)) {
        out.includedItems = parseKyowontourTagBulletArray(r.etc3)
        out.excludedItems = parseKyowontourTagBulletArray(r.etc4)
        applyKyowontourExcludedFeeHints(out, r.etc4)
      }
      if (type === 5 || /예약안내/.test(typeName)) {
        const body = String(r.etc3 ?? '').trim()
        if (body) {
          out.mustKnowNotes.push({
            title: '예약안내',
            body: stripKyowontourHtmlEntities(body).slice(0, 800),
          })
        }
        const etc5 = String(r.etc5 ?? '').trim()
        if (etc5) {
          out.mustKnowNotes.push({
            title: '안내',
            body: stripKyowontourHtmlEntities(etc5).slice(0, 400),
          })
        }
      }
    }
  }

  const points = d.point
  if (Array.isArray(points)) {
    for (const p of points) {
      const pr = asRecord(p)
      const title = String(pr?.nameKo ?? pr?.typeName ?? '').trim()
      const body = String(pr?.descriptionShort ?? pr?.description ?? '').trim()
      if (!title) continue
      out.corePoints.push({
        title,
        body: stripKyowontourHtmlEntities(body || title).slice(0, 500),
      })
    }
  }

  return out
}

export function parseKyowontourReservationTabDetail(detail: unknown): KyowontourReservationTabParsed {
  const d = asRecord(detail)
  const r = asRecord(d?.reservation)
  const clean = (v: unknown) => {
    const t = String(v ?? '').trim()
    return t ? stripKyowontourHtmlEntities(t) : null
  }
  return {
    beforeTourInfo: clean(r?.beforeTourInfo),
    etcInfo: clean(r?.etcInfo),
    safetyInfo: clean(r?.safetyInfo),
  }
}

export function parseKyowontourOptShopTabDetail(detail: unknown): KyowontourOptShopTabParsed {
  const d = asRecord(detail)
  const optionalTours: KyowontourOptionalTourFromBody[] = []
  const etcTour = d?.etcTour
  if (Array.isArray(etcTour)) {
    for (const row of etcTour) {
      const parsed = parseKyowontourEtcTourRow(row)
      if (parsed) optionalTours.push(parsed)
    }
  }
  const shoppingItems = extractKyowontourShoppingListFromEvtType(d?.evtType)
  return {
    optionalTours,
    shoppingItems,
    shoppingVisitCount: shoppingItems.length,
  }
}

export function buildKyowontourDetailPageUrl(
  fields: Pick<KyowontourTourEventHiddenFields, 'tourCode' | 'menuCode'>,
  base = 'https://www.kyowontour.com',
): string {
  const root = base.replace(/\/$/, '')
  return `${root}/goods/goodsEventDetail?tourCode=${encodeURIComponent(fields.tourCode)}&menuCode=${encodeURIComponent(fields.menuCode)}&brandId=3`
}

export function buildKyowontourTourEventTabPayload(
  fields: KyowontourTourEventHiddenFields,
  tabIds: string[],
): string {
  return JSON.stringify({ ...fields, tabId: tabIds })
}

export type FetchKyowontourTabOptions = {
  baseUrl?: string
  refererUrl?: string
  timeoutMs?: number
  headers?: Record<string, string>
}

export async function fetchKyowontourTourEventTabData(
  fields: KyowontourTourEventHiddenFields,
  tabIds: string[],
  opts?: FetchKyowontourTabOptions,
): Promise<{ status: number; data: Record<string, unknown> | null; raw: unknown }> {
  const base = (opts?.baseUrl ?? 'https://www.kyowontour.com').replace(/\/$/, '')
  const referer = opts?.refererUrl ?? buildKyowontourDetailPageUrl(fields, base)
  const res = await fetch(`${base}/goods/tourEventTabData`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'X-Requested-With': 'XMLHttpRequest',
      Accept: 'application/json',
      Referer: referer,
      'User-Agent': 'Mozilla/5.0',
      ...opts?.headers,
    },
    body: new URLSearchParams({ data: buildKyowontourTourEventTabPayload(fields, tabIds) }).toString(),
    signal: AbortSignal.timeout(opts?.timeoutMs ?? 25_000),
  })
  const raw = await res.json().catch(() => null)
  const root = asRecord(raw)
  const data =
    root?.data && typeof root.data === 'object' && !Array.isArray(root.data)
      ? (root.data as Record<string, unknown>)
      : root
  return { status: res.status, data, raw }
}

export function extractTabDetailFromTabData(data: Record<string, unknown> | null, tabId: string): unknown {
  if (!data) return null
  const block = asRecord(data[tabId])
  return block?.detail ?? null
}

export async function fetchKyowontourOptShopTab(
  fields: KyowontourTourEventHiddenFields,
  opts?: FetchKyowontourTabOptions,
): Promise<{ status: number; parsed: KyowontourOptShopTabParsed; detail: unknown }> {
  const { status, data } = await fetchKyowontourTourEventTabData(fields, [KYOWONTOUR_TAB_OPT_SHOP_ID], opts)
  const detail = extractTabDetailFromTabData(data, KYOWONTOUR_TAB_OPT_SHOP_ID)
  return { status, parsed: parseKyowontourOptShopTabDetail(detail), detail }
}

export async function fetchKyowontourScheduleTab(
  fields: KyowontourTourEventHiddenFields,
  opts?: FetchKyowontourTabOptions,
): Promise<{ status: number; parsed: KyowontourScheduleTabParsed; detail: unknown }> {
  const { status, data } = await fetchKyowontourTourEventTabData(fields, [KYOWONTOUR_TAB_SCHEDULE_ID], opts)
  const detail = extractTabDetailFromTabData(data, KYOWONTOUR_TAB_SCHEDULE_ID)
  return { status, parsed: parseKyowontourScheduleTabDetail(detail), detail }
}
