/**
 * 답변 초안. 가격·출발일·잔여석 문장은 후보의 저장값만 넣는다.
 * 문장 다듬기 함수가 그 값을 바꾸면 초안을 되돌린다. 발송하지 않는다.
 * REGRESSION-FREEZE[talktalk-draft-no-send-no-price-invent]: 발송·가격 생성 금지 — manifest
 */
import type { TalktalkCompareCandidate } from '@/lib/talktalk-draft/compare-candidates'
import { selectDraftFaq, type TalktalkDraftFaqItem } from '@/lib/talktalk-draft/faq'

const WON_RE = /\d{1,3}(?:,\d{3})+원|\d+원/g

export type TalktalkDraftInput = {
  inquiryText: string
  placeLabel: string | null
  weekStartYmd: string | null
  weekFellBack: boolean
  durationNote: boolean
  candidates: readonly TalktalkCompareCandidate[]
}

export function wonAmountsIn(text: string): string[] {
  return text.match(WON_RE) ?? []
}

export function draftKeepsStoredFacts(
  before: string,
  after: string,
  candidates: readonly Pick<TalktalkCompareCandidate, 'priceLabel' | 'departureDate' | 'seatsLabel'>[],
): boolean {
  for (const c of candidates) {
    if (!after.includes(`성인 요금: ${c.priceLabel}`)) return false
    if (!after.includes(`출발일: ${c.departureDate}`)) return false
    if (!after.includes(`잔여석: ${c.seatsLabel}`)) return false
  }
  const allowed = new Set(wonAmountsIn(before))
  for (const won of wonAmountsIn(after)) {
    if (!allowed.has(won)) return false
  }
  return true
}

export type DraftPolisher = (text: string) => string

/** 다듬기 결과가 저장 가격·날짜·좌석을 바꾸면 원문을 유지한다. */
export function finalizeTalktalkDraft(
  text: string,
  candidates: readonly Pick<TalktalkCompareCandidate, 'priceLabel' | 'departureDate' | 'seatsLabel'>[],
  polish?: DraftPolisher,
): string {
  if (!polish) return text
  const next = polish(text)
  if (!draftKeepsStoredFacts(text, next, candidates)) return text
  return next
}

function candidateBlock(c: TalktalkCompareCandidate, index: number): string {
  return [
    `${index + 1}. ${c.title} (${c.supplierLabel})`,
    `- 출발일: ${c.departureDate}`,
    `- 성인 요금: ${c.priceLabel}`,
    `- 잔여석: ${c.seatsLabel}`,
    `- 상품: ${c.href}`,
  ].join('\n')
}

function faqBlock(items: readonly TalktalkDraftFaqItem[]): string {
  if (items.length === 0) {
    return '관련해 저장해 둔 약관·안내 문장이 없어, 그 부분은 확인 후 안내드리겠습니다.'
  }
  return items.map((item) => `- ${item.question}\n  ${item.answer}`).join('\n')
}

export function buildTalktalkDraft(input: TalktalkDraftInput, polish?: DraftPolisher): {
  text: string
  faq: TalktalkDraftFaqItem[]
} {
  const faq = selectDraftFaq(input.inquiryText)
  const lines = [
    '안녕하세요. 남겨주신 내용을 기준으로 등록된 상품만 비교해 보았습니다.',
    input.placeLabel ? `목적지: ${input.placeLabel}` : '목적지를 메가메뉴 도시로 특정하지 못했습니다.',
    input.weekStartYmd
      ? `비교 주간 시작일: ${input.weekStartYmd}${input.weekFellBack ? ' (요청하신 주간에 예약가능 출발이 없어 가장 가까운 주를 사용)' : ''}`
      : '같은 출발 주간에 예약가능 출발이 없습니다.',
    input.durationNote ? '박·일 정보가 없어 일정 길이는 맞추지 않았습니다.' : '',
    '',
    input.candidates.length > 0
      ? input.candidates.map(candidateBlock).join('\n\n')
      : '조건에 맞는 등록 상품 후보가 없습니다. 요금은 적지 않았습니다.',
    '',
    '안내',
    faqBlock(faq),
    '',
    '요금·출발일·잔여석은 저장된 값만 적었고, 없는 항목은 문의입니다. 이 문안은 발송하지 않았습니다.',
  ].filter((line) => line !== '')
  const text = finalizeTalktalkDraft(lines.join('\n'), input.candidates, polish)
  return { text, faq }
}
