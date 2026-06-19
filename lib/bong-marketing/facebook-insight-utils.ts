/** PR 별건 #12+#16 — Facebook post insight helpers (Media Views API, no deprecated metrics). */

/** @deprecated since 2026-06-15 — must never be requested */
export const FACEBOOK_DEPRECATED_POST_INSIGHT_METRICS = [
  'post_impressions',
  'post_impressions_unique',
  'post_reach',
] as const

/** Post-level metrics aligned with Meta Page Insights (lifetime). */
export const FACEBOOK_POST_INSIGHT_METRICS = [
  'post_media_view',
  'post_total_media_view_unique',
  'post_clicks',
  'post_reactions_like_total',
  'post_reactions_love_total',
  'post_reactions_wow_total',
  'post_reactions_haha_total',
  'post_reactions_sorry_total',
  'post_reactions_anger_total',
] as const

export type FacebookReactionInsight = {
  like?: number
  love?: number
  wow?: number
  haha?: number
  sorry?: number
  anger?: number
}

export function sumFacebookReactions(reactions: FacebookReactionInsight): number {
  return (
    (reactions.like ?? 0) +
    (reactions.love ?? 0) +
    (reactions.wow ?? 0) +
    (reactions.haha ?? 0) +
    (reactions.sorry ?? 0) +
    (reactions.anger ?? 0)
  )
}

/** Meta post insights are reliable for recent posts; older posts may return partial/null data. */
export function isFacebookPostWithin28DayInsightWindow(
  publishedAt: Date,
  now: Date = new Date(),
): boolean {
  const ms28 = 28 * 24 * 60 * 60 * 1000
  return now.getTime() - publishedAt.getTime() <= ms28
}

/**
 * Build Graph API post id `{pageId}_{postId}` from permalink when possible.
 * Returns null when the permalink shape is not recognized.
 */
export function extractFacebookPostIdFromPermalink(
  permalink: string,
  pageId?: string | null,
): string | null {
  const trimmed = permalink.trim()
  if (!trimmed) return null

  try {
    const url = new URL(trimmed)
    const pathMatch = url.pathname.match(/\/posts\/(\d+)/i)
    if (pathMatch?.[1]) {
      const postNumeric = pathMatch[1]
      const pageFromPath = url.pathname.match(/^\/(\d+)\/posts\//)?.[1]
      const resolvedPage = pageFromPath ?? pageId?.trim()
      if (resolvedPage) return `${resolvedPage}_${postNumeric}`
      return postNumeric
    }

    const storyFbid = url.searchParams.get('story_fbid')
    const idParam = url.searchParams.get('id') ?? pageId?.trim()
    if (storyFbid && idParam) {
      return `${idParam}_${storyFbid}`
    }

    const pfbidMatch = trimmed.match(/pfbid[A-Za-z0-9]+/)
    if (pfbidMatch && pageId?.trim()) {
      return `${pageId.trim()}_${pfbidMatch[0]}`
    }
  } catch {
    const postsMatch = trimmed.match(/\/posts\/(\d+)/i)
    if (postsMatch?.[1]) {
      const resolvedPage = pageId?.trim()
      return resolvedPage ? `${resolvedPage}_${postsMatch[1]}` : postsMatch[1]
    }
  }

  return null
}
