import { getDatalabSearchTrend, type NaverDatalabKeyword } from '@/lib/bong-marketing/naver-search-client'

const TRAVEL_KEYWORD_CANDIDATES: NaverDatalabKeyword[] = [
  { groupName: '동남아 여행', keywords: ['다낭 여행', '방콕 여행', '발리 여행', '보라카이 여행', '세부 여행'] },
  { groupName: '일본 여행', keywords: ['일본 여행', '도쿄 여행', '오사카 여행', '오키나와 여행', '삿포로 여행'] },
  { groupName: '유럽 여행', keywords: ['유럽 여행', '파리 여행', '런던 여행', '바르셀로나 여행', '로마 여행'] },
  { groupName: '미주/오세아니아', keywords: ['하와이 여행', '괌 여행', '사이판 여행', '시드니 여행'] },
  { groupName: '시즌 키워드', keywords: ['여름 여행', '겨울 여행', '가을 단풍', '봄 벚꽃'] },
]

export interface TrendingKeyword {
  groupName: string
  keywords: string[]
  avgRatio: number
  trend: 'up' | 'down' | 'flat'
}

export function computeTrendFromRatios(ratios: number[]): 'up' | 'down' | 'flat' {
  const recent = ratios.slice(-3)
  const initial = ratios.slice(0, 3)
  const recentAvg = recent.length > 0 ? recent.reduce((a, b) => a + b, 0) / recent.length : 0
  const initialAvg = initial.length > 0 ? initial.reduce((a, b) => a + b, 0) / initial.length : 0
  const diff = recentAvg - initialAvg
  return diff > 5 ? 'up' : diff < -5 ? 'down' : 'flat'
}

export function mapDatalabResultsToTrending(
  results: Array<{
    title: string
    keywords: string[]
    data: Array<{ period: string; ratio: number }>
  }>,
): TrendingKeyword[] {
  return results
    .map((r) => {
      const ratios = r.data.map((d) => d.ratio)
      const avg = ratios.length > 0 ? ratios.reduce((a, b) => a + b, 0) / ratios.length : 0
      return {
        groupName: r.title,
        keywords: r.keywords,
        avgRatio: avg,
        trend: computeTrendFromRatios(ratios),
      }
    })
    .sort((a, b) => b.avgRatio - a.avgRatio)
}

/**
 * 최근 3개월 데이터랩 트렌드 → 인기 키워드 그룹 정렬.
 */
export async function getTrendingTravelKeywords(): Promise<TrendingKeyword[]> {
  const now = new Date()
  const endDate = now.toISOString().slice(0, 10)
  const startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const result = await getDatalabSearchTrend({
    startDate,
    endDate,
    timeUnit: 'week',
    keywordGroups: TRAVEL_KEYWORD_CANDIDATES,
  })

  return mapDatalabResultsToTrending(result.results)
}
