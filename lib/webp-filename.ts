/**
 * 네이밍 규칙: [도시명][명소명][출처].webp
 * 예: Osaka_OsakaCastle_Pexels.webp
 */

/** 원본 파일명에서 출처 추론 (예: iStock-1359262755-xxx.png → iStock). 사용자 입력이 없을 때 사용 */
const SOURCE_PATTERNS: { pattern: RegExp; label: string }[] = [
  { pattern: /^iStock[-_\d]/i, label: 'iStock' },
  { pattern: /^istock/i, label: 'iStock' },
  { pattern: /^getty/i, label: 'Getty' },
  { pattern: /^shutterstock/i, label: 'Shutterstock' },
  { pattern: /^pexels/i, label: 'Pexels' },
  { pattern: /^unsplash/i, label: 'Unsplash' },
  { pattern: /^adobe[-_]?stock/i, label: 'AdobeStock' },
  { pattern: /^depositphotos/i, label: 'Depositphotos' },
  { pattern: /^alamy/i, label: 'Alamy' },
]

export function inferSourceFromFilename(filename: string): string {
  const name = String(filename ?? '').trim()
  if (!name) return ''
  const base = name.replace(/\.[^.]+$/, '') // 확장자 제거
  for (const { pattern, label } of SOURCE_PATTERNS) {
    if (pattern.test(base)) return label
  }
  return ''
}

export function buildWebpFilename(cityName: string, attractionName: string, source: string): string {
  const city = sanitize(cityName) || 'City'
  const attraction = sanitize(attractionName) || 'Landmark'
  const src = sanitize(source) || 'Upload'
  return `${city}_${attraction}_${src}.webp`
}

/** 사진풀·동일 네이밍: `도시_명소_출처` 에서 공개 캡션용으로 마지막 출처 세그먼트만 제거 */
const EXTRA_SOURCE_STEM_TOKENS = new Set(
  [
    'upload',
    'manual',
    'other',
    'photopool',
    'photo_owned',
    'pexels',
    'istock',
    'gemini',
    'gemini_manual',
    'gemini_auto',
    'destination-set',
    'city-asset',
    'attraction-asset',
  ].map((s) => s.toLowerCase())
)

/**
 * 확장자 없는 파일명 stem(예: Osaka_Castle_Pexels)에서,
 * `도시_명소_출처` 형태일 때만 마지막 `_` 구간이 출처로 판단되면 제거한 stem 반환.
 */
export function stripTrailingSourceTokenFromFilenameStem(stem: string): string {
  const t = String(stem ?? '').trim()
  if (!t) return t
  const parts = t.split('_').filter((p) => p.length > 0)
  if (parts.length < 3) return t
  const last = parts[parts.length - 1]!
  const lastLower = last.toLowerCase()
  if (EXTRA_SOURCE_STEM_TOKENS.has(lastLower)) {
    return parts.slice(0, -1).join('_')
  }
  const inferred = inferSourceFromFilename(`${last}.png`)
  if (inferred) {
    return parts.slice(0, -1).join('_')
  }
  return t
}

/**
 * 이미지 URL(또는 경로) basename에서 `도시_명소_출처` 패턴의 마지막 출처 토큰만 반환.
 * 전체 이름이 iStock-… 형태면 trailing 토큰이 없을 수 있음(호출부에서 inferSourceFromFilename으로 처리).
 */
export function trailingSourceTokenFromImageUrl(url: string | null | undefined): string | null {
  const raw = String(url ?? '').trim()
  if (!raw) return null
  const pathOnly = raw.split('?')[0] ?? raw
  const base = pathOnly.replace(/^.*[/\\]/, '').replace(/\.[a-z0-9]{2,5}$/i, '')
  if (!base) return null
  const parts = base.split('_').filter((p) => p.length > 0)
  if (parts.length < 2) return null
  const last = parts[parts.length - 1]!
  const lastLower = last.toLowerCase()
  if (EXTRA_SOURCE_STEM_TOKENS.has(lastLower)) return last
  if (inferSourceFromFilename(`${last}.png`)) return last
  return null
}

/** 한글(자모+음절), 영숫자, _, -, . 허용. 파일명용 */
function sanitize(s: string): string {
  const t = String(s ?? '').trim().replace(/\s+/g, '_')
  return t.replace(/[^\w\-_.\uac00-\ud7a3\u1100-\u11ff]/g, '').slice(0, 80) || ''
}
