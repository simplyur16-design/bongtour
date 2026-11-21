import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  decideTalktalkAutoReply,
  extractProductRef,
  sanitizeCustomerText,
  summaryWithoutAmounts,
  toNaverSendEvent,
} from '@/lib/talktalk-autoreply/reply'

const product = {
  title: '다낭 호이안 4박 5일',
  href: '/products/pkg-yb-0004',
  imageUrl: 'https://example.com/a.jpg',
  summary: '바나힐과 호이안 올드타운을 둘러봅니다. 성인 1,290,000원부터. 하나투어 상품입니다. 자유시간이 넉넉합니다.',
}

describe('talktalk autoreply decision', () => {
  it('상품 링크가 있으면 사진·설명 복합 메시지, 금액·공급사 문장은 빠진다', () => {
    const d = decideTalktalkAutoReply({ text: 'https://bongtour.com/products/pkg-yb-0004 아이랑 가도 되나요', product })
    expect(d.mode).toBe('product')
    const m = d.messages[0]
    expect(m.kind).toBe('composite')
    if (m.kind !== 'composite') return
    expect(m.imageUrl).toBe(product.imageUrl)
    expect(m.linkUrl).toBe('https://bongtour.com/products/pkg-yb-0004')
    expect(m.description).toContain('바나힐')
    expect(m.description).not.toMatch(/원부터|1,290,000|하나투어/)
  })

  it('FAQ 주제가 맞으면 FAQ로 답하고 상담원 연결은 안 한다', () => {
    const d = decideTalktalkAutoReply({ text: '예약 취소하면 환불은 어떻게 되나요?' })
    expect(d.mode).toBe('faq')
    expect(d.handover).toBe(false)
    expect(d.faqIds.length).toBeGreaterThan(0)
    expect(d.messages[0].kind === 'text' && d.messages[0].text).not.toMatch(/유심사/)
  })

  it('FAQ로 해결 못 하면 상담원 연결', () => {
    expect(decideTalktalkAutoReply({ text: '가이드님 성함이 궁금해요' }).mode).toBe('handover')
    expect(decideTalktalkAutoReply({ text: '상담원 연결해 주세요' }).handover).toBe(true)
    expect(decideTalktalkAutoReply({ text: '', hasImage: true }).mode).toBe('handover')
  })

  it('상담원 응대 중(standby)에는 답하지 않는다', () => {
    expect(decideTalktalkAutoReply({ text: '환불 문의', standby: true }).mode).toBe('ignore')
  })

  it('보조 함수', () => {
    expect(extractProductRef('bongtour.com/products/abc_123 문의')).toBe('abc_123')
    expect(extractProductRef('상품코드 JOP185270108LJE 문의')).toBe('JOP185270108LJE')
    expect(sanitizeCustomerText('좋아요\n모두투어 출발')).toBe('좋아요')
    expect(summaryWithoutAmounts('가격은 $500입니다. 좋아요.')).toBe('좋아요.')
    const ev = toNaverSendEvent('u1', { kind: 'text', text: 'hi' })
    expect(ev).toEqual({ event: 'send', user: 'u1', textContent: { text: 'hi' } })
  })

  it('웹훅은 live 설정일 때만 답하고, 미리보기는 보내지 않는다', () => {
    const hook = readFileSync('app/api/naver-talktalk/webhook/route.ts', 'utf8')
    expect(hook).toContain("process.env.NAVER_TALKTALK_AUTOREPLY === 'live'")
    expect(hook).toContain('if (live && decision.messages[0])')
    expect(hook).toContain('if (live && decision.handover)')
    const preview = readFileSync('app/api/admin/talktalk-autoreply-preview/route.ts', 'utf8')
    expect(preview).toContain('requireAdmin')
    expect(preview).toContain('sent: false')
    expect(preview).not.toMatch(/gw\.talk\.naver\.com|fetch\(/)
  })
})
