import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { ADMIN_DRAFT_FAQ } from '@/lib/talktalk-draft/faq'
import { ESIM_AGENT_CHAT_LABEL } from '@/lib/talktalk-draft/esim-agent-chat'
import {
  ESIM_HELP_CATEGORIES,
  ESIM_HELP_CONTACT_CATEGORY,
  ESIM_HELP_TOPICS,
  esimHelpTopic,
  esimHelpTranscript,
  splitHelpAnswer,
} from '@/lib/esim-help-chat'
import { talktalkFaqAdminGroups } from '@/lib/talktalk-draft/faq'

describe('esim help chat', () => {
  it('답은 저장해 둔 FAQ·인증 문장이고, 버튼 이름은 고객센터 연결링크다', () => {
    const refund = esimHelpTopic('refund')
    const stored = ADMIN_DRAFT_FAQ.find((item) => item.id === 'esim-refund')?.answer
    expect(refund?.lines[0]).toBe(stored)
    expect(esimHelpTopic('auth')?.lines.some((line) => line.includes('8985234'))).toBe(true)
    expect(ESIM_HELP_TOPICS.map((topic) => topic.label)).toEqual([
      '아이폰 설치',
      '갤럭시 설치',
      'QR·수동 입력',
      '개통 시점',
      '데이터 안 됨',
      '핫스팟',
      '기기 호환',
      '여행자 인증',
      '사용량',
      '환불·취소',
    ])
    expect(ESIM_AGENT_CHAT_LABEL).toBe('고객센터 연결링크')
    const widget = readFileSync('components/bongsim/esim/EsimHelpChat.tsx', 'utf8')
    expect(widget).not.toMatch(/유심사|카카오톡|kakao/i)
    expect(esimHelpTranscript(['QR'])).toContain('고객센터 연결링크')
  })

  it('처음엔 중분류 6개, 분류마다 질문 3~5개, 답은 짧게 + 더 보기', () => {
    const labels = [...ESIM_HELP_CATEGORIES.map((c) => c.label), ESIM_HELP_CONTACT_CATEGORY.label]
    expect(labels).toEqual(['설치·개통', '데이터·핫스팟', '구매·결제', '취소·환불', '기기 호환', '상담 연결'])
    const stored = new Set(ADMIN_DRAFT_FAQ.map((item) => item.answer.trim()))
    for (const c of ESIM_HELP_CATEGORIES) {
      expect(c.questions.length).toBeGreaterThanOrEqual(3)
      expect(c.questions.length).toBeLessThanOrEqual(5)
      for (const item of c.questions) {
        expect(item.answer).not.toMatch(/유심사|usimsa/i)
        expect(item.question).not.toMatch(/유심사|usimsa/i)
        const { short } = splitHelpAnswer(item.answer)
        expect(short.length).toBeGreaterThan(0)
        expect(short.length).toBeLessThanOrEqual(140)
      }
    }
    const refund = ESIM_HELP_CATEGORIES.find((c) => c.id === 'refund')?.questions.find((item) => item.id === 'refund')
    expect(stored.has(refund?.answer ?? '')).toBe(true)
    const iphone = splitHelpAnswer(ESIM_HELP_CATEGORIES[0].questions[0].answer)
    expect(iphone.short).not.toMatch(/^eSIM 발급받기/)
    expect(iphone.rest.length).toBeGreaterThan(0)
    const widget = readFileSync('components/bongsim/esim/EsimHelpChat.tsx', 'utf8')
    expect(widget).toContain('더 보기')
    expect(widget).toContain('‹ 처음으로')
    expect(widget).toContain('data-esim-help-categories')
  })

  it('관리자 FAQ eSIM 탭도 같은 중분류로 나뉜다', () => {
    const esim = talktalkFaqAdminGroups().find((g) => g.id === 'esim')
    const subs = new Set(esim?.items.map((item) => item.subgroup))
    for (const label of ['설치·개통', '데이터·핫스팟', '구매·결제', '취소·환불', '기기 호환']) expect(subs.has(label)).toBe(true)
    expect(esim?.items.filter((item) => item.subgroup === '기타').length).toBe(0)
  })
})
