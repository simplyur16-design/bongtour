/**
 * REGRESSION-FREEZE[register-destination-reject-ilju]: destination pollution SSOT — manifest
 * bare 「일주」·프로모·항공 안내·정책 뱃지·일정 액티비티는 목록「지역」/등록 destination에 쓰지 않음.
 */
import { isSupplierRegisterDestinationUiLabel } from '@/lib/supplier-register-destination-forbidden'
import { isSupplierTitlePromoBadgeText } from '@/lib/supplier-product-title-display'
import {
  firstRegisterDestinationPlaceFromTitleHead,
  isRegisterDestinationTourStyleNoiseToken,
} from '@/lib/register-destination-tour-style-noise'
import {
  isRegisterDestinationScheduleActivityToken,
  scrubRegisterDestinationComposedPlaceLabel,
  scrubRegisterDestinationRawPlaceList,
  splitRegisterDestinationPlaceTokens,
} from '@/lib/register-destination-schedule-activity-noise'
import { extractDestinationFromTitle } from '@/lib/destination-from-title'
import { resolveProductCountryToKoreanDisplay } from '@/lib/browse-country-url-resolve'
import { koreanCountryLabelFromBrowseSlug } from '@/lib/location-url-slugs'

const AIRLINE_POLLUTION_RE =
  /항공|이코노미|비즈니스\s*클래스|승무원|에어프레미아|에어프리미아|\bLOT\b|클래스\s*외|폴란드항공/i

const PRODUCT_COPY_POLLUTION_RE = /밍글링\s*투어|밍글링\s*타임|라이트\s*투어/i

const POLICY_COMPOUND_RE =
  /^(?:노|무)(?:쇼핑|옵션|팁)(?:\s*[·,/]\s*(?:노|무)?(?:쇼핑|옵션|팁))*$/u

/** `[온라인전용]`·`[풀패키지]`·홈쇼핑 채널 등 — 지명 아님 */
const CHANNEL_OR_OFFER_LABEL_RE =
  /^(?:온라인\s*전용|풀\s*패키지|자유\s*여행|2030\s*전용|홈\s*쇼핑|롯데\s*원티비|SK\s*스토아|NS\s*홈쇼핑|공영\s*홈쇼핑|현대\s*홈쇼핑|명문대\s*학부형.*|학부형\s*가이드.*)$/iu

const AIRLINE_CODE_ONLY_RE =
  /^(?:KE|OZ|VJ|TW|7C|LJ|BX|ZE|RS|SQ|TG|NH|JL|CX|KA|하와이안|젯스타|진에어|티웨이|에어서울|대한항공|아시아나|핀에어)$/i

/** True if label must never be stored/shown as product destination / list 지역. */
export function isRegisterDestinationPollutionLabel(raw: string | null | undefined): boolean {
  const t = String(raw ?? '')
    .replace(/\s+/g, ' ')
    .trim()
  // Single Hangul place names (괌) are valid — do not use length<2 ASCII heuristic alone.
  if (!t) return true
  if (t.length < 2 && !/[가-힣]/.test(t)) return true
  if (t === '미지정' || t === '—' || /^unknown$/i.test(t)) return true
  if (isRegisterDestinationTourStyleNoiseToken(t)) return true
  // 조합 라벨은 scrubRegisterDestinationComposedPlaceLabel에서 액티비티만 제거 — 통째로 pollution 처리하지 않음
  if (
    !/\s·\s/.test(t) &&
    !/외\s*\d+\s*도시/u.test(t) &&
    !/[,，、]/.test(t) &&
    isRegisterDestinationScheduleActivityToken(t)
  ) {
    return true
  }
  if (isSupplierRegisterDestinationUiLabel(t)) return true
  if (isSupplierTitlePromoBadgeText(t)) return true
  if (CHANNEL_OR_OFFER_LABEL_RE.test(t)) return true
  if (AIRLINE_CODE_ONLY_RE.test(t)) return true
  if (POLICY_COMPOUND_RE.test(t)) return true
  if (AIRLINE_POLLUTION_RE.test(t) && (t.length >= 18 || /클래스|승무원|이코노미|에어프레미아|에어프리미아/i.test(t))) {
    return true
  }
  if (PRODUCT_COPY_POLLUTION_RE.test(t)) return true
  if (/^여행\s*일정/.test(t)) return true
  return false
}

function scrubPlaceToken(raw: string): string | null {
  let t = String(raw ?? '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!t) return null
  t = t.replace(/\d+\s*(?:박|일)\s*$/u, '').trim()
  // 지명에 바로 붙은 괄호만 별칭으로 보고 제거한다.
  // 앞에 공백이 있으면 공급사 조합 라벨(`미동부 (뉴욕 · 나이아가라)`)이라 살린다.
  t = t.replace(/(?<=\S)\([^)]*\)/g, '').trim() // 칭다오(청도) → 칭다오
  t = t.replace(/(?<=\S)\([^)]*$/u, '').trim() // 칭다오(청도 → 칭다오
  if (!/[(（]/u.test(t)) t = t.replace(/[)）]+$/u, '').trim() // 짝 없는 닫는 괄호만 정리
  if (!t || isRegisterDestinationPollutionLabel(t)) return null
  return t.slice(0, 96)
}

function isLikelyPlaceBracketInner(inner: string): boolean {
  const t = inner.replace(/\s+/g, ' ').trim()
  if (!t || isRegisterDestinationPollutionLabel(t)) return false
  if (/[,，]/.test(t)) return false // 일년 중 단 한달, 칭다오맥주축제
  if (/\s/.test(t) && t.length > 18) return false
  if (/ROOM|VIEW|HOTEL|UPGRADE|DELUXE|SUITE/i.test(t)) return false
  if (/^[A-Za-z0-9][A-Za-z0-9\s\-_/]*$/.test(t) && t.split(/\s+/).length >= 2) return false
  // REGRESSION-FREEZE[register-destination-reject-ilju]: promo brackets ≠ place — manifest
  if (/(?:초)?특가|기간\s*한정|실시간|노쇼핑|노옵션|노팁|풀\s*패키지|온라인\s*전용|2030\s*전용/i.test(t)) {
    return false
  }
  return true
}

function firstNonPolicyBracketPlace(title: string): string | null {
  for (const m of String(title ?? '').matchAll(/\[([^\]]+)\]/g)) {
    const inner = (m[1] ?? '').replace(/\s+/g, ' ').trim()
    if (!isLikelyPlaceBracketInner(inner)) continue
    const parts = inner
      .split(/[/／·]/)
      .map((p) => scrubPlaceToken(p))
      .filter((p): p is string => Boolean(p))
    if (parts.length === 0) continue
    return parts.length === 1 ? parts[0]! : parts.join(' · ')
  }
  return null
}

/**
 * 공급사 조합 라벨(`미동부 · 캐나다 (뉴욕 · 나이아가라)`)은 제목이 아니라 이미 정리된 값이다.
 * 제목용 머리 토큰 분리를 태우면 첫 지명만 남고 나머지가 잘린다.
 */
function isComposedRegisterDestinationLabel(t: string): boolean {
  return /\s·\s/.test(t) || /\S\s\([^)]*\)$/.test(t)
}

function labelHasScheduleActivityPollution(raw: string): boolean {
  const t = String(raw ?? '').trim()
  if (!t) return false
  if (isRegisterDestinationPollutionLabel(t) && isRegisterDestinationScheduleActivityToken(t)) {
    return true
  }
  return splitRegisterDestinationPlaceTokens(t).some((tok) =>
    isRegisterDestinationScheduleActivityToken(tok),
  )
}

function firstCleanStoredDestination(
  ...candidates: Array<string | null | undefined>
): string | null {
  for (const c of candidates) {
    const t = String(c ?? '').trim()
    if (!t) continue
    // REGRESSION-FREEZE[register-destination-reject-ilju]: composed label drop schedule activities — manifest
    if (labelHasScheduleActivityPollution(t)) {
      const scrubbedComposed = scrubRegisterDestinationComposedPlaceLabel(t)
      if (scrubbedComposed && !isRegisterDestinationPollutionLabel(scrubbedComposed)) {
        return scrubbedComposed
      }
      continue
    }
    if (isRegisterDestinationPollutionLabel(t)) continue
    const head = isComposedRegisterDestinationLabel(t)
      ? t
      : firstRegisterDestinationPlaceFromTitleHead(t) || t
    const scrubbed = scrubPlaceToken(head)
    if (scrubbed) return scrubbed
  }
  return null
}

/**
 * Prefer a clean place label from title / countryKey when current destination is polluted.
 * REGRESSION-FREEZE[register-destination-reject-ilju]: heal path — manifest
 */
export function healRegisterDestinationLabel(input: {
  title?: string | null
  countryKey?: string | null
  current?: string | null
}): string | null {
  const title = String(input.title ?? '').trim()
  const fromCurrent = firstCleanStoredDestination(input.current)
  if (fromCurrent) return fromCurrent

  const countryIlju = title.match(
    /([가-힣A-Za-z]{2,16})\s*(?:완전)?일주\s*(?:\d+\s*박|\d+\s*일|#)/u,
  )
  if (countryIlju?.[1]) {
    const tok = scrubPlaceToken(countryIlju[1])
    if (tok) return tok
  }

  // Prefer [place] brackets before free-text head (avoids returning the whole title line).
  const fromBracket = firstNonPolicyBracketPlace(title)
  if (fromBracket) return fromBracket

  const titleForHead = title
    .replace(/\[?\s*2030\s*전용\s*\]?/gi, ' ')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/#[^\s#]+/g, ' ')
    .replace(/^[●○■▶]+/, '')
    .replace(/\s+/g, ' ')
    .trim()
  const fromHeadRaw = firstRegisterDestinationPlaceFromTitleHead(titleForHead)
  const fromHead = fromHeadRaw
    ? scrubPlaceToken(
        fromHeadRaw
          .split(/[/,，、]/)[0]
          ?.trim()
          .split(/\s+/)[0] ?? fromHeadRaw,
      )
    : null
  if (fromHead && /[가-힣]/.test(fromHead)) return fromHead

  const ck = String(input.countryKey ?? '').trim()
  if (ck) {
    const fromBrowse = koreanCountryLabelFromBrowseSlug(ck) || resolveProductCountryToKoreanDisplay(ck)
    const tok = scrubPlaceToken(fromBrowse || '')
    if (tok) return tok
  }

  // Last resort — CITY_PATTERNS can false-positive on substrings (운상해천→상해, 국내선→제주).
  const fromTitle = extractDestinationFromTitle(title)
  if (fromTitle !== '미지정') {
    const tok = scrubPlaceToken(fromTitle)
    if (tok) return tok
  }

  return null
}

export function finalizeRegisterDestinationFields(input: {
  title: string
  destination?: string | null
  destinationRaw?: string | null
  primaryDestination?: string | null
  countryKey?: string | null
}): {
  destination: string
  destinationRaw: string | null
  primaryDestination: string | null
} {
  const fromPrimaryDest = firstCleanStoredDestination(
    input.primaryDestination,
    input.destination,
  )
  const fromTitle = healRegisterDestinationLabel({
    title: input.title,
    countryKey: input.countryKey,
    current: null,
  })
  // destinationRaw는 일정 places 덤프라 title보다 후순위 (카페·클럽 잔류 방지)
  const fromRaw = firstCleanStoredDestination(input.destinationRaw)
  const healed = fromPrimaryDest || fromTitle || fromRaw

  const dest = healed || '미지정'
  const rawCandidate = String(input.destinationRaw ?? '').trim()
  const scrubbedRaw = scrubRegisterDestinationRawPlaceList(rawCandidate)
  const raw =
    scrubbedRaw && !isRegisterDestinationPollutionLabel(scrubbedRaw)
      ? scrubbedRaw
      : dest === '미지정'
        ? null
        : dest

  return {
    destination: dest === '미지정' ? '' : dest,
    destinationRaw: raw,
    primaryDestination: dest === '미지정' ? null : dest,
  }
}
