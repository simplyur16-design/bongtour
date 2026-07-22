/**
 * REGRESSION-FREEZE[register-destination-reject-ilju]: destination pollution SSOT — manifest
 * bare 「일주」·프로모·항공 안내·정책 뱃지는 목록「지역」/등록 destination에 쓰지 않음.
 */
import { isSupplierRegisterDestinationUiLabel } from '@/lib/supplier-register-destination-forbidden'
import { isSupplierTitlePromoBadgeText } from '@/lib/supplier-product-title-display'
import {
  firstRegisterDestinationPlaceFromTitleHead,
  isRegisterDestinationTourStyleNoiseToken,
} from '@/lib/register-destination-tour-style-noise'
import { extractDestinationFromTitle } from '@/lib/destination-from-title'
import { resolveProductCountryToKoreanDisplay } from '@/lib/browse-country-url-resolve'
import { koreanCountryLabelFromBrowseSlug } from '@/lib/location-url-slugs'

const AIRLINE_POLLUTION_RE =
  /항공|이코노미|비즈니스\s*클래스|승무원|에어프레미아|에어프리미아|\bLOT\b|클래스\s*외|폴란드항공/i

const PRODUCT_COPY_POLLUTION_RE = /밍글링\s*투어|밍글링\s*타임|라이트\s*투어/i

const POLICY_COMPOUND_RE =
  /^(?:노|무)(?:쇼핑|옵션|팁)(?:\s*[·,/]\s*(?:노|무)?(?:쇼핑|옵션|팁))*$/u

/** True if label must never be stored/shown as product destination / list 지역. */
export function isRegisterDestinationPollutionLabel(raw: string | null | undefined): boolean {
  const t = String(raw ?? '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!t || t.length < 2) return true
  if (t === '미지정' || t === '—' || /^unknown$/i.test(t)) return true
  if (isRegisterDestinationTourStyleNoiseToken(t)) return true
  if (isSupplierRegisterDestinationUiLabel(t)) return true
  if (isSupplierTitlePromoBadgeText(t)) return true
  if (POLICY_COMPOUND_RE.test(t)) return true
  if (AIRLINE_POLLUTION_RE.test(t) && (t.length >= 18 || /클래스|승무원|이코노미/i.test(t))) return true
  if (PRODUCT_COPY_POLLUTION_RE.test(t)) return true
  if (/^여행\s*일정/.test(t)) return true
  return false
}

function firstNonPolicyBracketPlace(title: string): string | null {
  for (const m of String(title ?? '').matchAll(/\[([^\]]+)\]/g)) {
    const inner = (m[1] ?? '').replace(/\s+/g, ' ').trim()
    if (!inner || isRegisterDestinationPollutionLabel(inner)) continue
    const parts = inner
      .split(/[/／·]/)
      .map((p) => p.trim())
      .filter((p) => p.length >= 2 && !isRegisterDestinationPollutionLabel(p))
    if (parts.length === 0) continue
    return parts.length === 1 ? parts[0]! : parts.join(' · ')
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
  const current = String(input.current ?? '').trim()
  if (current && !isRegisterDestinationPollutionLabel(current)) {
    const scrubbed = firstRegisterDestinationPlaceFromTitleHead(current)
    if (scrubbed && !isRegisterDestinationPollutionLabel(scrubbed)) return scrubbed
    return current.slice(0, 96)
  }

  const countryIlju = title.match(/([가-힣A-Za-z]{2,16})\s*(?:완전)?일주\s*(?:\d+\s*박|\d+\s*일|#)/u)
  if (countryIlju?.[1] && !isRegisterDestinationPollutionLabel(countryIlju[1])) {
    return countryIlju[1]
  }

  // Prefer [place] brackets before free-text head (avoids returning the whole title line).
  const fromBracket = firstNonPolicyBracketPlace(title)
  if (fromBracket) return fromBracket.slice(0, 96)

  const titleForHead = title
    .replace(/\[?\s*2030\s*전용\s*\]?/gi, ' ')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/#[^\s#]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const fromHeadRaw = firstRegisterDestinationPlaceFromTitleHead(titleForHead)
  const fromHead = fromHeadRaw
    ? fromHeadRaw
        .replace(/\d+\s*(?:박|일).*$/u, '')
        .trim()
        .split(/\s+/)[0]
        ?.trim() ?? null
    : null
  if (
    fromHead &&
    fromHead.length >= 2 &&
    fromHead.length <= 24 &&
    !isRegisterDestinationPollutionLabel(fromHead)
  ) {
    return fromHead.slice(0, 96)
  }

  const fromTitle = extractDestinationFromTitle(title)
  if (fromTitle !== '미지정' && !isRegisterDestinationPollutionLabel(fromTitle)) {
    return fromTitle.slice(0, 96)
  }

  const ck = String(input.countryKey ?? '').trim()
  if (ck) {
    const fromBrowse = koreanCountryLabelFromBrowseSlug(ck) || resolveProductCountryToKoreanDisplay(ck)
    if (fromBrowse && !isRegisterDestinationPollutionLabel(fromBrowse)) return fromBrowse.slice(0, 96)
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
  const healed =
    healRegisterDestinationLabel({
      title: input.title,
      countryKey: input.countryKey,
      current: input.primaryDestination || input.destination,
    }) ||
    healRegisterDestinationLabel({
      title: input.title,
      countryKey: input.countryKey,
      current: input.destinationRaw,
    })

  const dest = healed || '미지정'
  const rawCandidate = String(input.destinationRaw ?? '').trim()
  const raw =
    rawCandidate && !isRegisterDestinationPollutionLabel(rawCandidate)
      ? rawCandidate.slice(0, 500)
      : dest === '미지정'
        ? null
        : dest

  return {
    destination: dest === '미지정' ? '' : dest,
    destinationRaw: raw,
    primaryDestination: dest === '미지정' ? null : dest,
  }
}
