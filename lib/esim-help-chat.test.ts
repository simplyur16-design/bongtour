import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { ADMIN_DRAFT_FAQ } from '@/lib/talktalk-draft/faq'
import { ESIM_AGENT_CHAT_LABEL } from '@/lib/talktalk-draft/esim-agent-chat'
import { ESIM_HELP_TOPICS, esimHelpTopic, esimHelpTranscript } from '@/lib/esim-help-chat'

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
})
