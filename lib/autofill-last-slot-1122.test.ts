/**
 * 11/22 16:30 실행 감사: 같은 상품 일차 중복(저장 단계가 기존 풀 파일을 돌려줌)·무기록 공백·하노이 귀국일 앙코르와트 회귀 고정.
 * REGRESSION-FREEZE[autofill-commit-own-dup-1122] / REGRESSION-FREEZE[autofill-silent-record-1122] / REGRESSION-FREEZE[travel-day-rep-city-named-1122] / REGRESSION-FREEZE[autofill-public-payload-rebuild-1122] — manifest
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { acquireVerifiedPhoto, type AcquireDeps } from '@/lib/photo-autofill-acquire'
import { PublicPhotoUsage, photoIdentityKeys, type AutofillCandidate } from '@/lib/photo-autofill-gate'
import { acquireOrRecordError, dayPolicyDropException } from '@/lib/autofill-silent-record-1122'
import { travelDayRepresentativeSights } from '@/lib/register-day-photo-travel-day'

const ROUTE = readFileSync('app/api/travel/process-images/route.ts', 'utf8')
const OWN_D8_SLOT2 = 'https://kr.object.ncloudstorage.com/bongtour/photo-pool/%EC%9C%A0%EB%9F%BD_%EC%9C%A0%EB%9F%BD_8_slot2_Pexels__mw0phagh.webp'

function cand(id: string): AutofillCandidate {
  return {
    id,
    source: 'Pexels',
    url: `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg`,
    width: 4000,
    height: 2600,
    photographer: 'Jane Doe',
    originalLink: `https://www.pexels.com/photo/buda-castle-budapest-${id}/`,
    altText: 'Buda Castle Budapest on the Danube',
    tags: [],
  }
}

function deps(storedUrlOf: (c: AutofillCandidate) => string): { deps: AcquireDeps; commits: string[] } {
  const commits: string[] = []
  return {
    commits,
    deps: {
      stockStopped: () => false,
      pause: async () => {},
      search: async (tier) => (tier === 'pexels' ? [cand('25583865'), cand('11111111')] : []),
      commit: async (c) => {
        commits.push(c.id)
        return { ok: true, url: storedUrlOf(c), bytes: 150_000, width: 1800, source: 'Pexels', photographer: 'Jane Doe', originalLink: c.originalLink ?? '', externalId: c.id }
      },
    },
  }
}

const input = (exclude: Set<string>) => ({
  productId: 'cmvmfmdt8008q3byyczs8w0k0',
  kind: 'day' as const,
  day: 9,
  sights: ['Buda Castle Budapest'],
  cityTerms: ['budapest'],
  destinationText: '부다페스트 budapest',
  usage: new PublicPhotoUsage(),
  exclude,
  origin: 'autofill' as const,
})

describe('저장 단계가 같은 상품 사진(기존 풀 파일)을 돌려주면 채택하지 않는다', () => {
  // d8 slot2 는 imageSource2 가 없어 주소 키만 제외 목록에 있다. 후보 id(25583865)는 제외 목록에 없다.
  const exclude = new Set(photoIdentityKeys({ url: OWN_D8_SLOT2 }))

  it('cmvmf 9일차: 기존 d8 slot2 파일이 돌아오면 버리고 다음 후보를 쓴다', async () => {
    const { deps: d, commits } = deps((c) => (c.id === '25583865' ? OWN_D8_SLOT2 : `https://kr.object.ncloudstorage.com/bongtour/photo-pool/new_${c.id}.webp`))
    const res = await acquireVerifiedPhoto(input(exclude), d)
    expect(commits).toEqual(['25583865', '11111111'])
    expect(res.ok).toBe(true)
    if (res.ok) expect(res.photo.url).not.toBe(OWN_D8_SLOT2)
    expect(res.tried.some((t) => t.reasons.includes('excluded_after_commit'))).toBe(true)
  })

  it('남은 후보가 없으면 같은 사진으로 채우지 않고 예외(excluded)로 남긴다', async () => {
    const { deps: d } = deps(() => OWN_D8_SLOT2)
    const res = await acquireVerifiedPhoto(input(exclude), d)
    expect(res.ok).toBe(false)
    if (!res.ok) {
      expect(res.skipped).toBe(false)
      expect(res.exception.reason).toBe('excluded')
    }
  })
})

describe('strict 일차 칸은 기록 없이 비지 않는다', () => {
  const ctx = { productId: 'cmv4sm79i0df7vfap23v62f99', day: 2, kind: 'day' as const, sight: 'Halong Bay', origin: 'autofill' as const }

  it('찾기 중 예외 → 이 칸만 acquire_error 예외(상품 전체 500 아님), 주소는 남기지 않는다', async () => {
    const res = await acquireOrRecordError(async () => {
      throw new TypeError('fetch failed https://images.pexels.com/photos/1/a.jpeg?key=abc')
    }, ctx)
    expect(res.ok).toBe(false)
    if (!res.ok) {
      expect(res.skipped).toBe(false)
      expect(res.exception.reason).toBe('acquire_error')
      expect(res.exception.day).toBe(2)
      expect(res.exception.detail).not.toMatch(/https?:|key=/)
    }
  })

  it('정상 결과는 그대로 돌려준다', async () => {
    const { deps: d } = deps((c) => `https://kr.object.ncloudstorage.com/bongtour/photo-pool/new_${c.id}.webp`)
    const res = await acquireOrRecordError(() => acquireVerifiedPhoto(input(new Set()), d), ctx)
    expect(res.ok).toBe(true)
  })

  it('정책 탈락 예외 사유', () => {
    expect(dayPolicyDropException(ctx, ['low_res', 'over_bytes']).reason).toBe('day_policy:low_res,over_bytes')
  })

  it('route: strict 일차 찾기를 감싸고, 정책 탈락도 예외로 남긴다', () => {
    expect(ROUTE).toMatch(/acquireOrRecordError\(\(\) => acquireVerifiedPhoto\(/)
    expect(ROUTE).toMatch(/if \(strictAutofill\) \{\s*await strictRecord\(\s*dayPolicyDropException\(/)
  })
})

describe('여러 도시 묶음의 귀국일 대표 명소는 그 도시 것만', () => {
  // cmv4sm79i 4일차(하노이 귀국): 하노이·시엠립 묶음에서 앙코르와트가 뽑히던 것
  const rows = [
    { day: 1, title: '하노이 · 하롱베이 유명카페', routeText: '하노이 - 하노이 시티 - 예술거리 & 롱비엔 기차역 - 하롱베이 유명카페', imageKeyword: 'Long Bien Bridge', imageUrl: 'https://x/1' },
    { day: 2, title: '하롱베이 데이크루즈 · 15:00 선덱', routeText: '하롱베이 데이크루즈 - 11:30 티톱섬 전망대', imageKeyword: 'Halong Bay', imageUrl: null },
    { day: 3, title: '옌뜨 · 하노이', routeText: '하롱베이 - 옌뜨 - 하노이 - 성요셉성당', imageKeyword: 'Hoan Kiem Lake', imageUrl: 'https://x/3' },
    { day: 4, title: '하노이', description: '하노이에서 일정을 마무리한 뒤 귀국 이동으로 이어갑니다.', routeText: '하노이', imageKeyword: 'Hanoi', imageUrl: null },
  ]

  it('하노이 귀국일: 앙코르·시엠립 명소 없음, 하노이 명소만', () => {
    const rep = travelDayRepresentativeSights(rows[3]!, rows, '하노이', 4)
    expect(rep?.city).toBe('Hanoi')
    expect(rep!.sights.length).toBeGreaterThan(0)
    for (const s of rep!.sights) {
      expect(s).not.toMatch(/angkor|siem reap|ta prohm|bayon|cambodia/i)
      expect(s).toMatch(/hanoi/i)
    }
  })

  it('도시 이름이 든 명소가 없는 묶음은 전과 같이 묶음 전체를 쓴다', () => {
    const r = [
      { day: 1, title: '인천 출발 · 바르셀로나', routeText: '인천 출발 - 바르셀로나', imageKeyword: 'Barcelona', imageUrl: null },
      { day: 2, title: '바르셀로나', routeText: '바르셀로나 - 사그라다 파밀리아', imageKeyword: 'Sagrada Familia', imageUrl: 'https://x/2' },
    ]
    const rep = travelDayRepresentativeSights(r[0]!, r, '스페인', 2)
    expect(rep?.city).toBe('Barcelona')
    expect(rep!.sights.length).toBeGreaterThan(0)
  })
})

describe('공개 상품 칸을 채우면 상세 payload 를 다시 만든다', () => {
  // 16:30 실행 뒤 pkg-yb-0040·pkg-ky-0020·pkg-ky-0024·pkg-yb-0133 상세가 publicDetailPayloadJson(채우기 전 빌드)을 그대로 보여 줌
  const JOB = readFileSync('lib/register-auto-photo-register-job.ts', 'utf8')
  it('채움 성공(filled>0) 블록에서 공개 행이면 revalidateProductDetailCaches 를 부른다', () => {
    const i = JOB.indexOf("result.filled += filledCount")
    expect(i).toBeGreaterThan(0)
    const block = JOB.slice(i, i + 600)
    expect(block).toMatch(/if \(row\.publicRow\) \{[\s\S]*revalidateProductDetailCaches\(id\)/)
  })
})
