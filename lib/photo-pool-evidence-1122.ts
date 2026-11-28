/**
 * 사진 풀 후보의 '무엇을 찍은 사진인가'는 풀 이름표(attractionName)가 아니라 원본 페이지 주소가 말해 준다.
 * 이름표는 검색어 그대로 붙거나(보충 저장) 도시·'<목적지>_<일차>(_slot2)' 같은 공용 이름이라,
 * 이름표를 믿으면 다른 곳 사진이 그 명소로 통과하고(호놀룰루 이올라니 궁전 ← 라자스탄 님라나 요새),
 * 공용 이름 파일이 여러 일차에 다시 쓰여 같은 상품 안에서 겹친다.
 * REGRESSION-FREEZE[pool-evidence-not-label-1122]: 풀 후보 명소 일치는 원본 주소 slug 로만(이름표 신뢰 금지) — manifest
 */

function words(s: string): string {
  let t = s
  try {
    t = decodeURIComponent(t)
  } catch {
    /* 그대로 */
  }
  return t.replace(/[_\-+]+/g, ' ').replace(/\s+/g, ' ').trim()
}

/** 원본 페이지 주소에서 사진 설명 낱말(slug)을 꺼낸다. 설명이 없는 주소(작가 프로필·빈 값)는 ''. */
export function sourcePageEvidenceText(sourceUrl: string | null | undefined): string {
  const raw = String(sourceUrl ?? '').trim()
  if (!raw) return ''
  let u: URL
  try {
    u = new URL(raw)
  } catch {
    return ''
  }
  const host = u.hostname.replace(/^www\./, '')
  const path = u.pathname
  if (host === 'pexels.com') {
    const m = /\/photo\/(.+?)-\d+\/?$/.exec(path)
    return m ? words(m[1]!) : ''
  }
  if (host === 'unsplash.com') {
    // /photos/<설명>-<11자 id>. id 만 있는 주소·@작가 주소는 설명 없음
    const m = /\/photos\/(.+)-[A-Za-z0-9_-]{11}\/?$/.exec(path)
    return m ? words(m[1]!) : ''
  }
  if (/(^|\.)wikimedia\.org$|(^|\.)wikipedia\.org$/.test(host)) {
    const m = /\/wiki\/File:(.+?)(\.[a-z0-9]{3,4})?$/i.exec(path)
    return m ? words(m[1]!) : ''
  }
  // REGRESSION-FREEZE[photo-wrong-path-1128]: Pixabay 페이지 slug도 원 출처 설명이다. id-1234 만 있는 주소는 설명 없음 — manifest
  if (host === 'pixabay.com' || /(^|\.)pixabay\.com$/.test(host)) {
    const pop = path.split('/').filter(Boolean).pop() ?? ''
    if (!pop || /^id-\d+$/i.test(pop)) return ''
    return words(pop.replace(/-\d+$/, ''))
  }
  if (host === 'openverse.org' || host.endsWith('.openverse.org')) {
    const pop = path.split('/').filter(Boolean).pop() ?? ''
    return pop ? words(pop.replace(/-\d+$/, '')) : ''
  }
  return ''
}

export type PoolEvidenceRow = {
  attractionName?: string | null
  source?: string | null
  sourceUrl?: string | null
}

/**
 * 관문에 넘길 풀 후보 설명. 원본 주소 slug 가 없으면 null(이 풀 행은 확인할 수 없어 후보에서 뺀다 → 새 검색으로 간다).
 * 생성 이미지는 그 명소 문장으로 만든 것이라 이름표를 설명으로 쓴다.
 */
export function poolCandidateEvidence(row: PoolEvidenceRow): string | null {
  if (/gemini|generated|ai\s*생성|\bai\b/i.test(String(row.source ?? ''))) {
    const label = String(row.attractionName ?? '').trim()
    return label || null
  }
  const slug = sourcePageEvidenceText(row.sourceUrl)
  return slug || null
}
