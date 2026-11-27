/**
 * 표기 의무 없는 사진만 (Openverse 공개 API, 키 없음). 사장님 11/27 21:31 출처 순서: 풀 → Pexels → Openverse/Wikimedia CC0·PD → Unsplash.
 * 허용 라이선스: cc0·pdm(퍼블릭 도메인 마크)만. CC BY 등 표기 필요 라이선스는 요청에서부터 빼고, 응답에서도 다시 거른다.
 * 간격·지터는 호출부(photo-autofill-acquire)가 둔다. 키·응답 본문은 기록하지 않는다.
 * REGRESSION-FREEZE[photo-openverse-cc0-1127]: Openverse 는 cc0·pdm 만 후보 — manifest
 */
import type { AutofillCandidate } from '@/lib/photo-autofill-gate'
import { COMMONS_USER_AGENT, searchWikimediaCc0 } from '@/lib/photo-autofill-cc0'

export const OPENVERSE_API = 'https://api.openverse.org/v1/images/'
const ALLOWED = new Set(['cc0', 'pdm'])

type OvTag = { name?: string }
type OvRow = {
  id?: string
  title?: string | null
  url?: string | null
  creator?: string | null
  license?: string | null
  foreign_landing_url?: string | null
  width?: number | null
  height?: number | null
  tags?: OvTag[] | null
  source?: string | null
}

export function openverseRowsToCandidates(data: unknown): AutofillCandidate[] {
  const rows = (data as { results?: OvRow[] })?.results
  if (!Array.isArray(rows)) return []
  const out: AutofillCandidate[] = []
  for (const r of rows) {
    const license = String(r?.license ?? '').trim().toLowerCase()
    if (!ALLOWED.has(license)) continue
    const url = String(r?.url ?? '').trim()
    if (!/^https:\/\//i.test(url)) continue
    const width = Math.floor(Number(r?.width) || 0)
    const height = Math.floor(Number(r?.height) || 0)
    if (width <= 0) continue
    const tags = (r?.tags ?? []).map((t) => String(t?.name ?? '').trim()).filter(Boolean).slice(0, 20)
    const title = String(r?.title ?? '').trim()
    const id = String(r?.id ?? url)
    out.push({
      id: `ov-${id}`.slice(0, 80),
      source: 'CC0',
      url,
      width,
      height,
      photographer: String(r?.creator ?? '').trim() || 'Openverse',
      originalLink: String(r?.foreign_landing_url ?? '').trim() || `https://openverse.org/image/${id}`,
      altText: title,
      title,
      description: license === 'pdm' ? 'Public Domain Mark' : 'CC0',
      tags,
    })
  }
  return out
}

/**
 * REGRESSION-FREEZE[free-src-1128]: Openverse 호출 관문 — 토큰(OPENVERSE_CLIENT_ID/SECRET)이 있으면 Bearer, 없으면 익명.
 * 익명 한도(응답 헤더 실측 11/28): anon_burst 100/min, anon_sustained 1000/day. 헤더 x-ratelimit-available-* 가 0 이하이면
 * burst 는 1분, sustained 는 1시간 부르지 않는다. 429 면 1시간. 멈춘 동안은 [](Wikimedia 로 넘어감). 호출마다 한 줄(키·토큰 없음) — manifest
 */
export const OPENVERSE_CLIENT_ID_ENV = 'OPENVERSE_CLIENT_ID'
export const OPENVERSE_CLIENT_SECRET_ENV = 'OPENVERSE_CLIENT_SECRET'
const OV_TOKEN_URL = 'https://api.openverse.org/v1/auth_tokens/token/'
type OvState = { stoppedUntil: number; token?: { value: string; exp: number } }
const og = globalThis as unknown as { __btOpenverse?: OvState }
function ovState(): OvState {
  return (og.__btOpenverse ??= { stoppedUntil: 0 })
}
export function isOpenverseStopped(now: number = Date.now()): boolean {
  return now < ovState().stoppedUntil
}
/** 테스트용 */
export function __resetOpenverseForTest(): void {
  og.__btOpenverse = { stoppedUntil: 0 }
}
export function openverseStopMsFromHeaders(get: (name: string) => string | null | undefined, status: number): number {
  let ms = status === 429 ? 60 * 60 * 1000 : 0
  for (const [name, wait] of [
    ['x-ratelimit-available-anon_burst', 60 * 1000],
    ['x-ratelimit-available-anon_sustained', 60 * 60 * 1000],
    ['x-ratelimit-available-enhanced_burst', 60 * 1000],
    ['x-ratelimit-available-enhanced_sustained', 60 * 60 * 1000],
  ] as const) {
    const v = Number(get(name) ?? NaN)
    if (Number.isFinite(v) && v <= 0) ms = Math.max(ms, wait)
  }
  return ms
}

async function openverseBearer(env: Record<string, string | undefined>, fetchImpl: typeof fetch, now: number): Promise<string | null> {
  const id = (env[OPENVERSE_CLIENT_ID_ENV] ?? '').trim()
  const secret = (env[OPENVERSE_CLIENT_SECRET_ENV] ?? '').trim()
  if (!id || !secret) return null
  const st = ovState()
  if (st.token && st.token.exp - 60_000 > now) return st.token.value
  try {
    const res = await fetchImpl(OV_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': COMMONS_USER_AGENT },
      body: new URLSearchParams({ grant_type: 'client_credentials', client_id: id, client_secret: secret }).toString(),
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) return null
    const j = (await res.json()) as { access_token?: string; expires_in?: number }
    if (!j.access_token) return null
    st.token = { value: j.access_token, exp: now + Math.max(60, Number(j.expires_in) || 3600) * 1000 }
    return st.token.value
  } catch {
    return null
  }
}

export async function searchOpenverseCc0(
  query: string,
  perPage: number,
  fetchImpl: typeof fetch = fetch,
  deps: { env?: Record<string, string | undefined>; now?: () => number } = {},
): Promise<AutofillCandidate[]> {
  const q = query.trim()
  if (!q) return []
  const now = deps.now ?? Date.now
  if (isOpenverseStopped(now())) return []
  const u = new URL(OPENVERSE_API)
  u.searchParams.set('q', q)
  u.searchParams.set('license', 'cc0,pdm')
  u.searchParams.set('page_size', String(Math.max(1, Math.min(20, perPage))))
  u.searchParams.set('mature', 'false')
  const bearer = await openverseBearer(deps.env ?? process.env, fetchImpl, now())
  const res = await fetchImpl(u.toString(), {
    headers: { 'User-Agent': COMMONS_USER_AGENT, Accept: 'application/json', ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}) },
    signal: AbortSignal.timeout(20000),
  })
  const get = (n: string) => res.headers?.get?.(n) ?? null
  const stopMs = openverseStopMsFromHeaders(get, res.status)
  if (stopMs > 0) ovState().stoppedUntil = Math.max(ovState().stoppedUntil, now() + stopMs)
  console.log(
    JSON.stringify({
      kind: 'openverse-call',
      status: res.status,
      auth: bearer ? 'token' : 'anon',
      burstLeft: get('x-ratelimit-available-anon_burst') ?? get('x-ratelimit-available-enhanced_burst'),
      dayLeft: get('x-ratelimit-available-anon_sustained') ?? get('x-ratelimit-available-enhanced_sustained'),
    }),
  )
  if (!res.ok) throw new Error(`openverse_http_${res.status}`)
  return openverseRowsToCandidates(await res.json())
}

/** Openverse 먼저, 실패·빈 결과면 Wikimedia Commons. 한쪽 오류는 다른 쪽으로 넘어간다(둘 다 오류면 throw → 호출부 재시도 1회). */
export async function searchNoAttributionCc0(query: string, perPage: number, fetchImpl: typeof fetch = fetch): Promise<AutofillCandidate[]> {
  let ov: AutofillCandidate[] = []
  let ovErr = false
  try {
    ov = await searchOpenverseCc0(query, perPage, fetchImpl)
  } catch {
    ovErr = true
  }
  let wm: AutofillCandidate[] = []
  try {
    wm = await searchWikimediaCc0(query, perPage, fetchImpl)
  } catch (e) {
    if (ovErr) throw e
  }
  return [...ov, ...wm]
}
