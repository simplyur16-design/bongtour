import { describe, expect, it } from 'vitest'
import { buildTalktalkDraft } from '@/lib/talktalk-draft/draft'
import {
  ESIM_AGENT_CHAT_LABEL,
  ESIM_AGENT_CHAT_URL,
  esimAgentChatDecision,
  esimAgentChatLine,
  shouldAttachEsimAgentChat,
} from '@/lib/talktalk-draft/esim-agent-chat'

const base = {
  placeLabel: '오사카',
  weekStartYmd: null as string | null,
  weekFellBack: false,
  durationNote: true,
  candidates: [],
}

describe('esim agent chat link', () => {
  it('주소는 상수 하나다', () => {
    expect(ESIM_AGENT_CHAT_URL).toBe('https://usimsa.channel.io/home')
    expect(ESIM_AGENT_CHAT_LABEL).toBe('고객센터 연결링크')
    expect(esimAgentChatLine()).toBe('고객센터 연결링크: https://usimsa.channel.io/home')
    expect(ESIM_AGENT_CHAT_LABEL).not.toMatch(/유심사|USIMSA/)
  })

  it('eSIM인데 매칭 FAQ가 없으면 링크를 붙인다', () => {
    expect(esimAgentChatDecision(true, 0, 'eSIM 문의')).toBe(true)
  })

  it('eSIM인데 상담원 연결을 청하면 초안에 한 줄만 붙인다', () => {
    expect(shouldAttachEsimAgentChat('eSIM인데 상담원 연결해 주세요')).toBe(true)
    const { text, esimAgentChat } = buildTalktalkDraft({
      ...base,
      inquiryText: 'eSIM인데 상담원 연결해 주세요',
    })
    expect(esimAgentChat).toBe(true)
    expect(text).toContain(esimAgentChatLine())
    expect(text.replaceAll(ESIM_AGENT_CHAT_URL, '')).not.toMatch(/유심사/)
  })

  it('패키지 상담에는 링크를 넣지 않는다', () => {
    expect(shouldAttachEsimAgentChat('오사카 패키지 상담 부탁드립니다')).toBe(false)
    const { text, esimAgentChat } = buildTalktalkDraft({
      ...base,
      inquiryText: '오사카 패키지 상담 부탁드립니다',
    })
    expect(esimAgentChat).toBe(false)
    expect(text).not.toContain(ESIM_AGENT_CHAT_URL)
    expect(text).not.toContain(ESIM_AGENT_CHAT_LABEL)
  })
})
