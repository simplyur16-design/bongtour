import { isProductHeroListingSeoContaminated } from '@/lib/product-hero-listing-seo-contamination'

/**
 * 상품 대표이미지·상품 카드 등 공개 화면 좌측 "검색형 감성 키워드" 한 줄.
 * 허브 페이지 히어로 멘트는 `lib/public-page-hero-editorial-line.ts` — 이 모듈과 섞지 않는다.
 * 공급사명·출처 문자열은 포함하지 않는다.
 *
 * 대표 슬라이드·카드·비교 카드 공통 `resolvePublicProductHeroSeoKeywordOverlay` 최종 우선순위(고정):
 * 1) `Product.publicImageHeroSeoKeywordsJson` — 섹션 라벨 오염(BROKEN) 토큰 제거 후 `primaryDestination`(있으면) + 키워드 최대 3개를 ` · ` 로 합침, 길이 상한 적용
 * 2) `Product.publicImageHeroSeoLine` — 구 등록 한 줄
 * 3) 대표 이미지 자산 캡션(`seoCaptionFromAsset`, 품질 통과 시)
 * 4) 공개 휴리스틱 `buildPublicProductHeroSeoKeywordOverlay` (자산 캡션 제외)
 */

/** 한눈에 읽히는 한 줄 상한(자 근접 시 …) */
const OVERLAY_MAX = 24

/** 자산 캡션: 짧다고 무조건 채택하지 않음(대략 20자 전후·키워드형만) */
const ASSET_CAPTION_MIN = 8
const ASSET_CAPTION_MAX = 22

const ASSET_BAN = /대표\s*이미지|상담|안내|입니다|습니다|해\s*주세요|문의|확인해|자세한|이\s*상품|패키지\s*상세|예약\s*가능|포함\s*사항|유의\s*사항/i

function isAcceptableSeoCaptionFromAsset(raw: string): boolean {
  const t = raw.replace(/\s+/g, ' ').trim()
  if (t.length < ASSET_CAPTION_MIN || t.length > ASSET_CAPTION_MAX) return false
  if (isProductHeroListingSeoContaminated(t)) return false
  if (ASSET_BAN.test(t)) return false
  // 설명문·장문형 회피: 문장 부호·종결 반복
  if (/[.!?。]{2,}/.test(t)) return false
  const ends = (t.match(/다\.|요\.|니다|어요|습니까|해요/g) || []).length
  if (ends >= 1) return false
  if ((t.match(/,/g) || []).length >= 2) return false
  if (/하여|위해|따라|경우|가능합니다|드립니다/.test(t)) return false
  return true
}

function truncateOneLine(s: string, max: number): string {
  const t = s.replace(/\s+/g, ' ').trim()
  if (t.length <= max) return t
  return `${t.slice(0, Math.max(0, max - 1)).trimEnd()}…`
}

function compactDuration(dur: string): string | null {
  const t = dur.replace(/\s+/g, ' ').trim()
  const m = t.match(/(\d+)\s*박\s*(\d+)\s*일/)
  if (!m) return null
  return `${m[1]}박${m[2]}일`
}

/** 등록·키워드 조합 등에서 재사용하는 짧은 기간 표기(예: 3박4일) */
export function compactDurationLabelForProductSeo(durationRaw: string | null | undefined): string | null {
  return compactDuration(durationRaw ?? '')
}

/** 짧고 밋밋할 때만 기간 덧붙임(테마·핵심 키워드가 있으면 생략) */
function maybeAppendDuration(base: string, durationRaw: string | null | undefined): string {
  const durBit = compactDuration(durationRaw ?? '')
  if (!durBit) return truncateOneLine(base, OVERLAY_MAX)
  if (/\d+\s*박\s*\d+\s*일/.test(base) || /\d+박\d+일/.test(base.replace(/\s/g, ''))) {
    return truncateOneLine(base, OVERLAY_MAX)
  }
  const compact = base.replace(/\s/g, '')
  if (compact.length >= 12) return truncateOneLine(base, OVERLAY_MAX)
  if (
    /핵심|감성|루트|코스|미식|휴양|유적|설원|알짜|관문|전망|야시장|고대|드라이브|겨울|리조트|산책|먹거리|도심|근교|힐링|여행/.test(
      base,
    )
  ) {
    return truncateOneLine(base, OVERLAY_MAX)
  }
  const withDur = `${base} · ${durBit}`
  return truncateOneLine(withDur, OVERLAY_MAX)
}

function hashPick(seed: string, options: readonly string[]): string {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0
  return options[Math.abs(h) % options.length]!
}

/** 미등록 권역·짧은 목적지: 목적지 + 허용 접미(금술 미사용) */
const DESTINATION_TRIP_SUFFIXES = ['감성 여행', '미식 여행', '휴양 여행', '핵심 여행'] as const

function withDestinationTripLine(seed: string, place: string): string {
  const suf = hashPick(seed, DESTINATION_TRIP_SUFFIXES)
  return truncateOneLine(`${place} ${suf}`, OVERLAY_MAX)
}

/** 목적지·제목을 한 덩어리로 스캔(쉼표·슬래시는 공백으로) */
function scanBundle(dest: string, title: string): string {
  return `${dest} ${title}`.replace(/[,，、/|·]+/g, ' ').replace(/\s+/g, ' ').trim()
}

function includesAll(folded: string, parts: string[]): boolean {
  return parts.every((p) => folded.includes(p))
}

/** 괄호·대괄호 안 부제 제거 후 앞부분만 */
function stripBracketed(s: string): string {
  return s
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** 제목에서 짧은 테마 조각(4순위) */
function themeFromTitle(title: string): string | null {
  const raw = stripBracketed(title)
  if (!raw) return null
  const noCode = raw.replace(/^[A-Z]{1,4}\d{2,}[A-Z]?\s+/i, '').trim()
  const core = noCode.slice(0, 11).trim()
  if (core.length < 3) return null
  if (/^[\d\s~·박일차]+$/.test(core)) return null
  const tail = core.length >= 8 ? ' 감성 루트' : ' 핵심 코스'
  return truncateOneLine(`${core}${tail}`, OVERLAY_MAX)
}

/**
 * 2·3순위: 휴리스틱으로 권역/테마 한 줄(공급사·목적지 나열형 기본값 없음)
 */
function buildEvocativeKeywordLine(input: {
  dest: string
  title: string
  duration: string
}): string | null {
  const { dest, title, duration } = input
  const bundle = scanBundle(dest, title).replace(/\s/g, '')
  const bundleSp = scanBundle(dest, title)

  if (includesAll(bundle, ['이탈리아', '스위스', '프랑스'])) {
    return maybeAppendDuration('서유럽 핵심 3국', duration)
  }
  if (bundle.includes('서유럽') && /3개국|3국/.test(bundle)) {
    return maybeAppendDuration('서유럽 핵심 3국', duration)
  }
  if (includesAll(bundle, ['규슈', '후쿠오카'])) {
    const line = hashPick(title + dest, ['규슈 온천 감성', '규슈 미식 코스', '후쿠오카 근교 감성'])
    return maybeAppendDuration(line, duration)
  }
  if (includesAll(bundle, ['도쿄', '오사카']) && (bundle.includes('교토') || bundle.includes('京都'))) {
    return maybeAppendDuration('관동·간사이 핵심 루트', duration)
  }
  if (includesAll(bundle, ['다낭', '호이안']) || includesAll(bundle, ['방콕', '파타야'])) {
    return maybeAppendDuration('동남아 휴양·미식', duration)
  }
  if (bundle.includes('동남아') || (includesAll(bundle, ['베트남', '캄보디아']) && bundle.includes('앙코르'))) {
    return maybeAppendDuration('동남아 유적·휴양', duration)
  }
  if (includesAll(bundle, ['홋카이도', '삿포로']) || (bundle.includes('홋카이도') && bundle.includes('후라노'))) {
    return maybeAppendDuration('홋카이도 설원 감성', duration)
  }
  if (includesAll(bundle, ['타이베이', '화련']) || includesAll(bundle, ['대만', '화련'])) {
    return maybeAppendDuration('대만 동부 감성', duration)
  }

  const tokens = dest
    .split(/[,，、/|·\s]+/)
    .map((x) => x.trim())
    .filter((x) => x.length > 0)
  const m = title.match(/(\d)\s*개국/)
  if (tokens.length >= 3 && m) {
    return maybeAppendDuration(`${m[1]}개국 알짜 루트`, duration)
  }
  if (tokens.length >= 3 && (bundle.includes('유럽') || bundle.includes('동유럽') || bundle.includes('북유럽'))) {
    return maybeAppendDuration('유럽 핵심 일주', duration)
  }

  const single = tokens.length === 1 ? tokens[0]! : dest.replace(/[,，、/|·]+/g, ' ').trim().split(/\s+/)[0] ?? ''
  const head = (single || bundleSp.slice(0, 8)).replace(/\s/g, '')
  if (head.length >= 2) {
    const cityMap: { k: string; v: string }[] = [
      { k: '후쿠오카', v: '후쿠오카 미식·온천' },
      { k: '다낭', v: '다낭 리조트 감성' },
      { k: '교토', v: '교토 산책 감성' },
      { k: '오사카', v: '오사카 먹거리 코스' },
      { k: '도쿄', v: '도쿄 도심 핵심 코스' },
      { k: '삿포로', v: '삿포로 겨울 감성' },
      { k: '방콕', v: '방콕 야시장·사원' },
      { k: '파리', v: '파리 도심 감성 루트' },
      { k: '로마', v: '로마 고대 유적' },
      { k: '취리히', v: '알프스 관문 감성' },
      { k: '인터라켄', v: '알프스 전망 루트' },
      { k: '부산', v: '부산 근교 힐링' },
      { k: '제주', v: '제주 드라이브 감성' },
    ]
    for (const { k, v } of cityMap) {
      if (bundle.includes(k) && tokens.length <= 2) {
        return maybeAppendDuration(v, duration)
      }
    }
    if (tokens.length === 2 && bundle.includes('일본')) {
      return maybeAppendDuration(
        hashPick(title + dest, ['일본 소도시 감성 루트', '일본 소도시 핵심 코스']),
        duration,
      )
    }
  }

  const destShort = dest.replace(/\s+/g, ' ').trim()
  if (destShort && destShort.length <= 10 && !destShort.includes(',')) {
    return maybeAppendDuration(withDestinationTripLine(title + dest, destShort), duration)
  }

  return null
}

export type PublicProductSeoKeywordInput = {
  /** image_assets 등에서 온 SEO 성격 문구(있으면 최우선) */
  seoCaptionFromAsset?: string | null
  title: string
  primaryDestination?: string | null
  destination?: string | null
  duration?: string | null
  originSource: string
}

/**
 * 좌측 오버레이 전용. 우선순위: 자산 캡션(품질 통과 시) → 권역·테마 휴리스틱 → 기간 → 제목 테마.
 */
export function buildPublicProductHeroSeoKeywordOverlay(input: PublicProductSeoKeywordInput): string | null {
  void input.originSource

  const asset = (input.seoCaptionFromAsset ?? '').trim()
  if (asset && isAcceptableSeoCaptionFromAsset(asset)) {
    return truncateOneLine(asset, OVERLAY_MAX)
  }

  const dest = (input.primaryDestination ?? input.destination ?? '').trim()
  const title = (input.title ?? '').trim()
  const dur = (input.duration ?? '').trim()

  const fromHeuristic = buildEvocativeKeywordLine({ dest, title, duration: dur })
  if (fromHeuristic) return fromHeuristic

  const fromTitle = themeFromTitle(title)
  if (fromTitle) return fromTitle

  const first = dest.split(/[,，、/|·]/)[0]?.trim() ?? dest
  if (first) return maybeAppendDuration(withDestinationTripLine(title + dest, first), dur)

  return null
}

export type PublicProductSeoKeywordResolveInput = PublicProductSeoKeywordInput & {
  /** 등록 확정 시 저장한 키워드 JSON 배열(2~3개). 있으면 1순위로 ` · ` 합침 */
  storedRegisterSeoKeywordsJson?: string | null
  /** 등록 확정 시 저장한 이미지 좌측 SEO 한 줄(키워드 없을 때) */
  storedRegisterSeoLine?: string | null
}

/** 키워드 2~3개를 한 줄로 합칠 때 상한(단일 OVERLAY_MAX보다 넉넉히) */
const HERO_KEYWORDS_JOINED_MAX = 48

/** 등록 시 `buildRegisterPublicImageHeroSeoKeywords` 토큰 상한과 맞춤 */
const STORED_HERO_KEYWORD_EACH_MAX = 16

/** 키워드 배열에서 섹션 라벨 오염(BROKEN_LABEL) 제거 */
const BROKEN_KEYWORD_PATTERNS = [
  /^여행기간/,
  /^요약설명/,
  /^여행일정/,
  /^주요방문지/,
  /^포함사항/,
  /^불포함사항/,
] as const

function isBrokenKeyword(kw: string): boolean {
  const trimmed = kw.trim()
  if (!trimmed) return true
  return BROKEN_KEYWORD_PATTERNS.some((rx) => rx.test(trimmed))
}

function filterValidKeywords(kws: string[] | null | undefined): string[] {
  if (!kws?.length) return []
  return kws.filter((kw) => typeof kw === 'string' && !isBrokenKeyword(kw))
}

function parseStoredRegisterHeroKeywordsJson(raw: string | null | undefined): string[] | null {
  const s = (raw ?? '').trim()
  if (!s) return null
  try {
    const v = JSON.parse(s) as unknown
    if (!Array.isArray(v)) return null
    const out = v
      .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
      .map((x) => x.replace(/\s+/g, ' ').trim().slice(0, STORED_HERO_KEYWORD_EACH_MAX))
      .filter((x) => !isProductHeroListingSeoContaminated(x))
      .slice(0, 3)
    return out.length > 0 ? out : null
  } catch {
    return null
  }
}

/**
 * 공개 화면 공통 — 우선순위는 파일 상단 블록 주석과 동일.
 */
export function resolvePublicProductHeroSeoKeywordOverlay(input: PublicProductSeoKeywordResolveInput): string | null {
  const rawKws = parseStoredRegisterHeroKeywordsJson(input.storedRegisterSeoKeywordsJson)
  const validKws = filterValidKeywords(rawKws ?? undefined)

  if (validKws.length > 0) {
    const dest = (input.primaryDestination ?? '').trim()
    const tokens: string[] = []

    if (dest) {
      tokens.push(dest)
      for (const kw of validKws) {
        const kwTrim = kw.trim()
        if (!kwTrim) continue
        if (kwTrim === dest) continue
        if (dest.includes(kwTrim) || kwTrim.includes(dest)) continue
        tokens.push(kwTrim)
        if (tokens.length >= 4) break
      }
    } else {
      for (const kw of validKws) {
        const kwTrim = kw.trim()
        if (!kwTrim) continue
        tokens.push(kwTrim)
        if (tokens.length >= 3) break
      }
    }

    if (tokens.length > 0) {
      return truncateOneLine(tokens.join(' · '), HERO_KEYWORDS_JOINED_MAX)
    }
  }

  const stored = (input.storedRegisterSeoLine ?? '').trim()
  if (stored.length > 0 && !isProductHeroListingSeoContaminated(stored)) {
    return truncateOneLine(stored, OVERLAY_MAX)
  }
  const asset = (input.seoCaptionFromAsset ?? '').trim()
  if (asset && isAcceptableSeoCaptionFromAsset(asset)) {
    return truncateOneLine(asset, OVERLAY_MAX)
  }
  return buildPublicProductHeroSeoKeywordOverlay({ ...input, seoCaptionFromAsset: null })
}
