/**
 * 공개 상세 — 불포함 카드에 1인실 추가비 등 구조화 필드를 합치되, 본문과 중복되지 않게 한다.
 * 1인실 항목은 항목명+금액 한 줄(줄바꿈 없음).
 *
 * 공급사 공통 원칙: 1인 객실 사용료는 **기본상품가·대표가·출발가(달력 성인1인) 축이 아니라**
 * `singleRoomSurcharge*` + 이 모듈이 만드는 불포함/추가비용 표시 축만 사용한다.
 * (모두투어 `register-modetour-price`, 하나투어 `register-hanatour-price` 등에서 가격 슬롯에 넣지 않음.)
 */

/** 등록 파싱·불포함 카드 공통: `1인실 객실 추가요금 200,000원` / 금액 없으면 (옵션) `1인실 객실 추가요금 별도` */
export function buildSingleRoomExcludedLine(
  displayText: string | null | undefined,
  amount: number | null | undefined,
  currency: string | null | undefined,
  options?: { useFallbackWhenEmpty?: boolean }
): string | null {
  const disp = displayText?.replace(/\s+/g, ' ').trim()
  if (disp && /1인실|싱글|독실|단독|객실|single/i.test(disp) && /\d/.test(disp) && disp.length <= 200) {
    return disp
  }
  const amt = amount != null && amount > 0 && Number.isFinite(amount) ? amount : null
  const cRaw = (currency ?? '').trim()
  const c = cRaw.toUpperCase()
  if (amt != null) {
    if (!cRaw || c === 'KRW') {
      return `1인실 객실 추가요금 ${amt.toLocaleString('ko-KR')}원`
    }
    /** 비원화: 환율·원화 변환 없이 숫자·통화 코드만 표시(본문 통화와 동일 코드 사용 전제). */
    return `1인실 객실 추가요금 ${amt.toLocaleString('en-US')} ${cRaw}`
  }
  const collapsed = displayText?.replace(/\s+/g, ' ').trim()
  if (collapsed) return collapsed
  return options?.useFallbackWhenEmpty ? '1인실 객실 추가요금 별도' : null
}

function compact(s: string): string {
  return s.replace(/\s+/g, ' ').trim().toLowerCase()
}

export function mergeExcludedWithSingleRoomSurcharge(
  excludedText: string | null | undefined,
  singleRoomSurchargeDisplayText: string | null | undefined,
  singleRoomSurchargeAmount: number | null | undefined,
  singleRoomSurchargeCurrency: string | null | undefined
): string {
  const base = excludedText?.trim() ?? ''
  const extra = buildSingleRoomExcludedLine(
    singleRoomSurchargeDisplayText,
    singleRoomSurchargeAmount,
    singleRoomSurchargeCurrency
  )
  if (!extra) return base
  if (!base) return extra
  if (compact(base).includes(compact(extra))) return base
  const amtStr = singleRoomSurchargeAmount != null ? String(singleRoomSurchargeAmount) : ''
  if (amtStr && base.includes(amtStr) && /1인실|싱글|독실|단독|객실/i.test(base)) return base
  return `${base}\n\n${extra}`
}
