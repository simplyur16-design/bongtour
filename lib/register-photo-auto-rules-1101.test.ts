import { describe, expect, it, vi } from 'vitest'
import sharp from 'sharp'
import { findStockPhotoByChain, chainCandidateTextBlockReason, PHOTO_CHAIN_STOCK_ORDER } from '@/lib/register-photo-source-chain'
import { searchUnsplashHeroCandidates, triggerUnsplashDownload, isUnsplashPaidOrSponsoredPhoto } from '@/lib/unsplash-service'
import { PexelsCallGuard, UnsplashCallBudget, type StockGuardClock } from '@/lib/register-photo-stock-rate-guard'
import { isMonochromeRgb, isMonochromePhotoUrl, altSaysMonochrome } from '@/lib/register-photo-monochrome'
import { buildRegisterDayAiPhotoPrompt, firstRoutePlaceForAiPhoto } from '@/lib/register-day-ai-photo-prompt'
import { dayPhotoAiLabel, DAY_PHOTO_AI_LABEL_KO } from '@/lib/register-day-photo-ai-label'
import { scheduleDayImageIsGenerated } from '@/lib/schedule-day-image-ai-label-display'
import { pexelsErrorStopStatus } from '@/lib/pexels-service'

const px = (id: number, over: Record<string, unknown> = {}) => ({
  pexelsId: id,
  imageUrl: `https://images.pexels.com/photos/${id}/a.jpeg`,
  photographer: 'P',
  width: 4000,
  height: 2667,
  originalLink: `https://www.pexels.com/photo/wat-pho-${id}/`,
  queryUsed: 'Wat Pho',
  altText: 'Wat Pho temple in Bangkok',
  ...over,
})
const us = (id: string) => ({
  unsplashId: id,
  imageUrl: `https://images.unsplash.com/photo-${id}?w=2400`,
  width: 2400,
  height: 1600,
  downloadLocation: `https://api.unsplash.com/photos/${id}/download`,
  queryUsed: 'Wat Pho',
  authorName: 'U',
  authorProfileUrl: 'https://unsplash.com/@u',
  altText: 'Wat Pho Bangkok',
})

function fakeClock(start = 1_000_000): StockGuardClock & { t: number; slept: number[] } {
  const c = {
    t: start,
    slept: [] as number[],
    now: () => c.t,
    sleep: async (ms: number) => {
      c.slept.push(ms)
      c.t += ms
    },
  }
  return c
}
const env = { UNSPLASH_ACCESS_KEY: 'test-key-not-real' }
const okJson = (body: unknown, status = 200) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body }) as unknown as Response

describe('사진 출처 순서 (Pexels → Unsplash)', () => {
  it('Pexels 가 먼저, Pexels 통과면 Unsplash 는 부르지 않는다', async () => {
    expect([...PHOTO_CHAIN_STOCK_ORDER].slice(0, 2)).toEqual(['pexels', 'unsplash'])
    const searchUnsplash = vi.fn(async () => [us('x')])
    const r = await findStockPhotoByChain('Wat Pho', { accept: () => true, deps: { searchPexels: async () => [px(1)], searchUnsplash } })
    expect(r.photo?.source).toBe('Pexels')
    expect(searchUnsplash).not.toHaveBeenCalled()
  })
  it('Unsplash 사진을 쓰면 download_location 을 부르고, 못 부르면 그 사진을 쓰지 않는다', async () => {
    const ok = vi.fn(async () => true)
    const r1 = await findStockPhotoByChain('Wat Pho', { accept: () => true, deps: { searchPexels: async () => [], searchUnsplash: async () => [us('a')], triggerDownload: ok } })
    expect(r1.photo?.source).toBe('Unsplash')
    expect(ok).toHaveBeenCalledWith('https://api.unsplash.com/photos/a/download')
    const r2 = await findStockPhotoByChain('Wat Pho', { accept: () => true, deps: { searchPexels: async () => [], searchUnsplash: async () => [us('b')], triggerDownload: async () => false } })
    expect(r2.photo).toBeNull()
  })
})

describe('Unsplash 무료만 · 시간당 45번 · 403/429 멈춤', () => {
  it('Unsplash+ / premium / 스폰서 사진은 뺀다', async () => {
    expect(isUnsplashPaidOrSponsoredPhoto({ premium: true })).toBe(true)
    expect(isUnsplashPaidOrSponsoredPhoto({ plus: true })).toBe(true)
    expect(isUnsplashPaidOrSponsoredPhoto({ urls: { raw: 'https://plus.unsplash.com/premium_photo-1' } })).toBe(true)
    expect(isUnsplashPaidOrSponsoredPhoto({ sponsorship: { sponsor: {} } })).toBe(true)
    expect(isUnsplashPaidOrSponsoredPhoto({ premium: false, plus: false, sponsorship: null, urls: { raw: 'https://images.unsplash.com/photo-1' } })).toBe(false)
    const photo = (id: string, extra: Record<string, unknown>) => ({
      id,
      width: 4000,
      height: 2600,
      urls: { raw: `https://images.unsplash.com/photo-${id}` },
      links: { download_location: `https://api.unsplash.com/photos/${id}/download` },
      user: { name: 'A', links: { html: 'https://unsplash.com/@a' } },
      ...extra,
    })
    const fetchImpl = vi.fn(async () =>
      okJson({ results: [photo('free', {}), photo('prem', { premium: true }), photo('plus', { plus: true, urls: { raw: 'https://plus.unsplash.com/premium_photo-2' } })] }),
    ) as unknown as typeof fetch
    const out = await searchUnsplashHeroCandidates('Wat Pho', 10, 'Wat Pho', { env, fetchImpl, budget: new UnsplashCallBudget(fakeClock()) })
    expect(out.map((x) => x.unsplashId)).toEqual(['free'])
  })
  it('키가 없으면 네트워크 없이 빈 결과', async () => {
    const fetchImpl = vi.fn() as unknown as typeof fetch
    expect(await searchUnsplashHeroCandidates('x', 5, 'x', { env: {}, fetchImpl })).toEqual([])
    expect(await triggerUnsplashDownload('https://api.unsplash.com/photos/a/download', { env: {}, fetchImpl })).toBe(false)
    expect(fetchImpl).not.toHaveBeenCalled()
  })
  it('검색 + download_location 을 합쳐 한 시간 45번까지, 한 시간 지나면 다시', async () => {
    const clock = fakeClock()
    const budget = new UnsplashCallBudget(clock)
    const fetchImpl = vi.fn(async () => okJson({ results: [] })) as unknown as typeof fetch
    for (let i = 0; i < 30; i++) await searchUnsplashHeroCandidates('q', 5, 'q', { env, fetchImpl, budget })
    for (let i = 0; i < 20; i++) await triggerUnsplashDownload('https://api.unsplash.com/photos/a/download', { env, fetchImpl, budget })
    expect((fetchImpl as unknown as { mock: { calls: unknown[] } }).mock.calls.length).toBe(45)
    clock.t += 60 * 60 * 1000 + 1
    expect(budget.remaining()).toBe(45)
  })
  it('403·429 를 받으면 다시 부르지 않는다(재시도 없음)', async () => {
    for (const status of [403, 429]) {
      const budget = new UnsplashCallBudget(fakeClock())
      const fetchImpl = vi.fn(async () => okJson({}, status)) as unknown as typeof fetch
      await searchUnsplashHeroCandidates('q', 5, 'q', { env, fetchImpl, budget })
      await searchUnsplashHeroCandidates('q', 5, 'q', { env, fetchImpl, budget })
      await triggerUnsplashDownload('https://api.unsplash.com/photos/a/download', { env, fetchImpl, budget })
      expect((fetchImpl as unknown as { mock: { calls: unknown[] } }).mock.calls.length).toBe(1)
      expect(budget.isStopped()).toBe(true)
    }
  })
})

describe('Pexels 3.5초 간격 · 403/429 멈춤', () => {
  it('호출 사이 3.5초 이상 기다린다', async () => {
    const clock = fakeClock()
    const g = new PexelsCallGuard(clock)
    expect(await g.acquire()).toBe(true)
    expect(await g.acquire()).toBe(true)
    expect(await g.acquire()).toBe(true)
    expect(clock.slept).toEqual([3500, 3500])
  })
  it('403·429 뒤에는 부르지 않는다', async () => {
    const g = new PexelsCallGuard(fakeClock())
    await g.acquire()
    g.onStatus(429)
    expect(await g.acquire()).toBe(false)
    expect(pexelsErrorStopStatus(new Error('Too Many Requests'))).toBe(429)
    expect(pexelsErrorStopStatus('HTTP 403 Forbidden')).toBe(403)
    expect(pexelsErrorStopStatus('timeout')).toBeNull()
  })
})

describe('대표사진 흑백 금지(일차 칸은 허용)', () => {
  it('화소 채도로 흑백을 가린다', () => {
    const gray = Buffer.alloc(32 * 32 * 3)
    for (let i = 0; i < gray.length; i += 3) gray[i] = gray[i + 1] = gray[i + 2] = (i / 3) % 256
    const color = Buffer.alloc(32 * 32 * 3)
    for (let i = 0; i < color.length; i += 3) {
      color[i] = 200
      color[i + 1] = 90
      color[i + 2] = 40
    }
    expect(isMonochromeRgb(gray)).toBe(true)
    expect(isMonochromeRgb(color)).toBe(false)
  })
  it('미리보기 이미지를 받아 흑백 판정(받기 실패는 통과)', async () => {
    const grayPng = await sharp({ create: { width: 40, height: 30, channels: 3, background: { r: 120, g: 120, b: 120 } } }).png().toBuffer()
    const colorPng = await sharp({ create: { width: 40, height: 30, channels: 3, background: { r: 30, g: 120, b: 220 } } }).png().toBuffer()
    const f = (buf: Buffer) => (async () => ({ ok: true, status: 200, arrayBuffer: async () => buf })) as unknown as typeof fetch
    expect(await isMonochromePhotoUrl('https://images.pexels.com/photos/1/a.jpeg', { fetchImpl: f(grayPng) })).toBe(true)
    expect(await isMonochromePhotoUrl('https://images.pexels.com/photos/1/a.jpeg', { fetchImpl: f(colorPng) })).toBe(false)
    expect(await isMonochromePhotoUrl('https://x', { fetchImpl: (async () => { throw new Error('x') }) as unknown as typeof fetch })).toBe(false)
  })
  it('대표 칸은 흑백 후보를 건너뛰고 다음 컬러 후보, 일차 칸은 흑백 허용', async () => {
    expect(altSaysMonochrome('black and white photo of Wat Pho')).toBe(true)
    const bw = px(1, { altText: 'black and white Wat Pho temple' })
    const col = px(2)
    const main = await findStockPhotoByChain('Wat Pho', { accept: () => true, slot: 'main', deps: { searchPexels: async () => [bw, col] } })
    expect(main.photo?.externalId).toBe('2')
    const day = await findStockPhotoByChain('Wat Pho', { accept: () => true, slot: 'day', deps: { searchPexels: async () => [bw, col] } })
    expect(day.photo?.externalId).toBe('1')
    const verifyMain = await findStockPhotoByChain('Wat Pho', {
      accept: () => true,
      slot: 'main',
      verify: async (c) => c.externalId !== '3',
      deps: { searchPexels: async () => [px(3), px(4)] },
    })
    expect(verifyMain.photo?.externalId).toBe('4')
  })
})

describe('로고·워터마크·글자 사진 금지, 같은 상품 안 중복 금지', () => {
  it('글자·로고·워터마크 설명 후보는 뺀다', () => {
    expect(chainCandidateTextBlockReason({ altText: 'Wat Pho with watermark' }, 'day')).toBe('text_or_logo')
    expect(chainCandidateTextBlockReason({ altText: 'travel quote typography over temple' }, 'day')).toBe('text_or_logo')
    expect(chainCandidateTextBlockReason({ altText: 'Wat Pho temple at sunset' }, 'main')).toBeNull()
  })
  it('이미 이 상품에 쓴 사진(accept=false)은 고르지 않는다', async () => {
    const used = new Set(['1'])
    const r = await findStockPhotoByChain('Wat Pho', {
      accept: (c) => !used.has(c.externalId),
      deps: { searchPexels: async () => [px(1), px(2)] },
    })
    expect(r.photo?.externalId).toBe('2')
    used.add('2')
    const r2 = await findStockPhotoByChain('Wat Pho', {
      accept: (c) => !used.has(c.externalId),
      deps: { searchPexels: async () => [px(1), px(2)], searchUnsplash: async () => [], triggerDownload: async () => true },
    })
    expect(r2.photo).toBeNull()
  })
})

describe("재고 없을 때 AI 생성 — 'AI 생성 이미지' 표시", () => {
  it('그날 키워드(없으면 동선 첫 장소)로 실사풍 문장을 만들고, 장소가 없으면 null(사진 필요)', () => {
    const p = buildRegisterDayAiPhotoPrompt({ keyword: 'Wat Pho', destination: 'Bangkok' })
    expect(p).toMatch(/^Photorealistic travel photograph of Wat Pho, Bangkok/)
    expect(p).toMatch(/no text, no logo, no watermark/)
    expect(firstRoutePlaceForAiPhoto('방콕 수완나품 공항 - 호텔 체크인 - 왓 체디 루앙')).toBe('왓 체디 루앙')
    expect(buildRegisterDayAiPhotoPrompt({ keyword: 'day 3', routeText: '왓 체디 루앙', destination: '치앙마이' })).toMatch(/왓 체디 루앙, 치앙마이/)
    expect(buildRegisterDayAiPhotoPrompt({ keyword: '', routeText: '공항 - 호텔 체크인', destination: '방콕' })).toBeNull()
  })
  it('생성 사진에는 AI 표시 기록이 붙고 공개 화면이 AI 로 읽는다', () => {
    const label = dayPhotoAiLabel({ source: 'Gemini', url: 'https://cdn/x.webp' }, 'Photorealistic travel photograph of Wat Pho', 'Wat Pho')
    expect(label?.isGenerated).toBe(true)
    expect(label?.aiLabel).toBe(DAY_PHOTO_AI_LABEL_KO)
    expect(label?.promptRecorded).toBe('exact')
    expect(scheduleDayImageIsGenerated({ source: 'Gemini', ...label })).toBe(true)
    expect(dayPhotoAiLabel({ source: 'Pexels', url: 'https://images.pexels.com/1' }, null, 'Wat Pho')).toBeNull()
    expect(scheduleDayImageIsGenerated({ source: 'Pexels' })).toBe(false)
  })
})
