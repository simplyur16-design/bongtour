/**
 * 재고 사진(Pexels → Unsplash)이 없을 때 일차 칸 AI 생성 문장 (사장님 11/01).
 * 그날 키워드(없으면 그날 동선의 첫 장소)로만 만든다 — 장소가 없으면 null('사진 필요'로 비움).
 * 생성 사진은 'AI 생성 이미지' 표시(register-day-photo-ai-label)가 붙는다.
 */
const NOISE_SEG_RE = /공항|airport|호텔|hotel|리조트|resort|숙박|체크\s*(?:인|아웃)|조식|중식|석식|식사|기내|이동|출발|도착|귀국|미팅|가이드|자유\s*(?:일정|시간)|쇼핑|면세|휴식/i

export function firstRoutePlaceForAiPhoto(routeText: string | null | undefined): string | null {
  const segs = String(routeText ?? '')
    .split(/\s*(?:\s-\s|→|->|>|·|,|\/|\s–\s)\s*/u)
    .map((x) => x.replace(/\(.*?\)|\[.*?\]/g, '').trim())
    .filter(Boolean)
  for (const s of segs) {
    if (s.length < 2 || s.length > 40) continue
    if (NOISE_SEG_RE.test(s)) continue
    return s
  }
  return null
}

export function buildRegisterDayAiPhotoPrompt(input: {
  keyword?: string | null
  routeText?: string | null
  destination?: string | null
}): string | null {
  const kw = String(input.keyword ?? '').trim()
  const place = kw && !/^day\s*\d+$/i.test(kw) ? kw : firstRoutePlaceForAiPhoto(input.routeText)
  if (!place) return null
  const dest = String(input.destination ?? '').trim()
  const where = dest && !place.includes(dest) ? `${place}, ${dest}` : place
  return `Photorealistic travel photograph of ${where}. Wide landscape view of the real place in natural daylight, true colors, no person as the main subject, no text, no logo, no watermark`
}
