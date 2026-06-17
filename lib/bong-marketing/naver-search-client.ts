const NAVER_API_BASE = 'https://openapi.naver.com'

export function assertNaverCredentials(): { clientId: string; clientSecret: string } {
  const clientId = process.env.NAVER_CLIENT_ID?.trim()
  const clientSecret = process.env.NAVER_CLIENT_SECRET?.trim()
  if (!clientId || !clientSecret) {
    throw new Error('NAVER_CLIENT_ID / NAVER_CLIENT_SECRET 미설정')
  }
  return { clientId, clientSecret }
}

function getNaverHeaders(): HeadersInit {
  const { clientId, clientSecret } = assertNaverCredentials()
  return {
    'X-Naver-Client-Id': clientId,
    'X-Naver-Client-Secret': clientSecret,
  }
}

export interface NaverBlogSearchItem {
  title: string
  link: string
  description: string
  bloggername: string
  bloggerlink: string
  postdate: string
}

export interface NaverBlogSearchResponse {
  total: number
  start: number
  display: number
  items: NaverBlogSearchItem[]
}

/**
 * 네이버 블로그 검색 API
 * https://developers.naver.com/docs/serviceapi/search/blog/blog.md
 */
export async function searchNaverBlog(params: {
  query: string
  display?: number
  start?: number
  sort?: 'sim' | 'date'
}): Promise<NaverBlogSearchResponse> {
  const url = new URL(`${NAVER_API_BASE}/v1/search/blog.json`)
  url.searchParams.set('query', params.query)
  url.searchParams.set('display', String(params.display ?? 20))
  url.searchParams.set('start', String(params.start ?? 1))
  url.searchParams.set('sort', params.sort ?? 'sim')

  const res = await fetch(url.toString(), { headers: getNaverHeaders() })
  if (!res.ok) {
    throw new Error(`네이버 블로그 검색 실패: ${res.status} ${await res.text()}`)
  }
  return res.json() as Promise<NaverBlogSearchResponse>
}

/** HTML 태그·기본 엔티티 제거 */
export function stripHtmlTags(text: string): string {
  return text
    .replace(/<\/?[^>]+(>|$)/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}

export interface NaverDatalabKeyword {
  groupName: string
  keywords: string[]
}

export interface NaverDatalabResult {
  startDate: string
  endDate: string
  timeUnit: string
  results: Array<{
    title: string
    keywords: string[]
    data: Array<{ period: string; ratio: number }>
  }>
}

/**
 * 네이버 데이터랩 검색어 트렌드 API
 * https://developers.naver.com/docs/serviceapi/datalab/search/search.md
 */
export async function getDatalabSearchTrend(params: {
  startDate: string
  endDate: string
  timeUnit: 'date' | 'week' | 'month'
  keywordGroups: NaverDatalabKeyword[]
}): Promise<NaverDatalabResult> {
  const res = await fetch(`${NAVER_API_BASE}/v1/datalab/search`, {
    method: 'POST',
    headers: {
      ...getNaverHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      startDate: params.startDate,
      endDate: params.endDate,
      timeUnit: params.timeUnit,
      keywordGroups: params.keywordGroups,
    }),
  })
  if (!res.ok) {
    throw new Error(`데이터랩 트렌드 실패: ${res.status} ${await res.text()}`)
  }
  return res.json() as Promise<NaverDatalabResult>
}
