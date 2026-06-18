import { prisma } from '@/lib/prisma'
import {
  getFacebookPagePosts,
  getFacebookPostInsight,
  getInstagramMedia,
  getInstagramMediaInsight,
} from '@/lib/meta-graph-client'
import { getValidMetaConnection } from '@/lib/bong-marketing/meta-token-manager'
import { debugError, debugLog } from '@/lib/bong-marketing/debug-log'

export interface InsightSyncResult {
  instagram: { synced: number; errors: number }
  facebook: { synced: number; errors: number }
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

async function syncInstagramInsights(
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
            caption: media.caption ?? null,
            permalink: media.permalink,
            publishedAt: new Date(media.timestamp),
            reach: insights.reach ?? null,
            likes: insights.likes ?? null,
            saved: insights.saved ?? null,
            shares: insights.shares ?? null,
            comments: insights.comments ?? null,
            syncedAt: new Date(),
            syncSource,
          },
          create: {
            instaMediaId: media.id,
            sourceType: 'instagram-organic',
            caption: media.caption ?? null,
            permalink: media.permalink,
            publishedAt: new Date(media.timestamp),
            reach: insights.reach ?? null,
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

async function syncFacebookInsights(
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
        const insights = await getFacebookPostInsight(post.id, pageToken)

        const existing = await prisma.bongPostInsight.findFirst({
          where: {
            sourceType: 'facebook-page-post',
            permalink: post.permalink_url,
          },
        })

        if (existing) {
          await prisma.bongPostInsight.update({
            where: { id: existing.id },
            data: {
              caption: post.message ?? null,
              publishedAt: new Date(post.created_time),
              reach: insights.post_impressions_unique ?? null,
              impressions: insights.post_impressions ?? null,
              websiteClicks: insights.post_clicks ?? null,
              syncedAt: new Date(),
              syncSource,
            },
          })
        } else {
          await prisma.bongPostInsight.create({
            data: {
              sourceType: 'facebook-page-post',
              caption: post.message ?? null,
              permalink: post.permalink_url,
              publishedAt: new Date(post.created_time),
              reach: insights.post_impressions_unique ?? null,
              impressions: insights.post_impressions ?? null,
              websiteClicks: insights.post_clicks ?? null,
              syncedAt: new Date(),
              syncSource,
            },
          })
        }
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
