import { parsePrepChecklistJson } from '@/lib/overseas-training-program-query'
import { extractWindsorPrepSectionsFromText } from '@/lib/overseas-training-windsor-sections'

/** DB에 저장 시 유럽 공통 안내문 사용 표시 */
export const EUROPE_PREP_DEFAULT_MARKER = JSON.stringify({ _useDefaultEurope: true })

export function usesEuropePrepDefault(prepChecklistJson: string | null | undefined): boolean {
  const raw = prepChecklistJson?.trim()
  if (!raw) return true
  try {
    const o = JSON.parse(raw) as Record<string, unknown>
    return o._useDefaultEurope === true
  } catch {
    return false
  }
}

/**
 * 윈저 유럽 상품 하단 공통 안내문 (요약·운영 SSOT).
 * 전체 문구는 관리자 JSON 또는 재붙여넣기로 교체 가능.
 */
const EUROPE_PREP_BOILERPLATE_TAIL = `
해외여행 안전정보
외교부에서는 [여행경보제도]를 운영하고 있으며, 당사는 고객님의 안전한 해외여행을 위하여 이에 대한 안내를 드리고 있습니다.
여행경보단계는 여행유의/자제/제한/금지 4단계로 구분되며 외교부(www.0404.go.kr)에서 [상시조정]하고 있으므로 반드시 출국 전에 여행목적지(국가 및 지역)의 안전정보를 확인하시고 [외교부의 권고]를 따라주시기 바랍니다.
출국 전 해외여행등록제 [동행]에 가입하시면 안전정보를 수시로 확인하실 수 있습니다.

예약시 유의사항
♠ 최소출발인원
본 상품은 최소 행사 인원이 10명 이상이며, 출발일 별로 최소인원 미 충족시 상품가격 변동이 되오니 참고바랍니다.
♠ 항공 관련 사항
왕복항공권은 이코노미클래스, 할인항공, 단체항공기준 입니다. 항공스케줄 개인 변경 불가(단 추가비용·좌석 가능 시 예외).
♠ 수하물 안내
이코노미석 기준 위탁 23kg 1개, 기내 휴대 8kg 1개(항공사 규정 확인).
♠ 환율
1유로=1350원 고정환율 적용 예시 — 변동 시 담당자 확인.
♠ 호텔
유럽 지역 특성상 소규모 호텔, 엘리베이터·에어컨·난방 미비 가능. 시내 호텔 우선, 교외 숙박 있을 수 있음.

취소수수료
국외여행 특별약관 적용. 계약금(선납금)은 항공·현지 선지급 비용으로 환불 제한될 수 있음.
여행개시 30일전 취소 전액환불 / 20일전 10% / 19~10일 15% / 9일전 20% / 8~1일 70% / 당일 80% (항공·기차 발권 후 별도 규정).

여권/비자
여권 만료일 출발일 기준 6개월 이상. 사증면 3장 이상 권장. 유럽 단기여행 90일 이내 비자 면제(한국 국적 기준).
병역미필 국외여행허가증 준비. 여권 훼손 시 재발급.

여행자보험
에이스손해보험 기본 가입(연수·데이투어 제외 상품은 담당 확인). 만 14세 6개월~69세 6개월 1억원 기준 등 연령별 상이.
분실 시 현지 경찰서 도난 신고(분실 LOST 아닌 Stolen). 의료비 영수증·진단서 첨부.

여행준비물
여권·여권사본·여권용 사진, 항공권 사본, 유로 현금(인당 200~300유로 권장)·카드, 멀티어댑터(220V), 편한 신발, 방한·우비, 상비약, 개인 복용약.

기타사항
소매치기 주의 — 여권·지갑 앞주머니 휴대. 호텔 금연룸 준수. 버스 안전벨트 필수.
유럽 시차 한국 대비 약 -7~-8시간(썸머타임·국가별 상이).
`.trim()

let cachedDefaultSections: Array<{ title: string; items: string[] }> | null = null

export function getDefaultEuropeTrainingPrepSections(): Array<{ title: string; items: string[] }> {
  if (cachedDefaultSections) return cachedDefaultSections
  cachedDefaultSections = extractWindsorPrepSectionsFromText(EUROPE_PREP_BOILERPLATE_TAIL)
  return cachedDefaultSections
}

export function resolveTrainingPrepForDisplay(
  prepChecklistJson: string | null | undefined
): Array<{ title: string; items: string[] }> {
  if (usesEuropePrepDefault(prepChecklistJson)) {
    return getDefaultEuropeTrainingPrepSections()
  }
  const parsed = parsePrepChecklistJson(prepChecklistJson)
  if (parsed.length > 0) return parsed
  return getDefaultEuropeTrainingPrepSections()
}

export function prepChecklistForSave(useEuropeDefault: boolean, customJson: string): string | null {
  if (useEuropeDefault) return EUROPE_PREP_DEFAULT_MARKER
  const trimmed = customJson.trim()
  if (!trimmed || trimmed === '[]') return null
  return trimmed
}
