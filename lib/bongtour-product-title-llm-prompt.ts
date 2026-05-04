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
  /** 일차 제목 등 일정 단서 */
  scheduleDayTitles: string[]
}

export type BongtourProductTitleLlmOutput = {
  title: string
}

const FEW_SHOT = `
[예시 1]
원본: 코카서스 3국 10일 KE #두바이관광 #인솔자동행 #10대특전 #와이너리 #꼬냑시음
출력: 코카서스 3국(조지아·아제르바이잔·아르메니아)+두바이 10일 [KE 대한항공·인솔자 동행] 와이너리·꼬냑시음·10대특전

[예시 2]
원본: [다시찾은] 다낭·호이안 5일
출력: 다낭·호이안 5일 [대한항공·인솔자 동행] 호이안 메모리즈쇼·임프레션 테마파크·미슐랭

[예시 3]
원본: 도쿄 4일 전일 관광 일본 최고의 온천마을 하코네부터 근교 가와고에&화려한 도쿄까지 …
출력: 도쿄·하코네·가와고에 4일 [직항] 온천욕·오다이바·아사쿠사·신주쿠·전망대

[예시 4]
원본: 부산 [비즈니즈_대한항공][NO옵션][THE NEW PREMIUM 더할 나위 없는 완벽한] 다낭,호이안 5일 ▶[힐튼]
출력: [부산 출발] 다낭·호이안 5일 [KE 비즈니스 클래스 업그레이드·NO옵션]

[예시 5]
원본: [KE][관광/체험][PRIVATE TOUR] 호치민 5일 ▶[호텔 인디고 사이공]
출력: 호치민 5일 [KE 대한항공·PRIVATE TOUR·전담 가이드] 미슐랭 4회·풀만 호텔 SPA·아브라 탑승

[예시 6]
원본: [노팁 노옵션] 동유럽 3~4개국 9일 체.헝.오 / 일급호텔 / 패키지 속 자유(EPP4067-BUD)
출력: 동유럽 3~4개국(체코·헝가리·오스트리아) 9일 [노팁·노옵션·자유시간 포함]

[예시 7]
원본: [티웨이 항공 직항] 코카서스 3국 일주 9일 조지아 와인/아르메니아 브랜디투어 전일정 4성 호텔
출력: 코카서스 3국 일주 9일 [TW 티웨이항공 직항] 조지아 와인·아르메니아 브랜디 투어

[예시 8]
원본: [증편기][신주쿠] 도쿄 자유 3일 (신주쿠워싱턴_트윈/조식포함)
출력: 도쿄 자유여행 3일 [신주쿠 숙박·트윈·조식 포함]
`.trim()

export function buildBongtourProductTitlePrompt(input: BongtourProductTitleLlmInput): {
  systemPrompt: string
  userPrompt: string
} {
  const scheduleBlock =
    input.scheduleDayTitles.length > 0
      ? input.scheduleDayTitles.slice(0, 14).map((t, i) => `${i + 1}일차: ${t}`).join('\n')
      : '(일정 제목 없음)'

  const systemPrompt = `당신은 한국어 해외 패키지 상품명을 「봉투어」 노출 규칙에 맞게 다듬는 편집기다.
규칙 버전: ${BONGTOUR_PRODUCT_TITLE_TONE_VERSION}

[역할]
입력으로 주는 공급사 원문 상품명 + 상세 본문 + 일정 제목에서만 사실을 취한다. 환각 금지.

[출력 형식 — 반드시 JSON 한 개만, 설명·코드펜스 없이]
{"title":"한 줄 상품명"}

[톤]
- 정보 중심 + 약한 강조(키워드 나열). 셀러 과장 금지.
- 구분자는 가운뎍점(·)과 플러스(+)만 사용. 슬래시(/) 남발 금지.
- 괄호: () 안에 지역·도시 상세(1~3개), [] 안에 항공·출발·직항/경유·인솔·업그레이드·NO옵션 등 부가 정보.
- 강조 기호(★※◎◆▶) 사용 금지.
- 다음 표현은 사용 금지: 엄선, 프리미엄, 단독, THE NEW, 더할 나위 없는, 천천히 알차게, 베리굿투어.
- verygoodtour(참좋은여행) 상품이면 브랜드는 「참좋은여행」으로 통일(베리굿투어 표기 금지).
- 호텔 단순 등급·체인명(4성급, 힐튼, 인디고 등)은 상품명에 넣지 않는다. 단, 「업그레이드」가 원문에 명시된 경우만 예외(예: 비즈니스 업그레이드, 디럭스→스위트 업그레이드).
- 길이: 가능하면 ${BONGTOUR_PRODUCT_TITLE_LENGTH_PREFERRED_MIN}~${BONGTOUR_PRODUCT_TITLE_LENGTH_PREFERRED_MAX}자. 짧은 자유여행은 더 짧아도 되나 ${BONGTOUR_PRODUCT_TITLE_LENGTH_HARD_MAX}자를 넘지 마라.
- 반드시 일수(N일 또는 N박M일) 포함.
- 한글 지역·상품 맥락을 유지한다.

[템플릿 가이드]
${BONGTOUR_PRODUCT_TITLE_TEMPLATE}

[품질 좋은 변환 예시 — 스타일만 참고, 문구 복붙 금지]
${FEW_SHOT}
`.trim()

  const bodyCap = 24_000
  const body = (input.pastedBodyText || '').trim().slice(0, bodyCap)

  const userPrompt = `[공급사 키] ${input.brandKey}
[공급사 표기] ${input.supplierDisplayLabel}
[원본 상품명]
${(input.originalProductTitle || '').trim()}

[여행기간 필드]
${(input.duration ?? '').trim() || '(없음)'}

[일정 제목]
${scheduleBlock}

[상세 본문]
${body}
`.trim()

  return { systemPrompt, userPrompt }
}
