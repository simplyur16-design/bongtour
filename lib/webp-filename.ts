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

/** 한글(자모+음절), 영숫자, _, -, . 허용. 파일명용 */
function sanitize(s: string): string {
  const t = String(s ?? '').trim().replace(/\s+/g, '_')
  return t.replace(/[^\w\-_.\uac00-\ud7a3\u1100-\u11ff]/g, '').slice(0, 80) || ''
}
