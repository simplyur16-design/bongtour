/**
 * Meta Graph API 클라이언트 — 직접 fetch, SDK 미사용.
 */

const META_API_VERSION = process.env.META_GRAPH_API_VERSION || 'v22.0'

export function getMetaGraphApiBase(): string {
  return `https://graph.facebook.com/${META_API_VERSION}`
}

export interface MetaTokenResponse {
  access_token: string
  token_type?: string
  expires_in?: number
}

export interface MetaPage {
  id: string
  name: string
  access_token: string
}

export interface InstagramMedia {
  id: string
  caption?: string
  media_type: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM'
  media_url?: string
  permalink: string
  timestamp: string
}

export interface InstagramMediaInsight {
  reach?: number
  /** @deprecated Meta 2024-11 — API는 views 반환; parse 시 views 값이 복사됨 */
  impressions?: number
  views?: number
  likes?: number
  saved?: number
  shares?: number
  comments?: number
}

export interface FacebookPagePost {
  id: string
  message?: string
  permalink_url: string
  created_time: string
}

export interface FacebookPostInsight {
  post_impressions?: number
  post_impressions_unique?: number
  post_clicks?: number
}

export interface TokenDebugInfo {
  app_id: string
  type: string
  application: string
  expires_at: number
  is_valid: boolean
  user_id: string
}

type InsightApiRow = { name?: string; values?: Array<{ value?: number }> }

export function parseInstagramInsightsFromApi(data: InsightApiRow[]): InstagramMediaInsight {
  const result: InstagramMediaInsight = {}
  for (const item of data) {
    const value = item.values?.[0]?.value
    if (item.name === 'reach') result.reach = value
    if (item.name === 'views') {
      result.views = value
      result.impressions = value
    }
    if (item.name === 'likes') result.likes = value
    if (item.name === 'saved') result.saved = value
    if (item.name === 'shares') result.shares = value
    if (item.name === 'comments') result.comments = value
  }
  return result
}

export function parseFacebookInsightsFromApi(data: InsightApiRow[]): FacebookPostInsight {
  const result: FacebookPostInsight = {}
  for (const item of data) {
    const value = item.values?.[0]?.value
    if (item.name === 'post_impressions') result.post_impressions = value
    if (item.name === 'post_impressions_unique') result.post_impressions_unique = value
    if (item.name === 'post_clicks') result.post_clicks = value
  }
  return result
}

function requireMetaAppCredentials(): { appId: string; appSecret: string } {
  const appId = process.env.META_APP_ID?.trim()
  const appSecret = process.env.META_APP_SECRET?.trim()
  if (!appId || !appSecret) {
    throw new Error('META_APP_ID 또는 META_APP_SECRET 미설정')
  }
  return { appId, appSecret }
}

function requireMetaRedirectUri(): string {
  const redirectUri = process.env.META_REDIRECT_URI?.trim()
  if (!redirectUri) {
    throw new Error('META_REDIRECT_URI 미설정')
  }
  return redirectUri
}

/** code → 단기 액세스 토큰 */
export async function exchangeCodeForToken(code: string): Promise<MetaTokenResponse> {
  const { appId, appSecret } = requireMetaAppCredentials()
  const redirectUri = requireMetaRedirectUri()
  const url = new URL(`${getMetaGraphApiBase()}/oauth/access_token`)
  url.searchParams.set('client_id', appId)
  url.searchParams.set('client_secret', appSecret)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('code', code)

  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Token exchange failed (${res.status}): ${text}`)
  }
  return res.json() as Promise<MetaTokenResponse>
}

/** 단기 → 장기 토큰 (60일) */
export async function exchangeShortLivedForLongLived(shortToken: string): Promise<MetaTokenResponse> {
  const { appId, appSecret } = requireMetaAppCredentials()
  const url = new URL(`${getMetaGraphApiBase()}/oauth/access_token`)
  url.searchParams.set('grant_type', 'fb_exchange_token')
  url.searchParams.set('client_id', appId)
  url.searchParams.set('client_secret', appSecret)
  url.searchParams.set('fb_exchange_token', shortToken)

  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Long-lived token exchange failed (${res.status}): ${text}`)
  }
  return res.json() as Promise<MetaTokenResponse>
}

/** 사용자 페이지 목록 (페이지 토큰 포함) */
export async function getMetaUserPages(userToken: string): Promise<MetaPage[]> {
  const url = new URL(`${getMetaGraphApiBase()}/me/accounts`)
  url.searchParams.set('access_token', userToken)

  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error(`Get pages failed: ${res.status}`)
  const json = (await res.json()) as { data?: MetaPage[] }
  return json.data || []
}

/** 인스타 비즈니스 계정 ID */
export async function getInstagramBusinessAccountId(
  pageId: string,
  pageToken: string,
): Promise<string | null> {
  const url = new URL(`${getMetaGraphApiBase()}/${pageId}`)
  url.searchParams.set('fields', 'instagram_business_account')
  url.searchParams.set('access_token', pageToken)

  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) return null
  const json = (await res.json()) as { instagram_business_account?: { id?: string } }
  return json.instagram_business_account?.id || null
}

/** 인스타 미디어 목록 */
export async function getInstagramMedia(
  igUserId: string,
  pageToken: string,
  limit = 25,
): Promise<InstagramMedia[]> {
  const url = new URL(`${getMetaGraphApiBase()}/${igUserId}/media`)
  url.searchParams.set('fields', 'id,caption,media_type,media_url,permalink,timestamp')
  url.searchParams.set('limit', String(limit))
  url.searchParams.set('access_token', pageToken)

  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error(`Get IG media failed: ${res.status}`)
  const json = (await res.json()) as { data?: InstagramMedia[] }
  return json.data || []
}

/** 인스타 미디어 인사이트 */
export async function getInstagramMediaInsight(
  mediaId: string,
  pageToken: string,
): Promise<InstagramMediaInsight> {
  const metrics = ['reach', 'likes', 'saved', 'shares', 'comments', 'views'].join(',')
  const url = new URL(`${getMetaGraphApiBase()}/${mediaId}/insights`)
  url.searchParams.set('metric', metrics)
  url.searchParams.set('access_token', pageToken)

  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) return {}
  const json = (await res.json()) as { data?: InsightApiRow[] }
  return parseInstagramInsightsFromApi(json.data || [])
}

/** 페북 페이지 게시물 목록 */
export async function getFacebookPagePosts(
  pageId: string,
  pageToken: string,
  limit = 25,
): Promise<FacebookPagePost[]> {
  const url = new URL(`${getMetaGraphApiBase()}/${pageId}/posts`)
  url.searchParams.set('fields', 'id,message,permalink_url,created_time')
  url.searchParams.set('limit', String(limit))
  url.searchParams.set('access_token', pageToken)

  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error(`Get FB posts failed: ${res.status}`)
  const json = (await res.json()) as { data?: FacebookPagePost[] }
  return json.data || []
}

/** 페북 게시물 인사이트 */
export async function getFacebookPostInsight(
  postId: string,
  pageToken: string,
): Promise<FacebookPostInsight> {
  const metrics = ['post_impressions', 'post_impressions_unique', 'post_clicks'].join(',')
  const url = new URL(`${getMetaGraphApiBase()}/${postId}/insights`)
  url.searchParams.set('metric', metrics)
  url.searchParams.set('access_token', pageToken)

  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) return {}
  const json = (await res.json()) as { data?: InsightApiRow[] }
  return parseFacebookInsightsFromApi(json.data || [])
}

/** 장기 토큰 갱신 */
export async function refreshLongLivedToken(currentToken: string): Promise<MetaTokenResponse> {
  return exchangeShortLivedForLongLived(currentToken)
}

/** 토큰 디버그 */
export async function debugAccessToken(token: string): Promise<TokenDebugInfo | null> {
  const { appId, appSecret } = requireMetaAppCredentials()
  const url = new URL(`${getMetaGraphApiBase()}/debug_token`)
  url.searchParams.set('input_token', token)
  url.searchParams.set('access_token', `${appId}|${appSecret}`)

  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) return null
  const json = (await res.json()) as { data?: TokenDebugInfo }
  return json.data || null
}

export function tokenExpiresAtFromResponse(token: MetaTokenResponse): Date {
  const seconds = token.expires_in ?? 5184000
  return new Date(Date.now() + seconds * 1000)
}
