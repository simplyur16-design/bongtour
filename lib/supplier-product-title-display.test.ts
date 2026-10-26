import { describe, expect, it } from 'vitest'
import {
  buildSupplierProductDisplayTitle,
  normalizeSupplierRegisterListingTitle,
  resolveSupplierVerbatimOriginalTitle,
  stripSupplierTitlePromoBadges,
  stripSupplierTitleUiNoise,
  SUPPLIER_PRODUCT_TITLE_DISPLAY_POLICY_VERSION,
} from '@/lib/supplier-product-title-display'

describe('SUPPLIER_PRODUCT_TITLE_DISPLAY_POLICY_VERSION', () => {
  it('is plan-b-v5', () => {
    expect(SUPPLIER_PRODUCT_TITLE_DISPLAY_POLICY_VERSION).toMatch(/^plan-b-v5/)
  })
})

describe('resolveSupplierVerbatimOriginalTitle', () => {
  it('keeps hangul place-name titles of two or more syllables', () => {
    expect(
      resolveSupplierVerbatimOriginalTitle({
        parsedSupplierTitle: '이태리',
        supplierListingTitleRaw: '이태리',
        brandKey: 'naeiltour',
      }),
    ).toBe('이태리')
    expect(
      buildSupplierProductDisplayTitle({
        verbatimOriginal: '이태리 금까기',
        brandKey: 'naeiltour',
      }),
    ).toBe('이태리')
  })

  it('prefers supplierListingTitleRaw when long enough', () => {
    expect(
      resolveSupplierVerbatimOriginalTitle({
        parsedSupplierTitle: '짧음',
        supplierListingTitleRaw: '코카서스 3국 10일 KE #두바이관광',
      }),
    ).toBe('코카서스 3국 10일 KE #두바이관광')
  })
})

describe('buildSupplierProductDisplayTitle', () => {
  it('keeps destination brackets and 노쇼핑/노옵션; strips star noise only', () => {
    const title = buildSupplierProductDisplayTitle({
      verbatimOriginal: '★[동유럽] 체코·헝가리 9일 [무쇼핑] #노팁노옵션 #일급호텔',
      brandKey: 'hanatour',
    })
    expect(title).toContain('[동유럽]')
    expect(title).toContain('#일급호텔')
    expect(title).toContain('[무쇼핑]')
    expect(title).toContain('#노팁노옵션')
    expect(title).not.toContain('★')
  })

  it('strips 출발확정 and 긴급모객 badges', () => {
    const title = buildSupplierProductDisplayTitle({
      verbatimOriginal: '★[출발확정] 베트남 5일 [긴급모객]',
      brandKey: 'lottetour',
    })
    expect(title).toContain('베트남 5일')
    expect(title).not.toMatch(/출발\s*확정|긴급\s*모객/)
  })

  it('strips 매진임박 and best badges for all suppliers', () => {
    expect(normalizeSupplierRegisterListingTitle('[매진임박][best] 나트랑 5박6일')).toBe('나트랑 5박6일')
  })

  it('strips hanatour/modetour promo brackets but keeps region and schedule tags', () => {
    expect(
      normalizeSupplierRegisterListingTitle('[출발확정] 홍콩/마카오 3일 #베스트셀러'),
    ).toBe('홍콩/마카오 3일')
    expect(normalizeSupplierRegisterListingTitle('[스테디셀러] 홍콩+마카오 핵심투어 2박4일')).toBe(
      '홍콩+마카오 핵심투어 2박4일',
    )
    expect(normalizeSupplierRegisterListingTitle('[다낭] #바나힐 3박 5일')).toBe('[다낭] #바나힐 3박 5일')
    expect(normalizeSupplierRegisterListingTitle('[오전출발-휴양형] 다낭/호이안 3박5일')).toBe(
      '[오전출발-휴양형] 다낭/호이안 3박5일',
    )
  })

  it('keeps [직항] and non-promo hashtags', () => {
    const title = buildSupplierProductDisplayTitle({
      verbatimOriginal: '일본 도쿄 3일 [직항] #두바이관광',
      brandKey: 'hanatour',
    })
    expect(title).toContain('일본 도쿄 3일')
    expect(title).toContain('#두바이관광')
    expect(title).toContain('[직항]')
  })

  it('does not collapse to city+duration marketing compose', () => {
    const original =
      '다낭·호이안 5일 [대한항공·인솔자 동행] 호이안 메모리즈쇼·임프레션·미슐랭'
    const title = buildSupplierProductDisplayTitle({
      verbatimOriginal: original,
      brandKey: 'ybtour',
    })
    expect(title).toMatch(/다낭/)
    expect(title).toMatch(/호이안/)
    expect(title).toMatch(/대한항공|인솔/)
    expect(title).not.toBe('다낭·호이안 4박 5일')
  })

  it('rejects departure window title for all suppliers', () => {
    expect(
      resolveSupplierVerbatimOriginalTitle({
        parsedSupplierTitle: '2026.06.15 ~ 2026.06.17 2박 3일',
        supplierListingTitleRaw: '2026.06.15 ~ 2026.06.17 2박 3일',
        brandKey: 'hanatour',
      }),
    ).toBe('미입력')
    expect(
      buildSupplierProductDisplayTitle({
        verbatimOriginal: '미입력',
        parsedSupplierTitle: '2026.06.15 ~ 2026.06.17 2박 3일',
        brandKey: 'ybtour',
      }),
    ).toBe('미입력')
  })

  it('rejects modetour hotel-grade-only display and falls back to parsed', () => {
    const title = buildSupplierProductDisplayTitle({
      verbatimOriginal: '일급호텔 3박 5일',
      parsedSupplierTitle: '[태국] 방콕·파타야 5일 #노옵션',
      brandKey: 'modetour',
    })
    expect(title).toContain('방콕')
    expect(title).toContain('#노옵션')
  })
})

describe('stripSupplierTitlePromoBadges', () => {
  it('keeps 노옵션 hashtag', () => {
    expect(stripSupplierTitlePromoBadges('[태국] 방콕 5일 #노옵션')).toBe('[태국] 방콕 5일 #노옵션')
  })

  // REGRESSION-FREEZE[supplier-title-no-sale-status-season]: verygoodtour 선착순·만원·■확정■·유류세 — manifest
  it('strips verygoodtour leading seat/price and ■holiday■ promo noise', () => {
    expect(
      normalizeSupplierRegisterListingTitle(
        '선착순 2석 1329 -> 1299만원 세계 3대 폭포 중 두 곳을 갑니다 / 아프리카 빅토리아 폭포&남미 12일',
      ),
    ).toBe('세계 3대 폭포 중 두 곳을 갑니다 / 아프리카 빅토리아 폭포&남미 12일')
    expect(
      normalizeSupplierRegisterListingTitle(
        '■추석연휴 / 출발확정■[NO 유류세+브리즈번 시티투어] 시드니+골드코스트 6일',
      ),
    ).toBe('[브리즈번 시티투어] 시드니+골드코스트 6일')
    expect(
      normalizeSupplierRegisterListingTitle('유류세 ZERO◀ [시드니 타워 전망대+사막투어] 시드니 6일'),
    ).toBe('[시드니 타워 전망대+사막투어] 시드니 6일')
    expect(
      normalizeSupplierRegisterListingTitle(
        '선착순 2석 특가 [노팁/노옵션/노쇼핑+장가계 직항] 원가계/천문산/천자산+보봉호+대협곡 6일',
      ),
    ).toContain('장가계 직항')
    expect(
      normalizeSupplierRegisterListingTitle(
        '선착순 2석 특가 [노팁/노옵션/노쇼핑+장가계 직항] 원가계/천문산/천자산+보봉호+대협곡 6일',
      ),
    ).toMatch(/노팁|노옵션|노쇼핑/)
    expect(
      normalizeSupplierRegisterListingTitle(
        '선착순 2석 특가 [노팁/노옵션/노쇼핑+장가계 직항] 원가계/천문산/천자산+보봉호+대협곡 6일',
      ),
    ).not.toMatch(/선착\s*순/)
    expect(
      normalizeSupplierRegisterListingTitle(
        '추석연휴특가[터키항공직항]튀르키예 일주 10일 #괴베클리테페',
      ),
    ).toBe('[터키항공직항] 튀르키예 일주 10일 #괴베클리테페')
    expect(
      normalizeSupplierRegisterListingTitle(
        '1석 예약시, 독실료 할인 가능◀ [시드니 타워 전망대+사막투어] 시드니 6일',
      ),
    ).toBe('[시드니 타워 전망대+사막투어] 시드니 6일')
    expect(
      normalizeSupplierRegisterListingTitle(
        '●특가● ■오후출발 [인천출발/노팁+노쇼핑][리무진차량] 상해 4일',
      ),
    ).toBe('오후출발 [인천출발/노팁+노쇼핑] [리무진차량] 상해 4일')
  })

  it('strips sale-status, cabin-class, and season promo from homepage titles', () => {
    expect(
      normalizeSupplierRegisterListingTitle('판매마감 [비즈니스/클래스] 캐나다 단풍시즌 10일'),
    ).toBe('[비즈니스] 캐나다 10일')
    expect(normalizeSupplierRegisterListingTitle('[잔여좌석 3석] 홍콩/마카오 3일')).toBe(
      '홍콩/마카오 3일',
    )
    expect(normalizeSupplierRegisterListingTitle('[다낭] 3박5일 #단풍시즌')).toBe('[다낭] 3박5일')
    expect(normalizeSupplierRegisterListingTitle('[비즈니스/] 캐나다 10일')).toBe('[비즈니스] 캐나다 10일')
    expect(normalizeSupplierRegisterListingTitle('[비즈니스／] 홍콩 3일')).toBe('[비즈니스] 홍콩 3일')
    expect(normalizeSupplierRegisterListingTitle('[비즈니스] 캐나다 10일')).toBe('[비즈니스] 캐나다 10일')
    expect(normalizeSupplierRegisterListingTitle('판매마감 [비즈니스/클래스] 캐나다 10일')).toBe(
      '[비즈니스] 캐나다 10일',
    )
    expect(buildSupplierProductDisplayTitle({
      verbatimOriginal: '판매마감 일본 도쿄 3일 잔여좌석 2석',
      brandKey: 'hanatour',
    })).toBe('일본 도쿄 3일')
  })

  // REGRESSION-FREEZE[supplier-title-no-sale-status-season]: NO 유류세인상 ≠ [인상] · 본문 출발확정 — manifest
  it('strips NO 유류세인상 without leaving 인상 residue and mid-title 출발확정', () => {
    expect(
      normalizeSupplierRegisterListingTitle(
        '[NO 유류세인상][특별전세기/후룬베이얼]내몽골/세계3대초원 5일',
      ),
    ).toBe('[특별전세기/후룬베이얼] 내몽골/세계3대초원 5일')
    expect(
      normalizeSupplierRegisterListingTitle('쿠알라룸푸르/말라카/겐팅 출발확정 3박 5일'),
    ).toBe('쿠알라룸푸르/말라카/겐팅 3박 5일')
    expect(
      normalizeSupplierRegisterListingTitle("출발확정『실크로드의 종착지』튀르키예 완전일주 9일"),
    ).toBe("『실크로드의 종착지』튀르키예 완전일주 9일")
    expect(
      normalizeSupplierRegisterListingTitle('[초특가] [2030전용] 푸꾸옥 5일 #사오비치'),
    ).toBe('[2030전용] 푸꾸옥 5일 #사오비치')
    expect(
      normalizeSupplierRegisterListingTitle('[한정특가][2030전용] 동유럽 3국 7일'),
    ).toBe('[2030전용] 동유럽 3국 7일')
    expect(
      normalizeSupplierRegisterListingTitle(
        '***출발확정[KE][NO옵션] 나트랑,달랏 5일',
      ),
    ).toBe('[KE] [NO옵션] 나트랑,달랏 5일')
    expect(
      normalizeSupplierRegisterListingTitle(
        '미서부8일 # LA 다져스직관 # 4인이상출발확정',
      ),
    ).toBe('미서부8일 # LA 다져스직관')
    expect(
      normalizeSupplierRegisterListingTitle(
        '[풀패키지] 홍콩+마카오 2박4일 대한항공/저녁출발/익청빌딩',
      ),
    ).toBe('[풀패키지] 홍콩+마카오 2박4일 대한항공/저녁출발/익청빌딩')
  })

  it('plan-b-v5: symbol wrappers, channels, dates, HIT, 특가, 특급호텔 keep', () => {
    expect(
      normalizeSupplierRegisterListingTitle(
        '★출발확정/대형기탑승★몽골 울란바토르 4박5일 #노쇼핑노옵션',
      ),
    ).toBe('대형기탑승 몽골 울란바토르 4박5일 #노쇼핑노옵션')
    expect(
      normalizeSupplierRegisterListingTitle(
        '[출발확정] [NO유류인상][Semi-프리미엄/청주출발]장가계/원가계 5일',
      ),
    ).toBe('[Semi-프리미엄/청주출발] 장가계/원가계 5일')
    expect(
      normalizeSupplierRegisterListingTitle('~웹예약20만원할인~황금연휴[오이타 직항] 벳부'),
    ).toBe('[오이타 직항] 벳부')
    expect(
      normalizeSupplierRegisterListingTitle(
        "[KE][롯데관광'단독][NO쇼핑][나다운 여행을 떠난다면] 싱가포르 5일",
      ),
    ).toBe('[KE] [NO쇼핑] [나다운 여행을 떠난다면] 싱가포르 5일')
    expect(
      normalizeSupplierRegisterListingTitle('12월2일 【후쿠오카】츠카사 로얄호텔 4일'),
    ).toBe('【후쿠오카】 츠카사 로얄호텔 4일')
    expect(
      normalizeSupplierRegisterListingTitle(
        '[여행핫딜] 스페인 9일 [9/5 출발확정_베스트 오브 베스트]',
      ),
    ).toBe('스페인 9일 [베스트 오브 베스트]')
    expect(normalizeSupplierRegisterListingTitle('[CJ온스타일] 스페인 10일 #특급호텔')).toBe(
      '스페인 10일 #특급호텔',
    )
    expect(normalizeSupplierRegisterListingTitle('[하나LIVE] 푸꾸옥 5일')).toBe('푸꾸옥 5일')
    expect(normalizeSupplierRegisterListingTitle('[집중모객] 나고야 4일')).toBe('나고야 4일')
    expect(normalizeSupplierRegisterListingTitle('튀르키예 9일 #양갈비 HIT')).toBe('튀르키예 9일 #양갈비')
    expect(normalizeSupplierRegisterListingTitle('★추석특가★ 이스턴 크루즈 3일')).toBe(
      '이스턴 크루즈 3일',
    )
    expect(normalizeSupplierRegisterListingTitle('특급호텔 유지 5일 #특식 #특전')).toBe(
      '특급호텔 유지 5일 #특식 #특전',
    )
    expect(normalizeSupplierRegisterListingTitle('[SK스토아] 나트랑 5일')).toBe('나트랑 5일')
    expect(normalizeSupplierRegisterListingTitle('[출발임박][2030전용] 동유럽 7일')).toBe(
      '[2030전용] 동유럽 7일',
    )
  })
})

describe('stripSupplierTitleUiNoise', () => {
  it('normalizes whitespace', () => {
    expect(stripSupplierTitleUiNoise('  다낭   5일  ')).toBe('다낭 5일')
  })
})
