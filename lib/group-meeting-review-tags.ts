const norm = (s: string) => s.replace(/\s+/g, '').toLowerCase()

const PURPOSE_BY_REVIEW_TYPE: Record<string, string> = {
  executive_group: '경영·친목',
  hiking_group: '트레킹·자연',
  couple_group: '휴양·동반',
  business_group: '연수·시찰',
  alumni_group: '동문·친목',
  senior_group: '시니어·휴양',
  association: '협회·워크숍',
  small_group: '소규모·친목',
  group_corporate: '회사·단체',
  group_friends: '친구 모임',
  group_small: '소규모 모임',
  parents: '부모님 동반',
  hiking: '등산·트레킹',
}

/** 메타줄 2번째: tags에서 목적류 우선, 없으면 review_type 기반 */
export function metaPurposeLabel(tags: string[], reviewType: string): string {
  const used = new Set<string>()
  const hit = pickByHints(tags, PURPOSE_HINTS, used)
  if (hit) return hit
  return PURPOSE_BY_REVIEW_TYPE[reviewType] ?? '모임여행'
}

/** 1순위: 모임 유형 계열 */
const MEETING_HINTS: readonly string[] = [
  '최고경영자과정모임',
  '최고경영자과정',
  '최고경영자모임',
  '대학원동문모임',
  '대학원모임',
  '상인회',
  '협회모임',
  '협회',
  '부부동반모임',
  '부부동반',
  '시니어모임',
  '시니어',
  '동문회',
  '원우회',
  '산악회',
  '사업자모임',
  '사업자',
  '소규모단체',
  '소규모모임',
]

/** 2순위: 목적·성격 */
const PURPOSE_HINTS: readonly string[] = [
  '친목여행',
  '워크숍',
  '연수여행',
  '단체연수',
  '벤치마킹',
  '힐링여행',
  '힐링투어',
  '효도여행',
  '휴양여행',
  '문화탐방',
  '문화체험',
  '답사여행',
  '교류여행',
  '미식여행',
  '비즈니스연수',
  '비즈니스투어',
  '골프여행',
  '골프휴양',
  '기차여행',
  '화합여행',
  '우정여행',
  '시찰여행',
  '시장시찰',
  '경제시찰',
  '경제탐방',
  '온천여행',
  '온천휴양',
  '예술여행',
  '와이너리투어',
  '한라산트레킹',
  '자연경관',
  '품격여행',
  '일정관리',
  'VIP의전',
]

/** 3순위: 인원·지역·운영 포인트 */
const OPS_HINTS: readonly string[] = [
  '10명여행',
  '12명여행',
  '15명여행',
  '20명여행',
  '25명여행',
  '30명여행',
  '40명여행',
  '식사만족',
  '일정안정',
  '일정관리',
  '자유시간',
  '숙소만족',
  '이동편안',
  '동선안정',
  '일본',
  '베트남',
  '대만',
  '태국',
  '스위스',
  '이탈리아',
  '한국',
  '뉴질랜드',
  '싱가포르',
  '말레이시아',
  '아이슬란드',
]

function pickByHints(tags: string[], hints: readonly string[], used: Set<string>): string | null {
  const ntags = tags.map((t) => ({ raw: t, n: norm(t) }))
  for (const hint of hints) {
    const hn = norm(hint)
    for (const { raw, n } of ntags) {
      if (used.has(raw)) continue
      if (n.includes(hn) || hn.includes(n)) {
        used.add(raw)
        return raw.trim()
      }
    }
  }
  return null
}

function meetingFromCustomerType(customerType: string | null): string | null {
  if (!customerType?.trim()) return null
  const c = customerType.trim()
  for (const hint of MEETING_HINTS) {
    if (norm(c).includes(norm(hint)) || norm(hint).includes(norm(c))) return c
  }
  return c
}

/**
 * 최대 3개: 모임 1 + 목적 1 + 운영/지역 1. CSV tags 우선, customer_type과 중복 태그는 제거.
 */
export function selectGroupMeetingDisplayTags(params: {
  tags: string[]
  customer_type: string | null
  destination_country: string | null
}): string[] {
  const used = new Set<string>()
  const out: string[] = []
  const ct = meetingFromCustomerType(params.customer_type)
  const ctNorm = ct ? norm(ct) : ''

  const meeting =
    pickByHints(params.tags, MEETING_HINTS, used) ||
    (ct && !params.tags.some((t) => norm(t) === ctNorm) ? ct : null) ||
    pickFirstUnusedGeneric(params.tags, used, ctNorm)

  if (meeting) out.push(meeting)

  const purpose = pickByHints(params.tags, PURPOSE_HINTS, used)
  if (purpose) out.push(purpose)

  let ops = pickByHints(params.tags, OPS_HINTS, used)
  if (!ops && params.destination_country?.trim()) {
    const co = params.destination_country.trim()
    const hit = params.tags.find((t) => norm(t) === norm(co) && !used.has(t))
    if (hit) {
      used.add(hit)
      ops = hit.trim()
    }
  }
  if (!ops) ops = pickFirstUnusedGeneric(params.tags, used, ctNorm)
  if (ops && !out.some((x) => norm(x) === norm(ops!))) out.push(ops!)

  return out.slice(0, 3)
}

function pickFirstUnusedGeneric(tags: string[], used: Set<string>, ctNorm: string): string | null {
  for (const t of tags) {
    const tr = t.trim()
    if (!tr || used.has(tr)) continue
    if (ctNorm && norm(tr) === ctNorm) continue
    used.add(tr)
    return tr
  }
  return null
}
