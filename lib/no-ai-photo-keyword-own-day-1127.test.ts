/**
 * PHOTO-RULES 2026-11-27 22:44 — 사진 출처에서 AI·Gemini 생성 제외(호출 0), 키워드는 그날 원문 고유명만.
 * REGRESSION-FREEZE[no-ai-photo-1127] / REGRESSION-FREEZE[photo-keyword-own-day-1127] — manifest
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

const geminiCalls = vi.hoisted(() => ({ n: 0 }))
vi.mock('@/lib/gemini-image-generate', () => ({
  generateImageWithGemini: async () => {
    geminiCalls.n++
    return Buffer.from('x')
  },
  IMAGEN_MODEL: 'test',
}))

import { acquireVerifiedPhoto, NO_REAL_PHOTO_NOTE, type AcquireDeps } from '@/lib/photo-autofill-acquire'
import { PublicPhotoUsage } from '@/lib/photo-autofill-gate'
import { deriveDaySights, scheduleOtherDaysText, scheduleRowSupplierText, stripTravelOnlySentences } from '@/lib/photo-autofill-sight'
import { englishFromScheduleKoreanSegmentWithRegex } from '@/lib/schedule-poi-regex-ssot'
import { generateGeminiFallbackImage } from '@/lib/itinerary-day-hero-image'

const root = process.cwd()
const src = (p: string) => readFileSync(join(root, p), 'utf8')

describe('사진 경로 이미지 생성 호출 0 (no-ai-photo-1127)', () => {
  it('자동 채움 live deps·대표사진 경로·일차 대표 보조 경로에 Gemini 이미지 생성 호출이 없다', () => {
    for (const f of ['lib/photo-autofill-live-deps.ts', 'app/api/travel/process-images/route.ts', 'lib/itinerary-day-hero-image.ts']) {
      expect(src(f), f).not.toMatch(/generateImageWithGemini\s*\(/)
      expect(src(f), f).not.toMatch(/from '@\/lib\/gemini-image-generate'/)
    }
    expect(src('lib/photo-autofill-live-deps.ts')).not.toMatch(/\n\s+generate:\s*async/)
  })

  it('일차 대표 보조 생성(generateGeminiFallbackImage)은 생성기를 부르지 않고 null', async () => {
    geminiCalls.n = 0
    const r = await generateGeminiFallbackImage({ prisma: {} as never, destination: 'Osaka', attractionName: 'Osaka Castle', promptLine: 'x' })
    expect(r).toBeNull()
    expect(geminiCalls.n).toBe(0)
  })

  it('생성 없이 실사진 출처를 다 돌고 못 찾으면 빈칸 + 실패 사유 + no_real_photo (생성 대상 아님)', async () => {
    const order: string[] = []
    const deps: AcquireDeps = {
      stockStopped: () => false,
      pause: async () => {},
      lookupPool: async () => {
        order.push('pool')
        return []
      },
      search: async (tier) => {
        order.push(tier)
        return []
      },
      searchCc0: async () => {
        order.push('cc0')
        return []
      },
      commit: async () => ({ ok: false, reason: 'x' }),
    }
    const r = await acquireVerifiedPhoto(
      { productId: 'p', kind: 'day', day: 2, sights: ['Osaka Castle'], cityTerms: ['osaka'], destinationText: 'osaka japan', usage: new PublicPhotoUsage(), origin: 'autofill' },
      deps,
    )
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.exception.reason).not.toBe('생성 대상')
    expect(r.exception.detail).toContain(NO_REAL_PHOTO_NOTE)
    expect(order).toEqual(expect.arrayContaining(['pool', 'pexels', 'cc0', 'unsplash']))
    expect(geminiCalls.n).toBe(0)
  })
})

describe('키워드는 그날 원문 고유명만 (photo-keyword-own-day-1127)', () => {
  const rows = [
    { day: 2, title: '교토 · 아라시야마', routeText: '교토 - 청수사 - 니넨자카 - 산넨자카 - 아라시야마', imageKeyword: 'Osaka Castle' },
    { day: 3, title: '오사카 · 가스가타이샤', routeText: '오사카 - 나라 - 오사카성 - 나라코엔 - 동대사 - 가스가타이샤', supplierOriginal: { items: [{ name: '오사카성' }] } },
  ]

  it('다른 일차 원문에 있는 명소 키워드(2일차 Osaka Castle ← 3일차 오사카성)는 쓰지 않고 그날 명소로 찾는다', () => {
    const d = deriveDaySights({ ...rows[0], otherDaysText: scheduleOtherDaysText(rows, 2), supplierText: scheduleRowSupplierText(rows[0]) }, 'osaka japan')
    expect(d.sights.some((s) => /osaka castle/i.test(s))).toBe(false)
    expect(d.rejectedKeywords).toEqual(expect.arrayContaining([{ keyword: 'Osaka Castle', why: 'not_in_route' }]))
  })

  it('그날 일정에 있는 명소 키워드(3일차 오사카성 → Osaka Castle)는 그대로 쓴다', () => {
    const d = deriveDaySights({ ...rows[1], imageKeyword: 'Osaka Castle', otherDaysText: scheduleOtherDaysText(rows, 3) }, 'osaka japan')
    expect(d.sights[0]).toBe('Osaka Castle')
  })

  it('사전에 없는 그날 고유명 키워드(금편계 → Golden Whip Stream)는 다른 일차에 없으면 그대로 쓴다', () => {
    const d = deriveDaySights(
      { title: '장가계 국립공원', routeText: '장가계', description: '금편계를 걷습니다', imageKeyword: 'Golden Whip Stream', otherDaysText: '천문산 - 유리잔도' },
      '장가계',
    )
    expect(d.sights.join(' ').toLowerCase()).toContain('golden whip')
  })

  it('공급사 원문 조각을 읽는다', () => {
    expect(scheduleRowSupplierText(rows[1])).toContain('오사카성')
    expect(scheduleOtherDaysText(rows, 2)).toContain('오사카성')
    expect(scheduleOtherDaysText(rows, 3)).not.toContain('오사카성')
  })
})

describe('103칸 시험 결과로 고친 키워드 판정 (photo-keyword-own-day-1127)', () => {
  it("'시즈오카에서 출발해 귀국' 같은 이동 문장·도시 이름은 근거가 아니다 → 후지산 키워드 대신 그날 시모다·호라이바시", () => {
    expect(stripTravelOnlySentences('시모다와 호라이바시를 둘러봅니다. 시즈오카에서 출발해 귀국합니다.')).not.toContain('시즈오카')
    const d = deriveDaySights(
      { title: '시모다 · 호라이바시', routeText: '시모다 - 호라이바시', description: '시모다와 호라이바시를 둘러봅니다. 시즈오카에서 출발해 귀국합니다.', imageKeyword: 'Mount Fuji Shizuoka' },
      'shizuoka japan',
    )
    expect(d.sights.join(' ')).not.toMatch(/Mount Fuji/i)
    expect(d.sights.join(' ')).toMatch(/Shimoda|Horai/)
    expect(d.rejectedKeywords.map((r) => r.keyword)).toContain('Mount Fuji Shizuoka')
  })

  it('장가계(도시 이름)만 맞은 국립삼림공원 키워드는 버리고 그날 대협곡을 쓴다', () => {
    const d = deriveDaySights(
      { title: '장가계 · 대협곡B코스', routeText: '장가계 - 대협곡B코스', description: '장가계에 도착합니다. 대협곡B코스를 둘러봅니다.', imageKeyword: 'Zhangjiajie National Forest Park' },
      'zhangjiajie china',
    )
    expect(d.sights[0]).toMatch(/Grand Canyon/)
  })

  it('도시 이름뿐인 키워드(Kobe)는 버리고 그날 명소(지진 메모리얼 파크)', () => {
    const d = deriveDaySights(
      { title: '나라 · 지진 메모리얼 파크', routeText: '나라 - 고베 - 지진 메모리얼 파크', description: '이어서 고베, 지진 메모리얼 파크도 방문합니다.', imageKeyword: 'Kobe' },
      'osaka japan',
    )
    expect(d.rejectedKeywords).toEqual(expect.arrayContaining([{ keyword: 'Kobe', why: 'city_only' }]))
    expect(d.sights[0]).toMatch(/Earthquake Memorial Park/)
  })

  it('공급사 원문의 이름 없는 머리글(하롱베이 - 하노이)·고속도로는 방문 근거가 아니다 → 탕롱 황성', () => {
    const row = {
      day: 4,
      title: '하노이 예술거리',
      routeText: '하노이-하롱베이 고속도로 - 탕롱 황성 (탕롱왕궁) - 하노이 예술거리',
      description: '하노이-하롱베이 고속도로와 탕롱 황성을 둘러봅니다. 하노이에서 출발해 귀국합니다.',
      imageKeyword: 'Halong Bay',
      supplierOriginal: { items: [{ name: null, text: '하롱베이' }, { name: null, text: '하롱베이 - 하노이' }, { name: '탕롱 황성 (탕롱왕궁)', text: '' }] },
    }
    expect(scheduleRowSupplierText(row as never)).not.toContain('하롱베이 - 하노이')
    const d = deriveDaySights({ ...row, supplierText: scheduleRowSupplierText(row as never) }, 'hanoi vietnam')
    expect(d.sights.join(' ')).not.toMatch(/Halong/i)
    expect(d.sights[0]).toMatch(/Thang Long/)
  })

  it('사전 오역 고침: 유후인≠유시엔(시마네), 황금 절벽 사원≠왓아룬(방콕), 파타야 니모섬=꼬창(사타힙)', () => {
    expect(englishFromScheduleKoreanSegmentWithRegex('유후인')).not.toMatch(/Yuushien|Shimane/)
    expect(englishFromScheduleKoreanSegmentWithRegex('황금 절벽 사원')).toMatch(/Khao Chi Chan/)
    expect(englishFromScheduleKoreanSegmentWithRegex('니모섬 스노클링')).toMatch(/Koh Chuang/)
  })

  it("섬 접두어(Koh)·묘사어(snorkeling)만 겹치면 같은 명소가 아니다 → 니모섬 날 'Koh Nang Yuan' 키워드는 맨 앞에 두지 않는다", () => {
    const d = deriveDaySights(
      { title: '니모섬 스노클링', routeText: '니모섬 스노클링', description: '니모섬 스노클링을 즐깁니다.', imageKeyword: 'Koh Nang Yuan Snorkeling' },
      'pattaya thailand',
    )
    expect(d.sights[0]).toMatch(/Koh Chuang/)
  })
})
