/**
 * REGRESSION-FREEZE[product-image-ops-seo-contamination]
 * REGRESSION-FREEZE[product-image-seo-review-contamination]
 */
import { describe, expect, it } from 'vitest'
import {
  isProductHeroListingSeoContaminated,
  isProductImageOpsSeoContaminated,
  stripReviewSectionsFromImageSeoHaystack,
} from '@/lib/product-hero-listing-seo-contamination'
import { isPollutedScheduleImageSeoTitle, resolveScheduleImageSeoTitleKr } from '@/lib/schedule-image-seo-title-ssot'
import { resolvePublicProductHeroSeoKeywordOverlay } from '@/lib/public-product-hero-seo-keyword'
import { buildRegisterPublicImageHeroSeoKeywords } from '@/lib/register-public-image-hero-seo-line-candidate'
import { harvestBodySectionLinesAfterHeaders } from '@/lib/register-hero-seo-title-body-harvest'

describe('product image ops SEO contamination', () => {
  it('rejects 상품코드 · 단체번호 · 객실 미니바', () => {
    expect(isProductImageOpsSeoContaminated('상품코드: AHP406KEDT')).toBe(true)
    expect(isProductImageOpsSeoContaminated('단체번호')).toBe(true)
    expect(isProductImageOpsSeoContaminated('상품번호CEK3500-261')).toBe(true)
    expect(isProductImageOpsSeoContaminated('객실내 미니바')).toBe(true)
    expect(isProductImageOpsSeoContaminated('디럭스룸')).toBe(true)
    expect(isProductImageOpsSeoContaminated('E01A260721')).toBe(true)
    expect(isProductImageOpsSeoContaminated('무료WIFI')).toBe(true)
    expect(isProductImageOpsSeoContaminated('관광지 입장료')).toBe(true)
    expect(isProductImageOpsSeoContaminated('돌로미티 (롯데관광')).toBe(true)
    expect(isProductImageOpsSeoContaminated('홍콩 디즈니랜드')).toBe(false)
    expect(isProductImageOpsSeoContaminated('부나켄국립공원')).toBe(false)
  })

  it('hero listing contamination includes ops + 요금 약관', () => {
    expect(isProductHeroListingSeoContaminated('상품코드 · 단체번호')).toBe(true)
    expect(isProductHeroListingSeoContaminated('선택관광 포함')).toBe(true)
    expect(isProductHeroListingSeoContaminated('€170 상당 ★롯데관광')).toBe(true)
    expect(isProductHeroListingSeoContaminated('야외온천욕')).toBe(false)
  })

  it('stored hero overlay drops 상품코드 tokens', () => {
    const line = resolvePublicProductHeroSeoKeywordOverlay({
      title: '홍콩 3일',
      primaryDestination: '홍콩',
      destination: '홍콩',
      duration: '2박 3일',
      originSource: 'hanatour',
      storedRegisterSeoKeywordsJson: JSON.stringify(['상품코드: AHP406KEDT', '여행일정', '피크트램']),
      storedRegisterSeoLine: '상품코드: AHP406KEDT · 여행일정',
    })
    expect(line).toBeTruthy()
    expect(line).not.toMatch(/상품코드|AHP406|단체번호|여행일정/)
  })

  it('schedule photo title skips minibar route segment', () => {
    expect(isPollutedScheduleImageSeoTitle('객실내 미니바')).toBe(true)
    expect(isPollutedScheduleImageSeoTitle('상품코드 AHP406')).toBe(true)
    const title = resolveScheduleImageSeoTitleKr({
      stored: '객실내 미니바',
      day: 2,
      maxDay: 4,
      routeText: '객실내 미니바 - 홍콩 디즈니랜드',
      destination: '홍콩',
    })
    expect(title).toMatch(/디즈니|홍콩/)
    expect(title).not.toMatch(/미니바|상품코드/)
  })

  it('rejects review labels and review chrome in image SEO', () => {
    expect(isProductImageOpsSeoContaminated('여행후기')).toBe(true)
    expect(isProductImageOpsSeoContaminated('실제 여행객 12명의 리뷰')).toBe(true)
    expect(isProductImageOpsSeoContaminated('평균별점 4.8')).toBe(true)
    expect(isProductImageOpsSeoContaminated('tripadvisor reviews')).toBe(true)
    expect(isProductImageOpsSeoContaminated('가이드분이 너무 감사했어요')).toBe(true)
    expect(isProductHeroListingSeoContaminated('고객리뷰 · 별점5점')).toBe(true)
    expect(isProductImageOpsSeoContaminated('홍콩 디즈니랜드')).toBe(false)
    expect(isProductImageOpsSeoContaminated('시드니 프리뷰')).toBe(false)
    expect(isPollutedScheduleImageSeoTitle('여행후기')).toBe(true)
  })

  it('stored hero overlay drops review tokens', () => {
    const line = resolvePublicProductHeroSeoKeywordOverlay({
      title: '홍콩 3일',
      primaryDestination: '홍콩',
      destination: '홍콩',
      duration: '2박 3일',
      originSource: 'hanatour',
      storedRegisterSeoKeywordsJson: JSON.stringify(['여행후기', '실제 여행객 12명의 리뷰', '피크트램']),
      storedRegisterSeoLine: '여행후기 · 별점 5점',
    })
    expect(line).toBeTruthy()
    expect(line).not.toMatch(/리뷰|후기|별점|여행객/)
  })

  it('schedule photo title skips review route segment', () => {
    const title = resolveScheduleImageSeoTitleKr({
      stored: '여행후기',
      day: 2,
      maxDay: 4,
      routeText: '여행후기 - 홍콩 디즈니랜드',
      destination: '홍콩',
    })
    expect(title).toMatch(/디즈니|홍콩/)
    expect(title).not.toMatch(/리뷰|후기/)
  })

  it('strips review sections from image SEO haystack and harvest', () => {
    const body = [
      '핵심 포인트',
      '피크트램 · 스탠리',
      '여행후기',
      '가이드분이 친절하시고 최고였습니다',
      '실제 여행객 12명의 리뷰',
      '별점 5점 강추',
    ].join('\n')
    const stripped = stripReviewSectionsFromImageSeoHaystack(body)
    expect(stripped).toMatch(/피크트램/)
    expect(stripped).not.toMatch(/가이드분이|별점 5점|여행후기/)
    const harvested = harvestBodySectionLinesAfterHeaders(body)
    expect(harvested.join(' ')).toMatch(/피크트램/)
    expect(harvested.join(' ')).not.toMatch(/가이드분이|별점|리뷰/)
    const kw = buildRegisterPublicImageHeroSeoKeywords({
      rawBodyText: body,
      title: '홍콩 3일',
      primaryDestination: '홍콩',
      destination: '홍콩',
      duration: '2박 3일',
      scheduleDayTitles: [],
      originSourceForFallback: 'hanatour',
    })
    expect(kw?.join(' ') ?? '').not.toMatch(/리뷰|후기|별점|가이드분이/)
  })
})
