import { describe, expect, it } from 'vitest'
import { extractYbtourVerbatimListingTitle } from '@/lib/register-ybtour-basic'

const APF3067_LISTING =
  '세부 3박5일 #제이파크 아일랜드 #디럭스가든뷰 #자유여행 #워터파크 #아동반값 #제주항공'
const APF3067_OG =
  '필리핀 세부 4/5/6일 #제이파크아일랜드 #디럭스가든뷰 #자유여행 #에어텔'

describe('extractYbtourVerbatimListingTitle', () => {
  it('APF3067 FIT — 상품번호 다음 리스트 한 줄(해시 다수) 우선', () => {
    const paste = `상품번호APF3067-2610127C00
4.4/5 (리뷰 9건)
${APF3067_LISTING}
출발`
    expect(extractYbtourVerbatimListingTitle(paste)).toBe(APF3067_LISTING)
  })

  it('og:title 한 줄만 있어도 해시 1개+박일이면 추출', () => {
    const paste = `상품번호 APF3067
${APF3067_OG}
포함사항`
    expect(extractYbtourVerbatimListingTitle(paste)).toBe(APF3067_OG)
  })

  it('리스트·og 동시 — 해시·박일 신호가 강한 리스트 줄 선택', () => {
    const paste = `상품번호APF3067
${APF3067_OG}
${APF3067_LISTING}`
    expect(extractYbtourVerbatimListingTitle(paste)).toBe(APF3067_LISTING)
  })

  it('해시 1개 + 3박5일 자유여행 (FIT 단일 해시)', () => {
    const line = '#푸켓 3박5일 자유여행 #메리어트 호텔'
    const paste = `상품번호 EWP1234\n${line}\n포함`
    expect(extractYbtourVerbatimListingTitle(paste)).toBe(line)
  })

  it('해시 없음 — null (LLM 폴백)', () => {
    const paste = `상품번호 APF3067\n푸켓 자유여행 메리어트\n포함`
    expect(extractYbtourVerbatimListingTitle(paste)).toBeNull()
  })
})
