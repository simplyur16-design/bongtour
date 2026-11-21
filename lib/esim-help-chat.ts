/**
 * eSIM 상담 챗봇이 읽는 문장. 설치 안내·FAQ·여행자 인증에 있는 문장만 고른다.
 * REGRESSION-FREEZE[esim-help-chat-1121]: 저장 문장만·고객센터 연결링크 — manifest
 */
import { ANDROID_STEPS, IOS_STEPS, type GuideStep } from '@/lib/bongsim/esim-guide-content'
import { ESIM_TRAVELER_AUTH_BULLETS } from '@/lib/bongsim/esim-install-guide'
import { ESIM_AGENT_CHAT_LABEL, ESIM_AGENT_CHAT_URL, esimAgentChatLine } from '@/lib/talktalk-draft/esim-agent-chat'
import { ADMIN_DRAFT_FAQ } from '@/lib/talktalk-draft/faq'

export type ChatMood = 'hello' | 'think' | 'help' | 'sorry'

export type ChatTopic = {
  id: string
  label: string
  lines: string[]
}

function faqAnswer(id: string): string {
  return ADMIN_DRAFT_FAQ.find((item) => item.id === id)?.answer?.trim() ?? ''
}

function guideLines(steps: readonly GuideStep[]): string[] {
  const lines: string[] = []
  for (const step of steps) {
    if (step.title.trim()) lines.push(step.title.trim())
    for (const block of step.blocks) {
      for (const bullet of block.bullets ?? []) {
        const text = bullet.trim()
        if (text) lines.push(text)
      }
    }
  }
  return lines
}

function topic(id: string, label: string, lines: string[]): ChatTopic {
  return { id, label, lines: lines.map((line) => line.trim()).filter(Boolean) }
}

export const ESIM_HELP_TOPICS: readonly ChatTopic[] = [
  topic('iphone', '아이폰 설치', guideLines(IOS_STEPS)),
  topic('galaxy', '갤럭시 설치', guideLines(ANDROID_STEPS)),
  topic('manual', 'QR·수동 입력', [faqAnswer('esim-reg-manual-ios'), faqAnswer('esim-reg-manual-android')]),
  topic('window', '개통 시점', [faqAnswer('esim-install-window'), faqAnswer('esim-local-install-error')]),
  topic('data', '데이터 안 됨', [faqAnswer('esim-data-roaming'), faqAnswer('esim-apn'), faqAnswer('esim-airplane')]),
  topic('hotspot', '핫스팟', [faqAnswer('esim-hotspot')]),
  topic('device', '기기 호환', [faqAnswer('esim-models')]),
  topic('auth', '여행자 인증', [...ESIM_TRAVELER_AUTH_BULLETS]),
  topic('usage', '사용량', [faqAnswer('esim-usage-phone'), faqAnswer('esim-usage-mypage')]),
  topic('refund', '환불·취소', [faqAnswer('esim-refund')]),
]

export function esimHelpTopic(id: string): ChatTopic | null {
  return ESIM_HELP_TOPICS.find((item) => item.id === id) ?? null
}

export const ESIM_HELP_ORDER_PROMPT = '주문번호'
export const ESIM_HELP_NO_ISSUE = '아직 발급 정보가 없습니다.'
export const ESIM_HELP_NO_ORDERS = '아직 eSIM 주문 내역이 없습니다.'
export const ESIM_HELP_QR_READY = 'QR코드가 발급됩니다.'

export { ESIM_AGENT_CHAT_LABEL, ESIM_AGENT_CHAT_URL, esimAgentChatLine }

export function esimHelpTranscript(lines: readonly string[]): string {
  return [...lines, esimAgentChatLine()].filter(Boolean).join('\n')
}
