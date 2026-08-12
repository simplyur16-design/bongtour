/**
 * REGRESSION-FREEZE[register-destination-reject-ilju]: bare 「일주」 destination 금지 — manifest
 */
import { describe, expect, it } from 'vitest'
import {
  filterRegisterDestinationTitlePlaceTokens,
  firstRegisterDestinationPlaceFromTitleHead,
  isRegisterDestinationTourStyleNoiseToken,
} from '@/lib/register-destination-tour-style-noise'
import { resolveHanatourRegisterDestination } from '@/lib/hanatour-register-destination-from-paste'
import { resolveModetourRegisterDestination } from '@/lib/modetour-register-destination-from-paste'
import { resolveLottetourRegisterDestination } from '@/lib/lottetour-register-destination-from-paste'
import { resolveKyowontourRegisterDestination } from '@/lib/kyowontour-register-api-parse'
import {
  finalizeRegisterDestinationFields,
  healRegisterDestinationLabel,
  isRegisterDestinationPollutionLabel,
} from '@/lib/register-destination-finalize'
import { resolveProductListDestinationLabel } from '@/lib/verygoodtour-listing-title-from-paste'

describe('register-destination-reject-ilju', () => {
  it('rejects bare 일주 / 개국 tokens', () => {
    expect(isRegisterDestinationTourStyleNoiseToken('일주')).toBe(true)
    expect(isRegisterDestinationTourStyleNoiseToken('완전일주')).toBe(true)
    expect(isRegisterDestinationTourStyleNoiseToken('개국')).toBe(true)
    expect(isRegisterDestinationTourStyleNoiseToken('터키')).toBe(false)
    expect(isRegisterDestinationTourStyleNoiseToken('미서부')).toBe(false)
  })

  it('2030-style head: 2개국 일주 → not 개국/일주', () => {
    expect(firstRegisterDestinationPlaceFromTitleHead('요르단·이집트 2개국 일주')).toBe('요르단')
    expect(firstRegisterDestinationPlaceFromTitleHead('2개국 일주')).toBeNull()
    expect(firstRegisterDestinationPlaceFromTitleHead('일주')).toBeNull()
    expect(firstRegisterDestinationPlaceFromTitleHead('터키 일주')).toBe('터키')
  })

  it('title hint tokens drop bare 일주', () => {
    expect(filterRegisterDestinationTitlePlaceTokens(['스페인', '일주'])).toEqual(['스페인'])
    expect(filterRegisterDestinationTitlePlaceTokens(['터키 일주'])).toEqual(['터키'])
  })

  it('hanatour/modetour/lottetour destination never bare 일주', () => {
    const titles = [
      '스페인·일주 10일',
      '터키 일주 9일',
      '요르단·이집트 2개국 일주 10일',
      '독일 완전일주 9일',
    ]
    for (const title of titles) {
      for (const resolve of [
        resolveHanatourRegisterDestination,
        resolveModetourRegisterDestination,
        resolveLottetourRegisterDestination,
      ]) {
        const r = resolve({ title, pastedBody: '' })
        expect(r.destination).not.toMatch(/^(?:완전)?일주$/)
        expect(r.destination).not.toMatch(/개국\s*일주/)
        expect(String(r.primaryDestination ?? '')).not.toMatch(/^(?:완전)?일주$/)
        expect(r.destination.length).toBeGreaterThan(1)
      }
    }
  })

  it('kyowontour: 튀르키예/이탈리아 일주 → country not 일주', () => {
    expect(resolveKyowontourRegisterDestination('튀르키예 일주 9일 [여행의 정석]').destination).toBe(
      '튀르키예',
    )
    expect(
      resolveKyowontourRegisterDestination('NO유류 차액! 출발가능 이탈리아 일주 11일').destination,
    ).toBe('이탈리아')
  })

  it('pollution: promo / policy / airline / mingling', () => {
    expect(isRegisterDestinationPollutionLabel('일주')).toBe(true)
    expect(isRegisterDestinationPollutionLabel('출발확정')).toBe(true)
    expect(isRegisterDestinationPollutionLabel('노쇼핑')).toBe(true)
    expect(isRegisterDestinationPollutionLabel('노쇼핑 · 노옵션 · 노팁')).toBe(true)
    expect(isRegisterDestinationPollutionLabel('여행일정')).toBe(true)
    expect(isRegisterDestinationPollutionLabel('밍글링 투어 Light')).toBe(true)
    expect(
      isRegisterDestinationPollutionLabel('에어프레미아 이코노미 클래스 외 승무원 안내'),
    ).toBe(true)
    expect(isRegisterDestinationPollutionLabel('튀르키예')).toBe(false)
    expect(isRegisterDestinationPollutionLabel('다낭')).toBe(false)
    expect(isRegisterDestinationPollutionLabel('괌')).toBe(false)
    expect(isRegisterDestinationPollutionLabel('온라인전용')).toBe(true)
    expect(isRegisterDestinationPollutionLabel('풀패키지')).toBe(true)
    expect(isRegisterDestinationPollutionLabel('2030전용')).toBe(true)
    expect(isRegisterDestinationPollutionLabel('KE')).toBe(true)
    expect(isRegisterDestinationPollutionLabel('아일랜드 호핑')).toBe(true)
    expect(isRegisterDestinationPollutionLabel('KK 라운지')).toBe(true)
  })

  it('KK schedule activities never become destination cities', () => {
    const r = resolveModetourRegisterDestination({
      title: '[기간한정특가][노쇼핑+호핑투어+시내라운지+레체] 코타키나발루 판보르네오 시티뷰 3박5일',
      pastedBody: '',
      travelCitiesRaw: '코타키나발루, 아일랜드 호핑, KK 라운지',
    })
    expect(r.primaryDestination).toBe('코타키나발루')
    expect(r.destination).toBe('코타키나발루')
    expect(String(r.destinationRaw ?? '')).toBe('코타키나발루')
    expect(String(r.primaryDestination ?? '')).not.toMatch(/호핑|라운지|외\s*\d+\s*도시/)

    expect(
      finalizeRegisterDestinationFields({
        title: '코타키나발루 3박5일',
        destination: '코타키나발루',
        destinationRaw: '코타키나발루, 달빛 나들이 투어, 이마고 쇼핑몰, 플로팅선셋 반딧불투어',
        primaryDestination: '코타키나발루',
      }).destinationRaw,
    ).toBe('코타키나발루')

    const fin = finalizeRegisterDestinationFields({
      title: '[기간한정특가] 코타키나발루 판보르네오 3박5일',
      destination: '코타키나발루 · 아일랜드 호핑 외 2도시',
      destinationRaw: '코타키나발루, 아일랜드 호핑, KK 라운지',
      primaryDestination: '코타키나발루 · 아일랜드 호핑 외 2도시',
    })
    expect(fin.primaryDestination).toBe('코타키나발루')
    expect(fin.destinationRaw).toBe('코타키나발루')

    expect(
      resolveProductListDestinationLabel({
        primaryDestination: '코타키나발루 · 아일랜드 호핑 외 2도시',
        destinationRaw: '코타키나발루, 아일랜드 호핑, KK 라운지',
        title: '코타키나발루 3박5일',
        countryKey: 'malaysia',
      }),
    ).toBe('코타키나발루')

    expect(
      finalizeRegisterDestinationFields({
        title: '[2030전용] 나트랑 5일 #해적호핑투어',
        destination: '나트랑 해적 호핑',
        destinationRaw: '나트랑 해적 호핑, 나트랑 레일웨이 카페, 판랑사막',
        primaryDestination: '나트랑 해적 호핑',
      }).primaryDestination,
    ).toBe('나트랑')

    expect(
      finalizeRegisterDestinationFields({
        title: '[초특가] [2030전용] 푸꾸옥 5일 #크레이지호핑투어',
        destination: '크레이지 호핑',
        destinationRaw: '크레이지 호핑, 소나시 비치바 푸꾸옥',
        primaryDestination: '크레이지 호핑',
        countryKey: 'vietnam',
      }).primaryDestination,
    ).toBe('푸꾸옥')
  })

  it('Australia/Kazakhstan booking-notice days never become destination', () => {
    const au = resolveModetourRegisterDestination({
      title: '[유류세_고정] 시드니 일주 6일 (전일정4성)',
      pastedBody: '',
      travelCitiesRaw:
        '호주 상품 예약 시 꼭 읽어주세요, 시드니, 본다이 비치, 시드니 하버크루즈, 오페라하우스, 하버브릿지, MRS 맥콰리 체어, 록스 거리, 시드니 천문대, 남부 시드니, 쿨랑가타 와이너리, 화이트 샌드 워크, 저비스베이 돌핀크루즈, 블루마운틴, 시드니 ZOO',
    })
    expect(String(au.primaryDestination ?? '')).not.toMatch(/꼭\s*읽어|예약\s*시/)
    expect(String(au.destinationRaw ?? '')).not.toMatch(/꼭\s*읽어|예약\s*시|하버\s*크루즈|오페라하우스|ZOO/i)
    expect(String(au.primaryDestination ?? '')).toMatch(/시드니|호주/)

    const kz = finalizeRegisterDestinationFields({
      title: '[2030전용] 카자흐스탄 5일 #카자흐대자연',
      destination: '카자흐스탄 여행 전 꼭 읽어주세요!',
      destinationRaw: '카자흐스탄 여행 전 꼭 읽어주세요!, 차른 캐니언, 알마티',
      primaryDestination: '카자흐스탄 여행 전 꼭 읽어주세요!',
      countryKey: 'kazakhstan',
    })
    expect(String(kz.primaryDestination ?? '')).not.toMatch(/꼭\s*읽어/)
    expect(String(kz.primaryDestination ?? '')).toMatch(/카자흐|알마티/)
  })

  it('heal: polluted current → title / countryKey', () => {
    expect(
      healRegisterDestinationLabel({
        title: '튀르키예 일주 9일',
        current: '일주',
        countryKey: 'turkey',
      }),
    ).toBe('튀르키예')
    expect(
      healRegisterDestinationLabel({
        title: '[다낭] 자유여행 3박5일',
        current: '노쇼핑',
      }),
    ).toBe('다낭')
    expect(
      healRegisterDestinationLabel({
        title: '패키지 상품',
        current: '출발확정',
        countryKey: 'italy',
      }),
    ).toBe('이탈리아')
    expect(
      healRegisterDestinationLabel({
        title: '[온라인전용]발트 3국[에스토니아/라트비아/리투아니아]과 폴란드 9일',
        current: '폴란드 항공 LOT · LO 폴란드항공 이코노미클래스 외',
        countryKey: 'lithuania',
      }),
    ).toBe('에스토니아 · 라트비아 · 리투아니아')
    expect(
      healRegisterDestinationLabel({
        title: '[2030전용] 칭다오(청도) 3일 #ALL포함 #운상해천전망대',
        current: '밍글링 투어 Light · 밍글링 타임 외',
        countryKey: 'china',
      }),
    ).toBe('칭다오')
    expect(
      healRegisterDestinationLabel({
        title: '자카르타/족자카르타 6일 #국내선 이동포함',
        current: '노쇼핑 · 노옵션 · 노팁',
        countryKey: 'indonesia',
      }),
    ).toBe('자카르타')
    expect(
      healRegisterDestinationLabel({
        title: '북유럽&발트 7개국 12일',
        current: '노쇼핑',
        countryKey: 'lithuania',
      }),
    ).toBe('북유럽&발트')
    expect(
      finalizeRegisterDestinationFields({
        title: '괌 닛코 오션프론트룸 3박5일',
        destination: '괌',
        destinationRaw: '여행일정',
        primaryDestination: null,
      }).destination,
    ).toBe('괌')
    const fin = finalizeRegisterDestinationFields({
      title: '이탈리아 일주 11일',
      destination: '일주',
      destinationRaw: '일주',
      primaryDestination: '일주',
    })
    expect(fin.destination).toBe('이탈리아')
    expect(fin.primaryDestination).toBe('이탈리아')
  })

  it('list label skips polluted stored destination', () => {
    expect(
      resolveProductListDestinationLabel({
        primaryDestination: '일주',
        destination: '일주',
        title: '튀르키예 일주 9일',
        countryKey: 'turkey',
      }),
    ).toBe('튀르키예')
    expect(
      resolveProductListDestinationLabel({
        primaryDestination: '노쇼핑',
        title: '[치앙마이] #노쇼핑 4일',
      }),
    ).toBe('치앙마이')
  })
})
