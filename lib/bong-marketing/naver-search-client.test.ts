import { describe, it, expect, afterEach } from 'vitest'
import { assertNaverCredentials, stripHtmlTags } from '@/lib/bong-marketing/naver-search-client'

describe('stripHtmlTags', () => {
  it('removes bold tags and decodes entities', () => {
    expect(stripHtmlTags('<b>다낭</b> 여행 &amp; 맛집 &quot;추천&quot;')).toBe(
      '다낭 여행 & 맛집 "추천"',
    )
  })

  it('handles empty string', () => {
    expect(stripHtmlTags('')).toBe('')
  })
})

describe('assertNaverCredentials', () => {
  const origId = process.env.NAVER_CLIENT_ID
  const origSecret = process.env.NAVER_CLIENT_SECRET

  afterEach(() => {
    if (origId === undefined) delete process.env.NAVER_CLIENT_ID
    else process.env.NAVER_CLIENT_ID = origId
    if (origSecret === undefined) delete process.env.NAVER_CLIENT_SECRET
    else process.env.NAVER_CLIENT_SECRET = origSecret
  })

  it('throws when credentials missing', () => {
    delete process.env.NAVER_CLIENT_ID
    delete process.env.NAVER_CLIENT_SECRET
    expect(() => assertNaverCredentials()).toThrow('NAVER_CLIENT_ID / NAVER_CLIENT_SECRET 미설정')
  })

  it('returns trimmed credentials', () => {
    process.env.NAVER_CLIENT_ID = '  test-id  '
    process.env.NAVER_CLIENT_SECRET = 'secret'
    expect(assertNaverCredentials()).toEqual({ clientId: 'test-id', clientSecret: 'secret' })
  })
})
