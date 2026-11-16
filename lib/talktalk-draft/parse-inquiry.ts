/** 붙여 넣은 문의에서 목적지·출발일·예산·인원·박일을 읽기만 한다. 없는 값은 null. */

const YMD = /(\d{4})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})/
const NIGHTS = /(\d+)\s*박\s*(\d+)\s*일/
const PARTY = /(?:성인|인원)\s*(\d+)\s*명|(\d+)\s*명/
const BUDGET_MAN = /(\d+(?:\.\d+)?)\s*만\s*원?/
const BUDGET_WON = /(\d{1,3}(?:,\d{3})+|\d{4,})\s*원/

export type ParsedTalktalkInquiry = {
  destination: string | null
  departureDate: string | null
  budgetKrw: number | null
  partySize: number | null
  duration: string | null
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
  }
}
