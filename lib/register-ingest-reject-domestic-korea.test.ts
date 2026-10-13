/**
 * REGRESSION-FREEZE[register-ingest-reject-domestic-korea]: 국내 패키지·골프·당일 수집 금지 — manifest
 */
import { describe, expect, it } from 'vitest'
import { isRegisterIngestDomesticKoreaProduct } from '@/lib/register-ingest-reject-domestic-korea'

describe('register-ingest-reject-domestic-korea', () => {
  it('rejects clear domestic packages and day trips', () => {
    expect(
      isRegisterIngestDomesticKoreaProduct(
        '[로얄시그니처] 제주 3일#노팁&노쇼핑&노옵션 #프리미엄여행#그랜드하얏트',
      ),
    ).toBe(true)
    expect(
      isRegisterIngestDomesticKoreaProduct('강원 고성 1일 #DMZ평화의길 #화진포 #청간정 #능파대', '강원'),
    ).toBe(true)
    expect(
      isRegisterIngestDomesticKoreaProduct(
        '거문도 2일 #KTX #백도유람선 #온돌민박 #회정식/게장정식',
        '거문도',
      ),
    ).toBe(true)
    expect(isRegisterIngestDomesticKoreaProduct('충북 제천 골프 2일 #36홀 #세레니티CC')).toBe(true)
    expect(isRegisterIngestDomesticKoreaProduct('강원 원주 골프 2일 #동강시스타CC')).toBe(true)
    // REGRESSION-FREEZE[register-ingest-reject-domestic-korea]: 화천·충북·백령·대청도 당일 — manifest
    expect(
      isRegisterIngestDomesticKoreaProduct(
        '[부산출발] 강원/화천 1일 #DMZ평화의길 #파로호보트 #평화의댐 #거례리수목공원',
        '강원',
      ),
    ).toBe(true)
    expect(
      isRegisterIngestDomesticKoreaProduct(
        '[연합상품] 옥천/청주/보은 2일 #충북웰니스 #수생식물학습원 #법주사 #청남대',
        '수생식물학습원 · 부소담악 외',
      ),
    ).toBe(true)
    expect(
      isRegisterIngestDomesticKoreaProduct(
        '[연합상품]청주/대전 당일 #대청호 #청남대 #계족산황톳길 #명상정원',
      ),
    ).toBe(true)
    // REGRESSION-FREEZE[register-ingest-reject-domestic-korea]: 대청도≠중국 청도 — manifest
    expect(
      isRegisterIngestDomesticKoreaProduct(
        '[연합상품][인천항] 백령도,대청도 3일 #두무진유람선 #국가지질명소탐방',
        '백령도',
      ),
    ).toBe(true)
    // REGRESSION-FREEZE[register-ingest-reject-domestic-korea]: countryKey korea 차단 — manifest
    expect(isRegisterIngestDomesticKoreaProduct('아무 제목', null, 'korea')).toBe(true)
  })

  it('keeps overseas even with 제주항공 or 부산출발', () => {
    expect(
      isRegisterIngestDomesticKoreaProduct(
        '보홀 5일 #제주항공#솔레아OR돌핀베이#발리카삭호핑#알로나비치불쇼',
      ),
    ).toBe(false)
    expect(
      isRegisterIngestDomesticKoreaProduct(
        '부산출발 괌 5일 #진에어 #성인2+소인2필수 #PIC리조트 #골드패스',
      ),
    ).toBe(false)
    expect(
      isRegisterIngestDomesticKoreaProduct(
        '부산출발 나트랑/달랏 5일 #노팁,노옵션 #전일정5성호텔',
      ),
    ).toBe(false)
    expect(
      isRegisterIngestDomesticKoreaProduct(
        '[부산출발] 방콕 골프 5일 #골프텔 #36홀*3회 #아티타야CC',
      ),
    ).toBe(false)
    expect(
      isRegisterIngestDomesticKoreaProduct(
        '백두산(북파+서파)/장춘 4일 #하나투어단독_자작나무 미니트레킹',
      ),
    ).toBe(false)
  })
})
