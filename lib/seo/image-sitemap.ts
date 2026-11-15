/**
 * 이미지 사이트맵 XML 빌더 (순수 함수) — `app/sitemap-images.xml/route.ts`.
 * REGRESSION-FREEZE[seo-image-sitemap-valid-xml]: XML 1.0 금지 제어문자 제거·이미지 URL 절대 https 만·국외연수 정식 주소 — manifest
 *
 * 서치 콘솔 '가져올 수 없음' 대응: DB 문자열에 섞인 제어문자(\u0000-\u001F 일부)·상대/빈 이미지 주소가
 * XML 파서를 깨뜨리면 사이트맵 전체를 읽지 못한다. 한 줄이라도 잘못되면 전체가 실패하므로 여기서 거른다.
 */

export const IMAGE_SITEMAP_CONTENT_TYPE = 'application/xml; charset=utf-8'

export type ImageSitemapEntry = {
  /** 페이지 절대 URL */
  loc: string
  /** 이미지 URL (절대 또는 사이트 상대) */
  imageUrl: string
  caption?: string | null
  title?: string | null
}

/** XML 1.0 에서 허용되지 않는 문자(탭·개행·CR 제외 제어문자, U+FFFE/U+FFFF, 짝 없는 서로게이트) 제거 */
export function stripInvalidXmlChars(s: string): string {
  // eslint-disable-next-line no-control-regex
  return s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '')
}

export function escapeXml(s: string): string {
  return stripInvalidXmlChars(s).replace(/[&<>"']/g, (ch) => {
    switch (ch) {
      case '&':
        return '&amp;'
      case '<':
        return '&lt;'
      case '>':
        return '&gt;'
      case '"':
        return '&quot;'
      default:
        return '&apos;'
    }
  })
}

/** 이미지 주소 → 절대 http(s) URL. 공백 등은 퍼센트 인코딩. 쓸 수 없으면 null */
export function normalizeSitemapImageUrl(raw: string | null | undefined, origin: string): string | null {
  const t = stripInvalidXmlChars((raw ?? '').trim())
  if (!t) return null
  let abs: string
  if (/^https?:\/\//i.test(t)) abs = t
  else if (t.startsWith('//')) abs = `https:${t}`
  else if (t.startsWith('/')) abs = `${origin.replace(/\/$/, '')}${t}`
  else return null
  try {
    const u = new URL(abs)
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null
    return u.toString()
  } catch {
    return null
  }
}

export function buildImageSitemapXml(entries: readonly ImageSitemapEntry[], origin: string): string {
  const lines: string[] = []
  lines.push('<?xml version="1.0" encoding="UTF-8"?>')
  lines.push(
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">',
  )
  const seenLoc = new Set<string>()
  for (const e of entries) {
    const loc = (e.loc ?? '').trim()
    const img = normalizeSitemapImageUrl(e.imageUrl, origin)
    if (!loc || !img || seenLoc.has(loc)) continue
    seenLoc.add(loc)
    const caption = stripInvalidXmlChars((e.caption ?? '').trim())
    const title = stripInvalidXmlChars((e.title ?? '').trim())
    lines.push('  <url>')
    lines.push(`    <loc>${escapeXml(loc)}</loc>`)
    lines.push('    <image:image>')
    lines.push(`      <image:loc>${escapeXml(img)}</image:loc>`)
    if (caption) lines.push(`      <image:caption>${escapeXml(caption)}</image:caption>`)
    if (title) lines.push(`      <image:title>${escapeXml(title)}</image:title>`)
    lines.push('    </image:image>')
    lines.push('  </url>')
  }
  lines.push('</urlset>')
  return lines.join('\n')
}
