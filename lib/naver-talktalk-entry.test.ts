import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  MOBILE_STICKY_KAKAO_HREF,
  NAVER_TALK_CONSULT_LABEL,
  NAVER_TALK_PROFILE_URL,
} from '@/lib/main-hub-copy'

const TALK_URL = 'https://talk.naver.com/profile/w2r7vau'

function source(rel: string): string {
  return readFileSync(path.join(process.cwd(), rel), 'utf8')
}

describe('naver-talktalk-entry', () => {
  // REGRESSION-FREEZE[naver-talktalk-entry]: 프로필 URL 상수 — manifest
  it('profile url is the public talk.naver profile', () => {
    expect(NAVER_TALK_PROFILE_URL).toBe(TALK_URL)
    expect(NAVER_TALK_CONSULT_LABEL).toBe('네이버 톡톡 상담')
  })

  it('quote card, sticky bar, and footer keep kakao and add the talk link', () => {
    const quote = source('app/components/detail/ProductLiveQuoteCard.tsx')
    expect(quote).toContain('KakaoChannelConsultLink')
    expect(quote).toContain('NaverTalkTalkConsultLink')

    const footer = source('app/components/SiteFooter.tsx')
    expect(footer).toContain('KakaoChannelConsultLink')
    expect(footer).toContain('NaverTalkTalkConsultLink')

    const sticky = source('app/components/MobileStickyBar.tsx')
    expect(sticky).toContain('MOBILE_STICKY_KAKAO_HREF')
    expect(sticky).toContain('NAVER_TALK_PROFILE_URL')
    expect(sticky).toContain('target="_blank"')
    expect(sticky).toContain('rel="noopener noreferrer"')
    expect(sticky).toContain('aria-label={NAVER_TALK_CONSULT_LABEL}')
    expect(sticky).toContain('min-h-[3rem]')
    expect(MOBILE_STICKY_KAKAO_HREF).toBe('https://pf.kakao.com/_xlxjrxlX/chat')

    const link = source('components/bongtour/NaverTalkTalkConsultLink.tsx')
    expect(link).toContain('href={NAVER_TALK_PROFILE_URL}')
    expect(link).toContain('target="_blank"')
    expect(link).toContain('rel="noopener noreferrer"')
    expect(link).toContain('KAKAO_CHANNEL_BTN_CLASS')
    expect(link).toContain('min-h-11')
    expect(link).toContain('aria-label={NAVER_TALK_CONSULT_LABEL}')
  })
})
