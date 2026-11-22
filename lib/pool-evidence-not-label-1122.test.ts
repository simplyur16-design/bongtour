/**
 * 사진 풀 이름표 신뢰로 생긴 다른 곳 사진·같은 상품 중복 회귀 고정(11/22 DB 실사례).
 * REGRESSION-FREEZE[pool-evidence-not-label-1122] — manifest
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { poolCandidateEvidence, sourcePageEvidenceText } from '@/lib/photo-pool-evidence-1122'
import { evaluateAutofillCandidate, PublicPhotoUsage, type AutofillCandidate } from '@/lib/photo-autofill-gate'
import { sightProfile } from '@/lib/photo-autofill-sight'

type Row = { attractionName: string; cityName: string; source: string; photographer: string | null; sourceUrl: string | null; sourcePhotoId: string | null }

/** live-deps lookupPool 과 같은 방식으로 풀 행 → 후보 */
function poolCand(row: Row): AutofillCandidate | null {
  const evidence = poolCandidateEvidence(row)
  if (!evidence) return null
  return {
    id: String(row.sourcePhotoId || 'pool-row'),
    source: 'PhotoPool',
    url: 'https://kr.object.ncloudstorage.com/bongtour/photo-pool/x.webp',
    width: 1920,
    height: 1280,
    photographer: row.photographer,
    originalLink: row.sourceUrl,
    altText: evidence,
    title: null,
  }
}

function gate(c: AutofillCandidate, sight: string, slotText: string, city: string[]) {
  return evaluateAutofillCandidate({ candidate: c, sight: sightProfile(sight), cityTerms: city, slotText, slotKind: 'day', productId: 'p', usage: new PublicPhotoUsage() })
}

// 5칸: 풀 이름표 = 그날 명소, 원본 주소 = 다른 곳(보충 저장이 검색 결과를 검색어 이름표로 저장)
const WRONG_PLACE: Array<{ slot: string; sight: string; slot_text: string; city: string[]; row: Row }> = [
  { slot: 'cmtb01 1일차', sight: 'Iolani Palace', slot_text: '호놀룰루 국제공항 - 이올라니 궁전 - 듀크스 와이키키 호놀룰루 Honolulu', city: ['honolulu'],
    row: { attractionName: 'Iolani Palace', cityName: '호놀룰루', source: 'Pexels', photographer: 'Pramod  Tiwari', sourceUrl: 'https://www.pexels.com/photo/majestic-view-of-neemrana-fort-palace-in-rajasthan-33797768/', sourcePhotoId: '33797768' } },
  { slot: 'cmtd30 3일차', sight: 'Ruins of St Paul', slot_text: '성 바울 성당 유적 - 세나두 광장 마카오 Macau', city: ['macau'],
    row: { attractionName: 'Ruins of St Paul', cityName: '홍콩 Hong Kong', source: 'Pexels', photographer: 'Mahmoud Yahyaoui', sourceUrl: 'https://www.pexels.com/photo/bulla-regia-s-archology-site-wallpaper-28121489/', sourcePhotoId: '28121489' } },
  { slot: 'cmteg7 4일차', sight: 'Gandantegchinlen Monastery', slot_text: '캠프 조식 후 울란바토르 - 생노민사원 - 칭기스칸광장 Ulaanbaatar', city: ['ulaanbaatar'],
    row: { attractionName: 'Gandantegchinlen Monastery', cityName: '울란바타르', source: 'Pexels', photographer: 'Lexi Lauwers', sourceUrl: 'https://www.pexels.com/photo/scenic-view-of-meteora-monastery-on-rocky-cliff-38529175/', sourcePhotoId: '38529175' } },
  { slot: 'cmv3pi 3일차', sight: 'Coogee Beach', slot_text: '뉴캐슬 - 스탁톤 비치 - 포트스테판 호주', city: [],
    row: { attractionName: 'Coogee Beach', cityName: '호주/뉴질랜드', source: 'Pexels', photographer: 'Yulius Santoso', sourceUrl: 'https://www.pexels.com/photo/captivating-sunrise-at-bronte-ocean-pool-30975492/', sourcePhotoId: '30975492' } },
]

describe('풀 후보는 이름표가 아니라 원본 주소 설명으로 명소를 확인한다', () => {
  it.each(WRONG_PLACE)('$slot: 이름표=$sight 이어도 원본이 다른 곳이면 탈락', ({ sight, slot_text, city, row }) => {
    const c = poolCand(row)!
    expect(c).not.toBeNull()
    expect(c.altText).not.toMatch(new RegExp(sight, 'i'))
    const v = gate(c, sight, slot_text, city)
    expect(v.ok).toBe(false)
    expect(v.reasons).toContain('no_sight_match')
  })

  it('cmq6 2일차: 원본 주소가 작가 프로필(설명 없음)인 풀 행은 확인 불가 → 후보에서 뺀다(벨베데레 이름표의 슈테판 성당 사진)', () => {
    expect(
      poolCand({ attractionName: '벨베데레 궁전 상궁 Belvedere Palace · 비엔나 카페', cityName: '벨베데레 궁전 상궁 Belvedere Palace · 비엔나 카페', source: 'Unsplash', photographer: 'Aurora Song', sourceUrl: 'https://unsplash.com/@auroras13', sourcePhotoId: 'P-safFCok50' }),
    ).toBeNull()
  })

  it('공용 이름표 파일(유럽_8_slot2)은 이름표로 통과하지 않고 원본 설명으로만 판단(cmvmf 8일차 어부의 요새 ← 부다 성 스케치 사진)', () => {
    const c = poolCand({ attractionName: '유럽_8_slot2', cityName: '유럽', source: 'Pexels', photographer: 'Vish Pix', sourceUrl: 'https://www.pexels.com/photo/person-sketching-buda-castle-25583865/', sourcePhotoId: '25583865' })!
    expect(c.altText).toBe('person sketching buda castle')
    const v = gate(c, 'Fisherman Bastion', '부다페스트 - 마챠시 교회 - 어부의 요새 - 영웅 광장 Budapest', ['budapest'])
    expect(v.ok).toBe(false)
    expect(v.reasons).toContain('no_sight_match')
  })

  it('원본 주소가 없는 공용 이름표 풀 행은 확인 불가 → 후보에서 뺀다', () => {
    expect(poolCand({ attractionName: '세부_4_slot2', cityName: '세부', source: 'Pexels', photographer: 'x', sourceUrl: null, sourcePhotoId: '1' })).toBeNull()
  })

  it('원본 설명이 그 명소면 풀 재사용은 그대로 통과(하롱베이)', () => {
    const c = poolCand({ attractionName: 'Halong Bay', cityName: '하노이', source: 'Pexels', photographer: 'Valeria Drozdova', sourceUrl: 'https://www.pexels.com/photo/scenic-view-of-limestone-islands-in-halong-bay-38116441/', sourcePhotoId: '38116441' })!
    const v = gate(c, 'Halong Bay', '하롱베이 데이크루즈 - 티톱섬 전망대 하노이 Hanoi', ['hanoi'])
    expect(v.ok).toBe(true)
  })

  it('생성 이미지는 그 명소 문장으로 만든 것이라 이름표를 설명으로 쓴다', () => {
    expect(poolCandidateEvidence({ attractionName: 'SONBERK', source: 'AI 생성', sourceUrl: null })).toBe('SONBERK')
    expect(poolCandidateEvidence({ attractionName: 'SONBERK', source: 'Gemini', sourceUrl: null })).toBe('SONBERK')
  })

  it('원본 주소 slug 읽기', () => {
    expect(sourcePageEvidenceText('https://www.pexels.com/photo/majestic-view-of-neemrana-fort-palace-in-rajasthan-33797768/')).toBe('majestic view of neemrana fort palace in rajasthan')
    expect(sourcePageEvidenceText('https://unsplash.com/photos/a-castle-on-a-hill-AbCdEfGhIjK')).toBe('a castle on a hill')
    expect(sourcePageEvidenceText('https://unsplash.com/@auroras13')).toBe('')
    expect(sourcePageEvidenceText('https://commons.wikimedia.org/wiki/File:Iolani_Palace_(Honolulu).jpg')).toBe('Iolani Palace (Honolulu)')
    expect(sourcePageEvidenceText(null)).toBe('')
    expect(sourcePageEvidenceText('not a url')).toBe('')
  })

  it('live-deps: 풀 후보 설명은 evidence, 이름표·도시 이름표는 쓰지 않고, 보충 저장도 원본 설명이 그 명소일 때만', () => {
    const src = readFileSync('lib/photo-autofill-live-deps.ts', 'utf8')
    expect(src).toMatch(/const evidence = poolCandidateEvidence\(row\)\s*\n\s*if \(!evidence\) continue/)
    expect(src).toMatch(/altText: evidence,\s*\n\s*title: null,/)
    expect(src).not.toMatch(/altText: \[row\.attractionName, row\.cityName\]/)
    expect(src).toMatch(/if \(!sightMatchInText\(sightProfile\(sight\), sourcePageEvidenceText\(c\.originalLink\)\)\) return false/)
  })
})
