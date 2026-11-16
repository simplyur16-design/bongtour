/** 붙여 넣은 문의에서 목적지·출발일·예산·인원·박일을 읽기만 한다. 없는 값은 null. */

const YMD = /(\d{4})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})/
const NIGHTS = /(\d+)\s*박\s*(\d+)\s*일/
const PARTY = /(?:성인|인원)\s*(\d+)\s*명|(\d+)\s*명/
const BUDGET_MAN = /(\d+(?:\.\d+)?)\s*만\s*원?/
const BUDGET_WON = /(\d{1,3}(?:,\d{3})+|\d{4,})\s*원/

export type TalktalkInquiryCategory =
  | 'package'
  | 'fit'
  | 'air'
  | 'hotel'
  | 'training'
  | 'institution'
  | 'private'
  | 'bus'
  | 'common'
  | 'esim'

export type ParsedTalktalkInquiry = {
  destination: string | null
  departureDate: string | null
  budgetKrw: number | null
  partySize: number | null
  duration: string | null
  category: TalktalkInquiryCategory
}

/** 문의 문장에서 FAQ 카테고리만 고른다. 가격은 읽지 않는다. */
export function inferTalktalkFaqCategory(raw: string): TalktalkInquiryCategory {
  const text = String(raw ?? '')
  if (/e\s*sim|이심|qr|로밍|apn/i.test(text)) return 'esim'
  if (/전세\s*버스|전세버스|버스\s*견적/.test(text)) return 'bus'
  if (/기관\s*섭외|기관\s*방문/.test(text)) return 'institution'
  if (/국외\s*연수|공무\s*연수|연수/.test(text)) return 'training'
  if (/우리끼리|소규모|단독\s*일정/.test(text)) return 'private'
  if (/항공권만|항공만|항공권\s*예매|발권/.test(text)) return 'air'
  if (/호텔만/.test(text)) return 'hotel'
  if (/자유여행|에어텔|항공\s*\+\s*호텔|항공과\s*호텔/.test(text)) return 'fit'
  if (/패키지|해외여행\s*상품/.test(text)) return 'package'
  return 'common'
}

function pad(n: string): string {
  return n.padStart(2, '0')
}

export function parseTalktalkInquiryText(raw: string): ParsedTalktalkInquiry {
  const text = String(raw ?? '')
  const date = text.match(YMD)
  const nights = text.match(NIGHTS)
  const party = text.match(PARTY)
  const man = text.match(BUDGET_MAN)
  const won = text.match(BUDGET_WON)
  const partyRaw = party?.[1] ?? party?.[2]
  let budgetKrw: number | null = null
  if (man) {
    const n = Number(man[1])
    budgetKrw = Number.isFinite(n) ? Math.round(n * 10000) : null
  } else if (won) {
    const n = Number(won[1].replace(/,/g, ''))
    budgetKrw = Number.isFinite(n) ? n : null
  }
  return {
    destination: null,
    departureDate: date ? `${date[1]}-${pad(date[2])}-${pad(date[3])}` : null,
    budgetKrw,
    partySize: partyRaw ? Number(partyRaw) : null,
    duration: nights ? `${nights[1]}박 ${nights[2]}일` : null,
    category: inferTalktalkFaqCategory(text),
  }
}
