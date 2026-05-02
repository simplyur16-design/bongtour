/** [modetour] register-llm-blocks */
/**
 * LLM 등록 파싱 입력 합성 — 추출 SSOT용 블록 라벨 고정.
 * 공통 등록 본류: 관리자 복붙 텍스트만. URL·HTML fetch·어댑터 요약 없음.
 */

export type RegisterPasteSections = {
  priceTable: string
  optionalTour: string
  shopping: string
  airlineMeeting: string
  includedExcluded: string
  hotel: string
  requiredChecks: string
  imageFileNamesAndSpotLabels: string
}

function extractImageFileNamesAndSpotLabels(rawText: string): string {
  const lines = rawText.replace(/\r/g, '').split('\n')
  const picked: string[] = []
  for (const ln of lines) {
    const t = ln.trim()
    if (!t) continue
    const hasImageFile = /\.(?:jpg|jpeg|png|webp|gif)\b/i.test(t)
    const hasImageUrl = /https?:\/\/\S+\.(?:jpg|jpeg|png|webp|gif)\b/i.test(t)
    const hasSpotLabel =
      /(day\s*\d{1,2}|관광지|스팟|명소|attraction|caption|캡션|image\s*name|imageDisplayName)/i.test(t)
    if (!hasImageFile && !hasImageUrl && !hasSpotLabel) continue
    picked.push(t.slice(0, 200))
    if (picked.length >= 20) break
  }
  return picked.join('\n').trim()
}

/** 줄 단위로 흔한 공급사 섹션 헤더를 찾아 스니펫을 분리 */
export function segmentSupplierPasteForLlm(rawText: string): RegisterPasteSections {
  const lines = rawText.replace(/\r/g, '').split('\n')
  const n = lines.length

  const findFirst = (pred: (ln: string) => boolean): number => lines.findIndex(pred)
  const findNextSection = (from: number): number => {
    for (let i = from + 1; i < n; i++) {
      const ln = lines[i]
      if (
        /(?:상품\s*)?가격표|연령별\s*(?:요금|판매가)|요금\s*안내\s*\(원\)|^\s*구분\s*성인/i.test(ln) ||
        /선택관광\s*(?:안내|명|비용)|쇼핑센터\s*안내|포함\s*사항|불포함\s*사항|항공\s*(?:스케줄|편명)|미팅|집결|호텔\s*(?:안내|정보|숙소)|꼭\s*확인|필수\s*체크|유의\s*사항|준비물/i.test(ln)
      ) {
        return i
      }
    }
    return n
  }

  const priceStart = findFirst((ln) =>
    /(?:상품\s*)?가격표|연령별\s*(?:요금|판매가)|요금\s*안내\s*\(원\)|^\s*구분\s*성인|성인\s*\/\s*아동/i.test(ln)
  )
  const optStart = findFirst((ln) => /선택관광|현지\s*옵션|옵션\s*투어/i.test(ln))
  const shopStart = findFirst((ln) => /쇼핑센터|쇼핑\s*안내|총\s*\d+\s*회.*쇼핑/i.test(ln))
  const airStart = findFirst((ln) =>
    /항공\s*(?:사|편명|스케줄)|가는\s*편|오는\s*편|출발\s*[:：]|도착\s*[:：]|편명|미팅|집결/i.test(ln)
  )
  const incStart = findFirst((ln) => /포함\s*사항|불포함\s*사항/i.test(ln))
  const hotelStart = findFirst((ln) => /호텔\s*(?:안내|정보|숙소)|숙박\s*호텔|에어텔.*호텔/i.test(ln))
  const mustStart = findFirst((ln) =>
    /꼭\s*확인|필수\s*체크|유의\s*사항|준비물|여행\s*전\s*확인|입국|비자/i.test(ln)
  )

  const sliceRange = (start: number, endExclusive: number): string =>
    start >= 0 ? lines.slice(start, Math.max(start, endExclusive)).join('\n').trim() : ''

  const priceEnd = priceStart >= 0 ? findNextSection(priceStart) : 0
  const optEnd = optStart >= 0 ? findNextSection(optStart) : 0
  const shopEnd = shopStart >= 0 ? findNextSection(shopStart) : 0
  const airEnd = airStart >= 0 ? findNextSection(airStart) : 0
  const incEnd = incStart >= 0 ? findNextSection(incStart) : 0
  const hotelEnd = hotelStart >= 0 ? findNextSection(hotelStart) : 0
  const mustEnd = mustStart >= 0 ? findNextSection(mustStart) : 0
  const imageHints = extractImageFileNamesAndSpotLabels(rawText)

  return {
    priceTable: priceStart >= 0 ? sliceRange(priceStart, priceEnd) : '',
    optionalTour: optStart >= 0 ? sliceRange(optStart, optEnd) : '',
    shopping: shopStart >= 0 ? sliceRange(shopStart, shopEnd) : '',
    airlineMeeting: airStart >= 0 ? sliceRange(airStart, airEnd) : '',
    includedExcluded: incStart >= 0 ? sliceRange(incStart, incEnd) : '',
    hotel: hotelStart >= 0 ? sliceRange(hotelStart, hotelEnd) : '',
    requiredChecks: mustStart >= 0 ? sliceRange(mustStart, mustEnd) : '',
    imageFileNamesAndSpotLabels: imageHints,
  }
}

/** 붙여넣기 본문과 동일한 줄바꿈 규칙으로 비교 (섹션 스니펫 ⊂ 본문 판별용) */
function normalizePasteNewlines(s: string): string {
  return s.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
}

/**
 * 자동 분리 스니펫이 [PASTED SUPPLIER BODY]에 이미 온전히 포함되면 LLM 입력 중복을 생략한다.
 * 명시 블록(explicit)은 관리자가 따로 붙인 것이므로 생략하지 않는다.
 */
function omitIfRedundantWithBody(segment: string, bodyForCompare: string, blockLabel: string): string | null {
  const seg = normalizePasteNewlines(segment).trim()
  if (!seg) return null
  const bodyN = normalizePasteNewlines(bodyForCompare)
  if (!bodyN.includes(seg)) return null
  return `(본문 중복 생략: ${blockLabel} 구간은 위 [PASTED SUPPLIER BODY]에 이미 포함됨. 우선순위·추출 규칙은 동일하게 적용.)`
}

export type RegisterPastedBlocksInput = {
  /** 전체 상세 복붙(필수 SSOT) */
  pastedBody: string
  /** 선택: 관리자가 따로 붙인 블록 — 있으면 자동 분리보다 우선 */
  priceTable?: string | null
  airlineTransport?: string | null
  optionalTour?: string | null
  shopping?: string | null
  includedExcluded?: string | null
  hotel?: string | null
  /** 꼭 확인하세요 원문 */
  requiredChecks?: string | null
  /** 이미지 파일명/관광지 라벨 힌트(텍스트 구조화만; 이미지 source 금지) */
  imageFileNamesAndSpotLabels?: string | null
}

export type BuildRegisterLlmInputOptions = {
  /** true: 미리보기 전용 — 입력 분량 축소 + 출력은 장문 raw 최소화 지시와 맞춤 */
  forPreview?: boolean
}

const FULL_BODY_MAX = 32000
const PREVIEW_BODY_MAX = 24000
const FULL_BLOCK_MAX = 32000
const PREVIEW_BLOCK_MAX = 12000
/** 미리보기: 옵션·쇼핑 전체를 JSON에 옮기다 MAX_TOKENS — 입력도 앞부분만 */
const PREVIEW_OPTION_SHOPPING_BLOCK_MAX = 6500

/**
 * LLM 입력 — 블록 제목·순서 고정. HTML fetch·URL 요약·수동 가격 보조 없음.
 */
export function buildRegisterLlmInputBlocks(
  opts: RegisterPastedBlocksInput,
  buildOpts?: BuildRegisterLlmInputOptions
): string {
  const seg = segmentSupplierPasteForLlm(opts.pastedBody)
  const empty = '(해당 블록: 본문에서 자동 분리 미검출 — [PASTED SUPPLIER BODY] 참고)'
  const preview = buildOpts?.forPreview === true
  const bodyMax = preview ? PREVIEW_BODY_MAX : FULL_BODY_MAX
  const blockMax = preview ? PREVIEW_BLOCK_MAX : FULL_BLOCK_MAX

  const body = opts.pastedBody.trim().slice(0, bodyMax)

  const pick = (explicit: string | null | undefined, segmented: string, blockLabel: string) => {
    const e = explicit?.trim()
    if (e) return e.slice(0, blockMax)
    const segTrim = segmented.trim()
    if (!segTrim) return empty
    const omitted = omitIfRedundantWithBody(segTrim, body, blockLabel)
    if (omitted) return omitted
    return segTrim.slice(0, blockMax)
  }

  const pickOptionOrShopping = (explicit: string | null | undefined, segmented: string, blockLabel: string) => {
    const cap = preview ? PREVIEW_OPTION_SHOPPING_BLOCK_MAX : blockMax
    const e = explicit?.trim()
    if (e) return e.slice(0, cap)
    const segTrim = segmented.trim()
    if (!segTrim) return empty
    const omitted = omitIfRedundantWithBody(segTrim, body, blockLabel)
    if (omitted) return omitted
    return segTrim.slice(0, cap)
  }

  const structuredHotelMealRules = preview
    ? `=== [STRUCTURED HOTEL / MEAL — 미리보기] ===
- 입력은 참고만. 응답 JSON에서는 schedule[] 일차별 hotelText·breakfastText·lunchText·dinnerText·mealSummaryText 를 모두 null.
- 상품 전체 호텔은 hotelSummaryText(한 줄)·hotelNames[] 짧게만. hotelInfoRaw·hotelNoticeRaw 는 응답에서 null.

=== [미리보기 — 옵션·쇼핑·일정 출력 상한] ===
- JSON 출력: optionalTours **최대 3행**, shoppingStops **최대 3행**, 각 행 \`raw\` 는 null. 총 개수는 optionalTourCount·shoppingVisitCount·summary 텍스트만.
- schedule 은 일차당 title·description 을 공급사 일정표에 맞게 **충실히**(일차당 description 3~4문장·400자 이내 권장, 한 줄 요약 금지). 필요 시 일차 수 14 이하.`
    : `=== [STRUCTURED HOTEL / MEAL — JSON 추출 규칙] ===
- hotelSummaryText: 상품 전체 호텔 요약 한 줄(예: 대표호텔명 외 1). [PASTED HOTEL INFO]·본문 원문에 있을 때만. 없으면 null.
- schedule[] 각 일차: hotelText(해당 일 예정 숙소/호텔), breakfastText·lunchText·dinnerText(조·중·석), mealSummaryText(식사 원문 전체). 상품 전체 호텔과 일차 호텔은 분리.
- 식사는 가능하면 조·중·석으로 나누고, 불확실하면 mealSummaryText에만 원문 보존(breakfast/lunch/dinner는 null).
- 창작·추론·빈 문자열 생성 금지. 없으면 null.`

  return `
=== [PASTED SUPPLIER BODY] ===
${body || '((없음))'}

=== [PASTED PRICE TABLE] ===
${pick(opts.priceTable, seg.priceTable, '[PASTED PRICE TABLE]')}

=== [PASTED AIRLINE OR TRANSPORT INFO] ===
${pick(opts.airlineTransport, seg.airlineMeeting, '[PASTED AIRLINE OR TRANSPORT INFO]')}

=== [PASTED OPTIONAL TOUR] ===
${pickOptionOrShopping(opts.optionalTour, seg.optionalTour, '[PASTED OPTIONAL TOUR]')}

=== [PASTED SHOPPING INFO] ===
${pickOptionOrShopping(opts.shopping, seg.shopping, '[PASTED SHOPPING INFO]')}

=== [PASTED INCLUDED / EXCLUDED] ===
${pick(opts.includedExcluded, seg.includedExcluded, '[PASTED INCLUDED / EXCLUDED]')}

=== [PASTED HOTEL INFO] ===
${pick(opts.hotel, seg.hotel, '[PASTED HOTEL INFO]')}

=== [PASTED REQUIRED CHECKS] ===
${pick(opts.requiredChecks, seg.requiredChecks, '[PASTED REQUIRED CHECKS]')}

=== [IMAGE FILE NAMES AND SPOT LABELS] ===
${pick(opts.imageFileNamesAndSpotLabels, seg.imageFileNamesAndSpotLabels, '[IMAGE FILE NAMES AND SPOT LABELS]')}

${structuredHotelMealRules}
`.trim()
}

const PREVIEW_MINIMAL_BODY_MAX = 28000
const PREVIEW_MINIMAL_CHECKS_MAX = 12000

/**
 * 미리보기 전용: LLM은 상품 메타·짧은 fieldIssues만(토큰·MAX_TOKENS 잘림 방지).
 * mustKnow·요약·프로모·서술형은 출력하지 않음 — 확정 파싱에서 채움.
 */
export function buildRegisterPreviewMinimalLlmInputBlocks(opts: RegisterPastedBlocksInput): string {
  const body = opts.pastedBody.trim().slice(0, PREVIEW_MINIMAL_BODY_MAX)
  const seg = segmentSupplierPasteForLlm(opts.pastedBody)
  const empty = '(해당 블록: 없음)'
  const checksExplicit = opts.requiredChecks?.trim()
  const checks = (checksExplicit || seg.requiredChecks.trim()).slice(0, PREVIEW_MINIMAL_CHECKS_MAX)
  return `
=== [등록 미리보기 — LLM 입력 범위] ===
- 표 행·출발일 달력·선택관광/쇼핑 표는 이 프롬프트에 없어도 된다. 서버가 본문 전체를 별도 파싱한다.
- 응답 JSON은 **메타 필드와 fieldIssues(최대 3건)만**. mustKnow·summary·pricePromotion·장문 금지.

=== [PASTED SUPPLIER BODY] ===
${body || '((없음))'}

=== [PASTED REQUIRED CHECKS] ===
${checks || empty}
`.trim()
}
