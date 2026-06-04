import {
  BONGTOUR_PRODUCT_TITLE_LENGTH_HARD_MAX,
  BONGTOUR_PRODUCT_TITLE_LENGTH_PREFERRED_MAX,
  BONGTOUR_PRODUCT_TITLE_LENGTH_PREFERRED_MIN,
  BONGTOUR_PRODUCT_TITLE_TEMPLATE,
  BONGTOUR_PRODUCT_TITLE_TONE_VERSION,
} from '@/lib/bongtour-product-title-tone-ssot'

export type BongtourProductTitleLlmInput = {
  /** canonical: modetour | hanatour | ybtour | verygoodtour | kyowontour | lottetour */
  brandKey: string
  /** UI·프롬프트용 한글 라벨(참좋은여행 등) */
  supplierDisplayLabel: string
  /** 공급사 파싱 상품명(원본) */
  originalProductTitle: string
  /** 붙여넣기 본문 전체(축약하지 말 것 — 호출부에서 상한 자름) */
  pastedBodyText: string
  duration: string | null | undefined
  /** LLM/파서 destination 필드 */
  destination?: string | null | undefined
  /** 일차 제목 등 일정 단서 */
  scheduleDayTitles: string[]
}

export type BongtourProductTitleLlmOutput = {
  title: string
}

const FEW_SHOT = `
[예시 1]
원본: 코카서스 3국 10일 KE #두바이관광 #인솔자동행 #10대특전
duration: 9박 10일
출력: 코카서스 3국·두바이 9박 10일 [KE 대한항공]

[예시 2]
원본: [다시찾은] 다낭·호이안 5일
duration: 4박 5일
출력: 베트남 다낭·호이안 4박 5일

[예시 3]
원본: 도쿄 4일 전일 관광 일본 최고의 온천마을 하코네부터 …
duration: 3박 4일
출력: 일본 도쿄·하코네 3박 4일

[예시 4]
원본: 부산 [비즈니즈_대한항공][NO옵션] 다낭,호이안 5일 ▶[힐튼]
duration: 4박 5일
출력: [부산 출발] 베트남 다낭·호이안 4박 5일 [KE 비즈니스]

[예시 5]
원본: [KE][관광/체험][PRIVATE TOUR] 호치민 5일
duration: 4박 5일
출력: 베트남 호치민 4박 5일 [KE·PRIVATE TOUR]

[예시 6]
원본: [노팁 노옵션] 동유럽 3~4개국 9일 체.헝.오 / 일급호텔
duration: 7박 9일
출력: 동유럽 3~4개국(체코·헝가리·오스트리아) 7박 9일 [노팁·노옵션]

[예시 7]
원본: [티웨이 항공 직항] 코카서스 3국 일주 9일 조지아 와인/아르메니아 …
duration: 8박 9일
출력: 코카서스 3국 일주 8박 9일 [TW 직항]

[예시 8]
원본: [증편기][신주쿠] 도쿄 자유 3일 (신주쿠워싱턴_트윈/조식포함)
duration: 2박 3일
출력: 일본 도쿄 자유여행 2박 3일 [신주쿠·조식 포함]
`.trim()

function supplierTitleAddendum(brandKey: string): string {
  switch (brandKey) {
    case 'modetour':
      return '- 모두투어: 원본 #해시·[배지]는 노출명에서 빼되, **국가·도시·박일**은 반드시 남긴다.'
    case 'hanatour':
      return '- 하나투어: 리스트 제목의 다도시(·/+)와 N박M일을 유지한다.'
    case 'ybtour':
      return '- 노랑풍선: 원문 도시 나열·일수를 우선하고 특전 키워드 나열로 대체하지 않는다.'
    case 'verygoodtour':
      return '- 참좋은여행: 베리굿투어 표기 금지. 권역·도시·박일 중심.'
    case 'kyowontour':
      return '- 교원이지: 상품명 앞 [배지] 제거 후 국가·도시·박일만 정리.'
    case 'lottetour':
      return '- 롯데관광: 롯데 카피 축약보다 **마케팅 지역+도시+박일**을 우선.'
    default:
      return ''
  }
}

export function buildBongtourProductTitlePrompt(input: BongtourProductTitleLlmInput): {
  systemPrompt: string
  userPrompt: string
} {
  const scheduleBlock =
    input.scheduleDayTitles.length > 0
      ? input.scheduleDayTitles.slice(0, 14).map((t, i) => `${i + 1}일차: ${t}`).join('\n')
      : '(일정 제목 없음)'

  const addendum = supplierTitleAddendum(input.brandKey)

  const systemPrompt = `당신은 한국어 해외 패키지 **노출 상품명**을 「봉투어」 마케팅 형식에 맞게 다듬는 편집기다.
규칙 버전: ${BONGTOUR_PRODUCT_TITLE_TONE_VERSION}

[역할]
입력: 공급사 원문 상품명 + duration + destination + 일정 제목 + 본문. 환각 금지.

[출력 형식 — 반드시 JSON 한 개만]
{"title":"한 줄 상품명"}

[마케팅 SSOT — 최우선]
- **형식:** ${BONGTOUR_PRODUCT_TITLE_TEMPLATE}
- **duration 필드**가 있으면 N박M일은 duration을 그대로 따른다(원본이 10일만 있어도 duration이 9박 10일이면 9박 10일).
- **마케팅 국가/권역:** 동유럽·코카서스 3국·일본·베트남·중동 등(원문·destination 근거).
- **도시:** 핵심 1~2개만 가운뎃점(·)으로. 3개 이상 나열·특전 키워드 줄로 대체 금지.
- **짧게 압축 금지:** 원문에 있는 국가·도시·박일 정보를 빼서 미슐랭·테마파크·와이너리만 남기지 말 것.
- [] 괄호: 항공·출발·직항/경유·인솔·NO옵션 등 **원문에 분명할 때만 1블록**. 없으면 생략.
- () 괄호: 다국가일 때 국가명 1~3개 보조(선택).
- 호텔명·4성급·힐튼·인디고 등 숙소 브랜드는 넣지 않는다(업그레이드 명시만 예외).
- #해시태그·★※▶ 제거. 가운뎃점(·)·플러스(+)만.
- 금칙: 엄선, 프리미엄, 단독, THE NEW, 더할 나위 없는, 천천히 알차게, 베리굿투어.
- 길이: ${BONGTOUR_PRODUCT_TITLE_LENGTH_PREFERRED_MIN}~${BONGTOUR_PRODUCT_TITLE_LENGTH_PREFERRED_MAX}자 권장, ${BONGTOUR_PRODUCT_TITLE_LENGTH_HARD_MAX}자 초과 금지.

${addendum ? `[공급사]\n${addendum}\n` : ''}
[스타일 예시 — 문구 복붙 금지]
${FEW_SHOT}
`.trim()

  const bodyCap = 24_000
  const body = (input.pastedBodyText || '').trim().slice(0, bodyCap)

  const userPrompt = `[공급사 키] ${input.brandKey}
[공급사 표기] ${input.supplierDisplayLabel}
[원본 상품명]
${(input.originalProductTitle || '').trim()}

[destination 필드]
${(input.destination ?? '').trim() || '(없음)'}

[여행기간 duration — N박M일 SSOT]
${(input.duration ?? '').trim() || '(없음)'}

[일정 제목]
${scheduleBlock}

[상세 본문]
${body}
`.trim()

  return { systemPrompt, userPrompt }
}
