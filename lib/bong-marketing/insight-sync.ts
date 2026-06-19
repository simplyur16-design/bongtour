import { prisma } from '@/lib/prisma'
import {
  getFacebookPagePosts,
  getFacebookPostInsight,
  getInstagramMedia,
  getInstagramMediaInsight,
  type FacebookPagePost,
} from '@/lib/meta-graph-client'
import { getValidMetaConnection } from '@/lib/bong-marketing/meta-token-manager'
import { debugError, debugLog } from '@/lib/bong-marketing/debug-log'
import {
  extractFacebookPostIdFromPermalink,
  isFacebookPostWithin28DayInsightWindow,
} from '@/lib/bong-marketing/facebook-insight-utils'

export interface InsightSyncResult {
  instagram: { synced: number; errors: number }
  facebook: { synced: number; errors: number }
}

export interface FacebookBackfillResult {
  success: number
  skippedOutside28Days: number
  errors: number
  details: Array<{ id: string; fbPostId: string | null; status: string }>
}

export async function syncAllInsights(syncSource: 'cron' | 'manual'): Promise<InsightSyncResult> {
  const result: InsightSyncResult = {
    instagram: { synced: 0, errors: 0 },
    facebook: { synced: 0, errors: 0 },
  }

  const conn = await getValidMetaConnection()
  if (!conn) {
    debugError('insight-sync', 'Meta 연결 없거나 토큰 만료')
    return result
  }

  if (conn.instagramBusinessId && conn.pageAccessToken) {
    result.instagram = await syncInstagramInsights(
      conn.instagramBusinessId,
      conn.pageAccessToken,
      syncSource,
    )
  }

  if (conn.pageId && conn.pageAccessToken) {
    result.facebook = await syncFacebookInsights(conn.pageId, conn.pageAccessToken, syncSource)
  }

  debugLog('insight-sync', '완료:', result)
  return result
}

export async function syncInstagramInsights(
  igUserId: string,
  pageToken: string,
  syncSource: string,
): Promise<{ synced: number; errors: number }> {
  let synced = 0
  let errors = 0

  try {
    const mediaList = await getInstagramMedia(igUserId, pageToken, 25)

    for (const media of mediaList) {
      try {
        const insights = await getInstagramMediaInsight(media.id, pageToken)

        await prisma.bongPostInsight.upsert({
          where: { instaMediaId: media.id },
          update: {
            platform: 'instagram',
            caption: media.caption ?? null,
            permalink: media.permalink,
            publishedAt: new Date(media.timestamp),
            reach: insights.reach ?? null,
            impressions: insights.views ?? null,
            likes: insights.likes ?? null,
            saved: insights.saved ?? null,
            shares: insights.shares ?? null,
            comments: insights.comments ?? null,
            syncedAt: new Date(),
            syncSource,
          },
          create: {
            platform: 'instagram',
            instaMediaId: media.id,
            sourceType: 'instagram-organic',
            caption: media.caption ?? null,
            permalink: media.permalink,
            publishedAt: new Date(media.timestamp),
            reach: insights.reach ?? null,
            impressions: insights.views ?? null,
            likes: insights.likes ?? null,
            saved: insights.saved ?? null,
            shares: insights.shares ?? null,
            comments: insights.comments ?? null,
            syncedAt: new Date(),
            syncSource,
          },
        })
        synced++
      } catch (err) {
        debugError('insight-sync', `IG ${media.id} 실패:`, err)
        errors++
      }
    }
  } catch (err) {
    debugError('insight-sync', 'IG 미디어 목록 실패:', err)
    errors++
  }

  return { synced, errors }
}

function buildFacebookInsightWriteData(
  post: FacebookPagePost,
  pageId: string,
  insights: Awaited<ReturnType<typeof getFacebookPostInsight>>,
  syncSource: string,
  publishedAt: Date,
) {
  const within28 = isFacebookPostWithin28DayInsightWindow(publishedAt)
  const reach = insights.post_total_media_view_unique ?? null
  const impressions = insights.post_media_view ?? null

  return {
    platform: 'facebook' as const,
    fbPostId: post.id,
    pageId,
    sourceType: 'facebook-page-post',
    caption: post.message ?? null,
    permalink: post.permalink_url,
    publishedAt,
    reach: within28 || reach != null ? reach : null,
    impressions: within28 || impressions != null ? impressions : null,
    likes: insights.reactions?.like ?? null,
    fbReactionsTotal: insights.fbReactionsTotal ?? null,
    comments: post.comments?.summary?.total_count ?? null,
    websiteClicks: insights.post_clicks ?? null,
    syncedAt: new Date(),
    syncSource,
  }
}

async function upsertFacebookPostInsight(
  post: FacebookPagePost,
  pageId: string,
  pageToken: string,
  syncSource: string,
): Promise<void> {
  const publishedAt = new Date(post.created_time)
  const insights = await getFacebookPostInsight(post.id, pageToken)
  const data = buildFacebookInsightWriteData(post, pageId, insights, syncSource, publishedAt)

  const existing = await prisma.bongPostInsight.findFirst({
    where: {
      OR: [
        { fbPostId: post.id },
        { platform: 'facebook', permalink: post.permalink_url },
        { sourceType: 'facebook-page-post', permalink: post.permalink_url },
      ],
    },
  })

  if (existing) {
    await prisma.bongPostInsight.update({
      where: { id: existing.id },
      data,
    })
    return
  }

  await prisma.bongPostInsight.create({ data })
}

export async function syncFacebookInsights(
  pageId: string,
  pageToken: string,
  syncSource: string,
): Promise<{ synced: number; errors: number }> {
  let synced = 0
  let errors = 0

  try {
    const posts = await getFacebookPagePosts(pageId, pageToken, 25)

    for (const post of posts) {
      try {
        await upsertFacebookPostInsight(post, pageId, pageToken, syncSource)
        synced++
      } catch (err) {
        debugError('insight-sync', `FB ${post.id} 실패:`, err)
        errors++
      }
    }
  } catch (err) {
    debugError('insight-sync', 'FB 게시물 목록 실패:', err)
    errors++
  }

  return { synced, errors }
}

/** manual 페북 레코드 permalink → Graph API sync (ops backfill) */
export async function backfillFacebookInsightsFromDb(
  syncSource: 'manual' | 'cron' = 'manual',
): Promise<FacebookBackfillResult> {
  const result: FacebookBackfillResult = {
    success: 0,
    skippedOutside28Days: 0,
    errors: 0,
    details: [],
  }

  const conn = await getValidMetaConnection()
  if (!conn?.pageId || !conn.pageAccessToken) {
    debugError('insight-sync', 'Meta page connection missing for FB backfill')
    return result
  }

  const rows = await prisma.bongPostInsight.findMany({
    where: {
      OR: [{ platform: 'facebook' }, { sourceType: 'facebook-page-post' }],
    },
    orderBy: { publishedAt: 'desc' },
  })

  for (const row of rows) {
    const publishedAt = row.publishedAt ? new Date(row.publishedAt) : null
    if (publishedAt && !isFacebookPostWithin28DayInsightWindow(publishedAt)) {
      result.skippedOutside28Days++
      result.details.push({
        id: row.id,
        fbPostId: row.fbPostId,
        status: 'outside_28_day_window',
      })
      continue
    }

    const fbPostId =
      row.fbPostId ??
      (row.permalink
        ? extractFacebookPostIdFromPermalink(row.permalink, conn.pageId)
        : null)

    if (!fbPostId) {
      result.errors++
      result.details.push({ id: row.id, fbPostId: null, status: 'missing_fb_post_id' })
      continue
    }

    try {
      const insights = await getFacebookPostInsight(fbPostId, conn.pageAccessToken)
      const postStub: FacebookPagePost = {
        id: fbPostId,
        message: row.caption ?? undefined,
        permalink_url: row.permalink ?? '',
        created_time: publishedAt?.toISOString() ?? new Date().toISOString(),
      }
      const data = buildFacebookInsightWriteData(
        postStub,
        conn.pageId,
        insights,
        syncSource,
        publishedAt ?? new Date(),
      )

      await prisma.bongPostInsight.update({
        where: { id: row.id },
        data: { ...data, fbPostId, pageId: conn.pageId },
      })

      result.success++
      result.details.push({ id: row.id, fbPostId, status: 'synced' })
    } catch (err) {
      result.errors++
      result.details.push({
        id: row.id,
        fbPostId,
        status: err instanceof Error ? err.message : 'sync_failed',
      })
    }
  }

  return result
}
