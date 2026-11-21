/**
 * 네이버 톡톡 자동답변 판단(순수 함수). 상품 사진·설명·FAQ로 답하고, FAQ로 해결되지 않으면 상담원 연결.
 * 가격·출발일·잔여석 문장은 만들지 않는다(상품 페이지 달력 기준 안내만). 공급사 이름·eSIM 공급사 이름은 넣지 않는다.
 * 자동답변 안전장치: 가격 생성 금지·상담원 연결·기본 발송 꺼짐
 */
import {
  faqMemberships,
  ADMIN_DRAFT_FAQ,
  rankFaqByTopics,
  talktalkSpecificTopicsForText,
  type TalktalkDraftFaqItem, type TalktalkFaqTopic } from '@/lib/talktalk-draft/faq'
import { inferTalktalkFaqCategory } from '@/lib/talktalk-draft/parse-inquiry'
import { ESIM_AGENT_CHAT_LABEL, ESIM_AGENT_CHAT_URL } from '@/lib/talktalk-draft/esim-agent-chat'

export const TALKTALK_AUTOREPLY_SITE = 'https://bongtour.com'

export type AutoReplyProduct = {
  title: string
  /** 사이트 상대 경로 또는 절대 URL */
  href: string
  imageUrl: string | null
  summary: string | null
}

export type AutoReplyMessage =
  | { kind: 'text'; text: string }
  | {
      kind: 'composite'
      title: string
      description: string
      imageUrl: string | null
      linkLabel: string
      linkUrl: string
    }

export type AutoReplyMode = 'product' | 'faq' | 'handover' | 'ignore'

export type AutoReplyDecision = {
  mode: AutoReplyMode
  messages: AutoReplyMessage[]
  /** 상담원(파트너센터)에게 대화 주도권을 넘길지 */
  handover: boolean
  faqIds: string[]
  reason: string
}

export type AutoReplyInput = {
  text: string
  /** 고객이 사진을 보냈는지 */
  hasImage?: boolean
  /** 상담원이 응대 중(standby)이면 답하지 않는다 */
  standby?: boolean
  product?: AutoReplyProduct | null
}

const AGENT_REQUEST = /상담원|상담사|사람이랑|사람과|직원|담당자|전화\s*(주세요|부탁|상담)|통화/
const WON_TEST = /\d{1,3}(?:,\d{3})+\s*원|\d+\s*원|\d+\s*만\s*원|[$€¥£]\s*\d/
const SUPPLIER_RE =
  /하나투어|모두투어|노랑풍선|내일투어|롯데관광|참좋은여행|교원투어|한진관광|인터파크|ybtour|hanatour|modetour|verygood|유심사|usimsa/i

/** 고객에게 보이는 문장에서 공급사 이름이 있으면 그 줄을 뺀다. 상담 연결 주소 줄은 예외. */
export function sanitizeCustomerText(text: string): string {
  return text
    .split('\n')
    .filter((line) => line.includes(ESIM_AGENT_CHAT_URL) || !SUPPLIER_RE.test(line))
    .join('\n')
    .trim()
}

/** 저장 요약에서 금액 문장은 뺀다(가격은 상품 페이지 달력 기준). */
export function summaryWithoutAmounts(summary: string | null | undefined, max = 240): string {
  const s = String(summary ?? '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!s) return ''
  const sentences = s.split(/(?<=[.!?。])\s+/).filter((x) => !WON_TEST.test(x) && !SUPPLIER_RE.test(x))
  let out = ''
  for (const x of sentences) {
    if ((out + ' ' + x).trim().length > max) break
    out = (out + ' ' + x).trim()
  }
  return out
}

export function matchedFaqTopics(text: string): Set<TalktalkFaqTopic> {
  const topics = new Set<TalktalkFaqTopic>()
  if (/취소|환불|변경/.test(text)) {
    topics.add('cancel')
    topics.add('refund')
  }
  if (/결제|카드|할부|영수증|현금/.test(text)) topics.add('payment')
  if (/예약|확정|접수|견적|단체|맞춤/.test(text)) topics.add('booking')
  if (/여권|영문/.test(text)) topics.add('passport')
  if (/비자|전자여행허가|eta|esta/i.test(text)) topics.add('visa')
  if (/진행|순서|절차/.test(text)) topics.add('process')
  if (/e\s*sim|이심|qr|설치|로밍|apn|갤럭시|아이폰|핫스팟|테더|사용량/i.test(text)) topics.add('esim')
  for (const t of talktalkSpecificTopicsForText(text)) topics.add(t)
  return topics
}

/** 기본값 없이 실제 주제가 맞은 FAQ만. 없으면 빈 배열(= FAQ로 해결 못 함). */
export function selectAutoReplyFaq(text: string, limit = 2): TalktalkDraftFaqItem[] {
  const topics = matchedFaqTopics(text)
  if (topics.size === 0) return []
  const category = inferTalktalkFaqCategory(text)
  const topical = rankFaqByTopics(
    ADMIN_DRAFT_FAQ.filter((item) => item.topics.some((t) => topics.has(t))),
    topics,
    text,
  )
  const pool =
    category === 'esim'
      ? topical.filter((item) => faqMemberships(item).includes('esim'))
      : category === 'common'
        ? topical.filter((item) => !faqMemberships(item).every((c) => c === 'esim'))
        : topical.filter((item) => faqMemberships(item).includes(category) || item.category === 'common')
  return (pool.length > 0 ? pool : topical).slice(0, limit)
}

export function absoluteSiteUrl(href: string): string {
  if (/^https?:\/\//i.test(href)) return href
  return `${TALKTALK_AUTOREPLY_SITE}${href.startsWith('/') ? '' : '/'}${href}`
}

function faqText(items: readonly TalktalkDraftFaqItem[]): string {
  return items.map((item) => `Q. ${item.question}\n${item.answer}`).join('\n\n')
}

const HANDOVER_TEXT =
  '문의 주셔서 감사합니다. 정확한 안내를 위해 담당 상담원에게 연결해 드릴게요. 상담 가능 시간에 순서대로 답변드리겠습니다.'

function handover(reason: string, extra?: string): AutoReplyDecision {
  return {
    mode: 'handover',
    messages: [{ kind: 'text', text: extra ? `${HANDOVER_TEXT}\n\n${extra}` : HANDOVER_TEXT }],
    handover: true,
    faqIds: [],
    reason,
  }
}

export function decideTalktalkAutoReply(input: AutoReplyInput): AutoReplyDecision {
  if (input.standby) return { mode: 'ignore', messages: [], handover: false, faqIds: [], reason: 'standby' }
  const text = String(input.text ?? '').trim()
  if (input.hasImage && !text) return handover('image-only')
  if (!text) return { mode: 'ignore', messages: [], handover: false, faqIds: [], reason: 'empty' }
  if (AGENT_REQUEST.test(text)) return handover('agent-request')

  const isEsim = inferTalktalkFaqCategory(text) === 'esim'
  const faq = selectAutoReplyFaq(text)

  if (input.product) {
    const p = input.product
    const summary = summaryWithoutAmounts(p.summary)
    const parts = [
      summary,
      '출발일별 요금과 예약 가능 여부는 상품 페이지 달력에서 바로 확인하실 수 있어요.',
      faq.length > 0 ? faqText(faq) : '',
    ].filter(Boolean)
    const description = sanitizeCustomerText(parts.join('\n\n')).slice(0, 1000)
    return {
      mode: 'product',
      messages: [
        {
          kind: 'composite',
          title: sanitizeCustomerText(p.title).slice(0, 200) || '상품 안내',
          description,
          imageUrl: p.imageUrl,
          linkLabel: '상품 자세히 보기',
          linkUrl: absoluteSiteUrl(p.href),
        },
      ],
      handover: false,
      faqIds: faq.map((f) => f.id),
      reason: 'product',
    }
  }

  if (faq.length === 0) {
    if (isEsim) return handover('esim-no-faq', `${ESIM_AGENT_CHAT_LABEL}: ${ESIM_AGENT_CHAT_URL}`)
    return handover('no-faq')
  }

  const body = sanitizeCustomerText(faqText(faq))
  if (!body) return handover('faq-sanitized-empty')
  return {
    mode: 'faq',
    messages: [
      {
        kind: 'text',
        text: `${body}\n\n더 궁금하신 점은 '상담원 연결'이라고 남겨 주시면 담당자가 이어서 안내드릴게요.`,
      },
    ],
    handover: false,
    faqIds: faq.map((f) => f.id),
    reason: 'faq',
  }
}

/** 네이버 톡톡 send 이벤트 본문으로 바꾼다(전송은 하지 않는다). */
export function toNaverSendEvent(user: string, message: AutoReplyMessage): Record<string, unknown> {
  if (message.kind === 'text') {
    return { event: 'send', user, textContent: { text: message.text.slice(0, 10000) } }
  }
  const composite: Record<string, unknown> = {
    title: message.title,
    description: message.description,
    buttonList: [
      {
        type: 'LINK',
        data: { title: message.linkLabel.slice(0, 18), url: message.linkUrl, mobileUrl: message.linkUrl },
      },
    ],
  }
  if (message.imageUrl) composite.image = { imageUrl: message.imageUrl }
  return { event: 'send', user, compositeContent: { compositeList: [composite] } }
}

/** 문의 문장에서 bongtour 상품 링크·상품코드를 찾는다. */
export function extractProductRef(text: string): string | null {
  const url = text.match(/bongtour\.com\/products\/([A-Za-z0-9_-]+)/i)
  if (url) return url[1]
  const code = text.match(/\b([A-Z]{2,5}[0-9]{3,}[A-Z0-9]*|pkg-[a-z]{2}-\d{3,4}|fit-[a-z]{2}-\d{3,4})\b/)
  return code ? code[1] : null
}
