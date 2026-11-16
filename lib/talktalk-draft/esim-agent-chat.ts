/**
 * eSIM 문의가 FAQ로 끝나지 않을 때 초안에 붙이는 고객센터 채팅 주소.
 * 표시 이름은 아래 라벨만 쓴다.
 */
import { faqMemberships, selectDraftFaq } from '@/lib/talktalk-draft/faq'
import { inferTalktalkFaqCategory } from '@/lib/talktalk-draft/parse-inquiry'

export const ESIM_AGENT_CHAT_URL = 'https://usimsa.channel.io/home'
export const ESIM_AGENT_CHAT_LABEL = '고객센터 연결링크'

const AGENT_HANDOFF = /상담원|상담|연결|해결\s*안\s*됨/

export function esimAgentChatLine(): string {
  return `${ESIM_AGENT_CHAT_LABEL}: ${ESIM_AGENT_CHAT_URL}`
}

export function matchedEsimFaqCount(inquiryText: string): number {
  if (inferTalktalkFaqCategory(inquiryText) !== 'esim') return 0
  return selectDraftFaq(inquiryText).filter((item) => faqMemberships(item).includes('esim')).length
}

/** eSIM이 아니면 항상 거짓. 매칭 FAQ가 없거나 상담 연결을 청하면 참. */
export function esimAgentChatDecision(isEsimInquiry: boolean, esimFaqCount: number, inquiryText: string): boolean {
  if (!isEsimInquiry) return false
  if (esimFaqCount === 0) return true
  return AGENT_HANDOFF.test(inquiryText)
}

export function shouldAttachEsimAgentChat(inquiryText: string): boolean {
  return esimAgentChatDecision(
    inferTalktalkFaqCategory(inquiryText) === 'esim',
    matchedEsimFaqCount(inquiryText),
    inquiryText,
  )
}
