/**
 * REGRESSION-FREEZE[r03-25-26-source-1128]: 사장님 2026-11-28 20:13 "난 봉투어에 위키피아 사진 넣지 않는다",
 * 20:16 "Unsplash 자동 채움에서 빼" (R03-25·R03-26).
 * 자동 경로에서 Unsplash·Wikimedia 검색 호출 없음. Openverse 는 excluded_source=wikimedia + 응답 재필터.
 * 새 저장 후보만 거부. 기존 칸 정책 재판정(틀린 칸)으로 바꾸지 않음 — manifest
 */
import { describe, expect, it, vi } from 'vitest'
import { acquireVerifiedPhoto, type AcquireDeps, type AcquireInput } from '@/lib/photo-autofill-acquire'
import { buildPublicPhotoUsage, evaluateAutofillCandidate, type AutofillCandidate } from '@/lib/photo-autofill-gate'
import { isBlockedAutoFillOrigin } from '@/lib/photo-autofill-blocked-origin'
import {
  OPENVERSE_EXCLUDED_SOURCE,
  __resetOpenverseForTest,
  openverseRowsToCandidates,
  searchNoAttributionCc0,
  searchOpenverseCc0,
} from '@/lib/photo-autofill-openverse'
import { evaluateImageCandidatePolicy } from '@/lib/product-image-source-policy'
import { checkDayPhotoPolicy } from '@/lib/register-day-photo-policy'
import { WRONG_PHOTO_REPLACE_REASONS } from '@/lib/register-photo-registration-gate'

const sight = { name: 'Blue Mosque', phraseTerms: ['blue mosque'], slugTerms: ['blue-mosque'], compactTerms: ['bluemosque'] }

function cand(over: Partial<AutofillCandidate> = {}): AutofillCandidate {
  return {
    id: 'c1',
    source: 'Pexels',
    url: 'https://images.pexels.com/photos/1/a.jpeg',
    width: 2000,
    height: 1300,
    photographer: 'Jane',
    originalLink: 'https://www.pexels.com/photo/blue-mosque-1/',
    altText: 'Blue Mosque in Istanbul',
    tags: [],
    ...over,
  }
}

function input(): AcquireInput {
  return {
    productId: 'p1',
    kind: 'day',
    day: 1,
    sights: ['Blue Mosque'],
    cityTerms: ['Istanbul'],
    destinationText: 'Istanbul Turkey',
    usage: buildPublicPhotoUsage([]),
    origin: 'autofill',
  }
}

describe('r03-25-26 blocked origin helper', () => {
  it('Unsplash·Wikimedia·CC BY 는 막고 Pexels·Pixabay·비위키 Openverse CC0 는 허용한다', () => {
    expect(isBlockedAutoFillOrigin({ source: 'Unsplash', url: 'https://images.unsplash.com/photo-1', originalLink: 'https://unsplash.com/photos/x' }).reason).toBe('unsplash')
    expect(isBlockedAutoFillOrigin({ source: 'CC0', url: 'https://upload.wikimedia.org/wikipedia/commons/a.jpg', originalLink: 'https://commons.wikimedia.org/wiki/File:A.jpg' }).reason).toBe('wikimedia')
    expect(isBlockedAutoFillOrigin({ source: 'CC0', originalLink: 'https://en.wikipedia.org/wiki/File:A.jpg' }).reason).toBe('wikimedia')
    expect(isBlockedAutoFillOrigin({ source: 'CC0', description: 'CC BY-SA 4.0', license: 'by-sa' }).reason).toBe('cc_by')
    expect(isBlockedAutoFillOrigin({ source: 'Pexels', url: 'https://images.pexels.com/photos/1/a.jpeg', originalLink: 'https://www.pexels.com/photo/x/' }).blocked).toBe(false)
    expect(isBlockedAutoFillOrigin({ source: 'Pixabay', url: 'https://pixabay.com/get/a.jpg', originalLink: 'https://pixabay.com/photos/blue-mosque-1/' }).blocked).toBe(false)
    expect(isBlockedAutoFillOrigin({ source: 'CC0', url: 'https://live.staticflickr.com/1/a.jpg', originalLink: 'https://openverse.org/image/abcd' }).blocked).toBe(false)
  })
})

describe('r03-25-26 Openverse excluded_source + response refilter', () => {
  it('공식 파라미터 excluded_source 값은 wikimedia 이다', () => {
    expect(OPENVERSE_EXCLUDED_SOURCE).toBe('wikimedia')
  })
  it('요청 URL 에 excluded_source=wikimedia 와 license=cc0,pdm 이 들어간다', async () => {
    __resetOpenverseForTest()
    const fetchImpl = vi.fn(async (url: string) => {
      expect(String(url)).toContain('excluded_source=wikimedia')
      expect(String(url)).toContain('license=cc0%2Cpdm')
      return new Response(JSON.stringify({ results: [] }), { status: 200, headers: { 'content-type': 'application/json' } })
    }) as unknown as typeof fetch
    await searchOpenverseCc0('Blue Mosque', 15, fetchImpl)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })
  it('응답 source·provider·url·foreign_landing_url 이 wikimedia/wikipedia 이면 버린다', () => {
    const rows = openverseRowsToCandidates({
      results: [
        { id: 'ok', url: 'https://live.staticflickr.com/1/ok.jpg', width: 2000, height: 1200, license: 'cc0', source: 'flickr', provider: 'flickr', foreign_landing_url: 'https://openverse.org/image/ok' },
        { id: 's', url: 'https://example.org/s.jpg', width: 2000, height: 1200, license: 'cc0', source: 'wikimedia', provider: 'flickr' },
        { id: 'p', url: 'https://example.org/p.jpg', width: 2000, height: 1200, license: 'cc0', source: 'flickr', provider: 'wikimedia' },
        { id: 'u', url: 'https://upload.wikimedia.org/wikipedia/commons/a.jpg', width: 2000, height: 1200, license: 'cc0', source: 'flickr', provider: 'flickr' },
        { id: 'l', url: 'https://example.org/l.jpg', width: 2000, height: 1200, license: 'cc0', source: 'flickr', foreign_landing_url: 'https://commons.wikimedia.org/wiki/File:A.jpg' },
        { id: 'by', url: 'https://example.org/by.jpg', width: 2000, height: 1200, license: 'by-sa', source: 'flickr' },
      ],
    })
    expect(rows.map((r) => r.id)).toEqual(['ov-ok'])
  })
  it('searchNoAttributionCc0 는 commons.wikimedia.org 를 호출하지 않는다', async () => {
    __resetOpenverseForTest()
    const urls: string[] = []
    const fetchImpl = vi.fn(async (url: string) => {
      urls.push(String(url))
      return new Response(JSON.stringify({ results: [] }), { status: 200, headers: { 'content-type': 'application/json' } })
    }) as unknown as typeof fetch
    await searchNoAttributionCc0('Blue Mosque', 15, fetchImpl)
    expect(urls.length).toBe(1)
    expect(urls[0]).toContain('api.openverse.org')
    expect(urls.some((u) => /(?:commons\.|upload\.)?wikimedia\.org|wikipedia\.org/i.test(new URL(u).host))).toBe(false)
    expect(String(urls[0])).toContain('excluded_source=wikimedia')
  })
})

describe('r03-25-26 acquire 자동 경로 호출 단언', () => {
  it('Pexels 살아 있을 때 unsplash 검색을 호출하지 않고 pixabay → cc0 순이다', async () => {
    const order: string[] = []
    const deps: AcquireDeps = {
      stockStopped: () => false,
      pause: async () => {},
      search: async (tier) => {
        order.push(tier)
        return []
      },
      searchCc0: async () => {
        order.push('cc0')
        return []
      },
      commit: async (c) => ({ ok: true, url: c.url, bytes: 150_000, width: c.width, source: c.source, photographer: String(c.photographer), originalLink: String(c.originalLink), externalId: c.id }),
      isMonochrome: async () => false,
    }
    await acquireVerifiedPhoto(input(), deps)
    expect(order).not.toContain('unsplash')
    expect(order.indexOf('pexels')).toBeLessThan(order.indexOf('pixabay'))
    expect(order.indexOf('pixabay')).toBeLessThan(order.indexOf('cc0'))
  })
})

describe('r03-25-26 새 후보 게이트 vs 기존 칸 재판정', () => {
  it('새 자동 채움 후보는 Unsplash·Wikimedia 를 blocked_auto_source 로 거절한다', () => {
    const u = evaluateAutofillCandidate({
      candidate: cand({ source: 'Unsplash', url: 'https://images.unsplash.com/photo-1', originalLink: 'https://unsplash.com/photos/blue-mosque-1' }),
      sight,
      cityTerms: ['Istanbul'],
      slotText: 'Blue Mosque Istanbul',
      usage: buildPublicPhotoUsage([]),
    })
    expect(u.ok).toBe(false)
    expect(u.reasons).toContain('blocked_auto_source')
    const w = evaluateAutofillCandidate({
      candidate: cand({
        source: 'CC0',
        url: 'https://upload.wikimedia.org/wikipedia/commons/a.jpg',
        originalLink: 'https://commons.wikimedia.org/wiki/File:Blue_Mosque.jpg',
      }),
      sight,
      cityTerms: ['Istanbul'],
      slotText: 'Blue Mosque Istanbul',
      usage: buildPublicPhotoUsage([]),
    })
    expect(w.ok).toBe(false)
    expect(w.reasons).toContain('blocked_auto_source')
  })
  it('이미 저장된 Unsplash(크레딧 있음)·Wikimedia CC0 일차는 기존 정책으로 통과하고, 출처만으로 틀린 칸이 되지 않는다', () => {
    const unsplashPol = evaluateImageCandidatePolicy({
      url: 'https://images.unsplash.com/photo-1',
      source: 'unsplash',
      photographer: 'Ada',
      authorProfileUrl: 'https://unsplash.com/@ada',
      originalLink: 'https://unsplash.com/@ada',
      width: 2000,
    } as never)
    expect(unsplashPol.pass).toBe(true)
    const wikiDay = checkDayPhotoPolicy({
      url: 'https://cdn.example.com/photo-pool/a.webp',
      source: 'CC0',
      photographer: 'x',
      originalLink: 'https://commons.wikimedia.org/wiki/File:Blue_Mosque.jpg',
      width: 2000,
      bytes: 200_000,
    })
    expect(wikiDay.ok).toBe(true)
    // 틀린 칸 교체 사유에 출처 금지를 넣지 않아, 기존 Unsplash·Wikimedia 칸이 출처만으로 일괄 교체되지 않는다
    expect([...WRONG_PHOTO_REPLACE_REASONS]).not.toContain('blocked_auto_source')
    expect([...WRONG_PHOTO_REPLACE_REASONS].join(' ')).not.toMatch(/unsplash|wikimedia|cc_by|blocked_auto/i)
  })
})
