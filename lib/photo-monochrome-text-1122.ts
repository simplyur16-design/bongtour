/**
 * 내려받기 전에 글로 흑백을 거른다(채도 검사와 별도).
 * Pexels·Unsplash 페이지 주소 slug, 대체 문구·제목·설명·태그, 사진 풀 파일 이름·원본 주소에 흑백 표시가 있으면 탈락.
 * 예: cmtczq 14일차 "iconic-christ-the-redeemer-statue-in-black-and-white-32097914" — 채도 판정(15.3>10)을 빠져나갔던 사진.
 * REGRESSION-FREEZE[photo-monochrome-text-1122]: 흑백 표시 글 후보 사전 탈락 — manifest
 */

const PHRASE_RE = /(?:^| )(?:black and white|black n white|monochrome|monochromatic|grayscale|greyscale|sepia|noir et blanc|b and w)(?: |$)/

function tokens(raw: string): string {
  let s = String(raw ?? '')
  try {
    s = decodeURIComponent(s)
  } catch {
    /* 깨진 인코딩은 그대로 */
  }
  return ` ${s.toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim()} `
}

/** 한 덩어리 글에 흑백 표시가 있는지 */
export function textHasMonochromeMarker(raw: string | null | undefined): boolean {
  const t = tokens(String(raw ?? ''))
  if (t.trim().length === 0) return false
  if (PHRASE_RE.test(t.trim())) return true
  // b-w / b&w / bw 는 낱말 하나로 있을 때만(BMW·bwv 등 오탐 방지)
  return / bw /.test(t) || / b and w /.test(t) || / b w /.test(t)
}

export type MonochromeTextCandidate = {
  url?: string | null
  originalLink?: string | null
  pageUrl?: string | null
  altText?: string | null
  title?: string | null
  description?: string | null
  tags?: readonly string[] | null
}

/** 후보 글(주소 slug·문구·태그·풀 파일 이름) 어디든 흑백 표시가 있으면 true */
export function candidateSaysMonochrome(c: MonochromeTextCandidate): boolean {
  const parts = [c.url, c.originalLink, c.pageUrl, c.altText, c.title, c.description, ...(c.tags ?? [])]
  return parts.some((p) => textHasMonochromeMarker(p))
}
