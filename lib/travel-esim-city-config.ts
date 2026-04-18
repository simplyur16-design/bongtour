/**
 * 해외여행 소메뉴「E-sim」— 도시별 eSIM 위젯(HTML/스크립트).
 * 운영에서 마크업만 교체하면 됩니다. 신뢰할 수 있는 출처의 마크업만 넣으세요.
 */

export type EsimCityEntry = {
  slug: string
  label: string
  /**
   * eSIM 업체에서 제공하는 HTML(iframe 등). React는 innerHTML로 삽입한 &lt;script&gt;를 실행하지 않으므로,
   * 스크립트 위젯이면 `esimScriptSrcs`에 src를 넣거나, 업체가 준 iframe 스니펫만 여기 넣는 것을 권장합니다.
   */
  esimEmbedHtml: string
  /** 위젯이 외부 JS 파일로 나뉘는 경우 next/script로 로드 */
  esimScriptSrcs?: readonly string[]
}

/** 표시 순서 = 탭 순서. slug는 URL ?city= 값과 동일(영문 소문자·하이픈 권장). */
export const ESIM_CITY_ENTRIES: readonly EsimCityEntry[] = [
  {
    slug: 'tokyo',
    label: '도쿄',
    esimEmbedHtml:
      '<p class="text-sm text-slate-600">도쿄 eSIM 위젯 HTML을 여기에 붙여넣으세요 (iframe 권장).</p>',
  },
  {
    slug: 'osaka',
    label: '오사카',
    esimEmbedHtml:
      '<p class="text-sm text-slate-600">오사카 eSIM 위젯 HTML을 여기에 붙여넣으세요.</p>',
  },
  {
    slug: 'bangkok',
    label: '방콕',
    esimEmbedHtml:
      '<p class="text-sm text-slate-600">방콕 eSIM 위젯 HTML을 여기에 붙여넣으세요.</p>',
  },
]

export function getEsimCityEntryBySlug(slug: string | undefined): EsimCityEntry {
  if (slug) {
    const found = ESIM_CITY_ENTRIES.find((e) => e.slug === slug)
    if (found) return found
  }
  return ESIM_CITY_ENTRIES[0]!
}
