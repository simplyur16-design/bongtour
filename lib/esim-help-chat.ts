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

/**
 * REGRESSION-FREEZE[esim-help-chat-categories-1122]: 처음엔 인사+중분류 버튼 6개, 분류를 누르면 그 안 질문 3~5개, 답은 짧게+더 보기 — manifest
 * 질문 문장은 화면용, 답은 저장 FAQ·인증 문장 그대로.
 */
export type HelpQuestion = { id: string; question: string; answer: string }
export type HelpCategory = { id: string; label: string; questions: HelpQuestion[] }

function q(id: string, question: string, answer: string): HelpQuestion {
  return { id, question, answer: answer.trim() }
}

function category(id: string, label: string, questions: HelpQuestion[]): HelpCategory {
  return { id, label, questions: questions.filter((item) => item.answer) }
}

export const ESIM_HELP_GREETING = '안녕하세요, 봉실장이에요. 어떤 점이 궁금하세요?'

export const ESIM_HELP_CATEGORIES: readonly HelpCategory[] = [
  category('install', '설치·개통', [
    q('iphone', '아이폰에는 어떻게 설치하나요?', faqAnswer('esim-iphone')),
    q('galaxy', '갤럭시에는 어떻게 설치하나요?', faqAnswer('esim-android')),
    q('manual', 'QR이 안 읽혀요', [faqAnswer('esim-reg-manual-ios'), faqAnswer('esim-reg-manual-android')].join('\n')),
    q('window', '국내에서 미리 설치해도 되나요?', faqAnswer('esim-install-window')),
    q('auth', '여행자 인증은 어떻게 하나요?', ESIM_TRAVELER_AUTH_BULLETS.join('\n')),
  ]),
  category('data', '데이터·핫스팟', [
    q('roaming', '데이터가 안 돼요', [faqAnswer('esim-data-roaming'), faqAnswer('esim-airplane')].join('\n')),
    q('apn', 'APN은 어디서 바꾸나요?', faqAnswer('esim-apn')),
    q('hotspot', '핫스팟·테더링이 되나요?', faqAnswer('esim-hotspot')),
    q('usage', '사용량은 어디서 보나요?', [faqAnswer('esim-usage-phone'), faqAnswer('esim-usage-mypage')].join('\n')),
  ]),
  category('buy', '구매·결제', [
    q('qr-sent', '결제하면 QR은 언제 오나요?', faqAnswer('esim-qr-sent')),
    q('qr-missing', 'QR이 안 보여요', faqAnswer('esim-qr-missing')),
    q('activate', '사용 기간은 언제부터인가요?', faqAnswer('esim-activate')),
  ]),
  category('refund', '취소·환불', [
    q('refund', '환불은 언제 되나요?', faqAnswer('esim-refund')),
    q('exchange', '교환할 수 있나요?', faqAnswer('esim-exchange')),
    q('early', '미리 설치하면 안 되는 상품을 설치했어요', faqAnswer('esim-early-install')),
    q('reinstall', '지웠다가 다시 설치할 수 있나요?', faqAnswer('esim-reinstall')),
  ]),
  category('device', '기기 호환', [
    q('check', '내 휴대폰이 eSIM을 지원하나요?', faqAnswer('esim-device-check')),
    q('models', '지원 기종을 알고 싶어요', faqAnswer('esim-models')),
    q('lock', '통신사 잠금폰도 되나요?', faqAnswer('esim-lock')),
    q('dual', '유심과 같이 쓰면 데이터는 어디로 가나요?', faqAnswer('esim-dual')),
    q('voice', 'eSIM으로 전화할 수 있나요?', faqAnswer('esim-voice')),
  ]),
]

/** 상담 연결 분류(주문 조회·고객센터 연결링크)는 화면에서 따로 그린다. */
export const ESIM_HELP_CONTACT_CATEGORY = { id: 'contact', label: '상담 연결' } as const

export function esimHelpCategory(id: string): HelpCategory | null {
  return ESIM_HELP_CATEGORIES.find((item) => item.id === id) ?? null
}

const HEADING_LIKE = /(하기|받기)\.?$/

/** 답을 짧은 앞부분(문장 2개, 140자 이내)과 '더 보기'로 펼칠 나머지로 나눈다. 문장은 바꾸지 않는다. */
export function splitHelpAnswer(answer: string, maxShort = 140): { short: string; rest: string } {
  const sentences = answer
    .split(/(?<=[.!?。])\s+|\n+/)
    .map((x) => x.trim())
    .filter(Boolean)
  const shortParts: string[] = []
  let i = 0
  for (; i < sentences.length; i++) {
    const s = sentences[i]
    if (shortParts.length === 0 && HEADING_LIKE.test(s)) continue
    if (shortParts.length >= 2 || (shortParts.join(' ') + ' ' + s).trim().length > maxShort) break
    shortParts.push(s)
  }
  if (shortParts.length === 0) return { short: sentences[0] ?? '', rest: sentences.slice(1).join('\n') }
  return { short: shortParts.join(' '), rest: sentences.slice(i).join('\n') }
}

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
