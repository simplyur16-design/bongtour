import { prisma } from '@/lib/prisma'
import { extractHooksFromBlogItems, type ExtractedHook } from '@/lib/bong-marketing/hook-extractor'
import { searchNaverBlog } from '@/lib/bong-marketing/naver-search-client'
import { getTrendingTravelKeywords } from '@/lib/bong-marketing/trending-keywords'

export interface CollectionResult {
  trendingKeywords: string[]
  totalBlogItems: number
  totalHooksExtracted: number
  goodHooksInserted: number
  badHooksInserted: number
  skippedDuplicates: number
}

/**
 * 트렌드 → 블로그 검색 → Gemini 추출 → BongHookLibrary INSERT
 */
export async function collectHooksFromNaver(options: {
  topKeywordGroups?: number
  itemsPerKeyword?: number
} = {}): Promise<CollectionResult> {
  const topN = options.topKeywordGroups ?? 3
  const display = options.itemsPerKeyword ?? 20

  const trending = await getTrendingTravelKeywords()
  const topGroups = trending.slice(0, topN)
  const usedKeywords: string[] = []

  let totalBlogItems = 0
  const allHooks: ExtractedHook[] = []

  for (const group of topGroups) {
    const keyword = group.keywords[0]
    if (!keyword) continue
    usedKeywords.push(keyword)

    const blogResult = await searchNaverBlog({
      query: keyword,
      display,
      sort: 'sim',
    })
    totalBlogItems += blogResult.items.length

    const hooks = await extractHooksFromBlogItems(blogResult.items, keyword)
    allHooks.push(...hooks)
  }

  const hookTexts = [...new Set(allHooks.map((h) => h.hookText))]
  const existing =
    hookTexts.length > 0
      ? await prisma.bongHookLibrary.findMany({
          where: { hookText: { in: hookTexts } },
          select: { hookText: true },
        })
      : []
  const existingSet = new Set(existing.map((e) => e.hookText))

  const newHooks = allHooks.filter((h) => !existingSet.has(h.hookText))

  let goodCount = 0
  let badCount = 0
  for (const h of newHooks) {
    await prisma.bongHookLibrary.create({
      data: {
        hookType: h.hookType,
        hookText: h.hookText,
        context: h.context ?? null,
        category: h.category ?? null,
        source: h.source ?? 'naver_blog_search',
        tags: h.tags ?? [],
        isActive: true,
      },
    })
    if (h.hookType === 'good') goodCount++
    else badCount++
  }

  return {
    trendingKeywords: usedKeywords,
    totalBlogItems,
    totalHooksExtracted: allHooks.length,
    goodHooksInserted: goodCount,
    badHooksInserted: badCount,
    skippedDuplicates: allHooks.length - newHooks.length,
  }
}
