/**
 * 플랫 2D 일정 동선 — Gemini는 실루엣(+한글 지명만). 캡슐·점선은 코드 합성.
 * 짧은 코스는 권역 줌 베이스맵을 요청한다.
 * 육지·바다·호수는 색으로 즉시 구분되게 한다.
 */

function geographyColorRules(): string[] {
  return [
    `GEOGRAPHY COLORS (must be obvious at a glance — CRITICAL):`,
    `   - 육지(LAND): solid soft sage/olive green (#A8C686). Fill 100% opaque. Thick dark charcoal coastline outline (#2F3A2E, ~3px).`,
    `   - 바다/만(SEA / OCEAN / BAY): solid medium sky blue (#6EB6E8). Never pale near-white. Never the same color as land.`,
    `   - 호수(LAKE, inland water only e.g. 비와호): solid deep teal (#2F8F8A), clearly darker/different from the sea. Thick dark outline so it reads as a closed inland lake, not ocean.`,
    `   - Canvas outside the region may be a slightly lighter sea blue (#B9DCF5), but lakes must stay deep teal.`,
    `   - Do NOT paint lakes the same blue as the ocean. Do NOT leave lakes as green holes in the land.`,
    `   - Label major features in Hangul next to them: 바다/만 → e.g. 오사카만; 호수 → 비와호; 섬 → 아와지섬.`,
  ]
}

function hangulRules(countryKo: string, countryEnUpper: string): string[] {
  return [
    `TEXT LANGUAGE (CRITICAL):`,
    `   - Any visible text on the map MUST be Hangul (Korean) only.`,
    `   - Allowed examples: 오사카만, 비와호, 아와지섬, 기이반도, 남중국해, ${countryKo}.`,
    `   - FORBIDDEN: English, Latin alphabet, romaji, Chinese characters, Japanese kana.`,
    `   - Do NOT write "${countryEnUpper}", "Osaka Bay", "Lake Biwa", "JAPAN", "VIETNAM", or any Latin words.`,
    `   - City day-stop pills (오사카/교토) will be added later by software — leave those spots empty of pins/capsules.`,
  ]
}

export function buildItineraryRouteMapPrompt(input: {
  countryKo: string
  countryEn: string
  frame?: 'country' | 'region'
  regionHintEn?: string
}): string {
  const countryEnUpper = input.countryEn.trim().toUpperCase() || 'MAP'
  const countryKo = input.countryKo.trim() || countryEnUpper
  const frame = input.frame ?? 'country'
  const regionHint = (input.regionHintEn ?? '').trim()
  const colors = geographyColorRules()
  const hangul = hangulRules(countryKo, countryEnUpper)

  if (frame === 'region' && regionHint) {
    return [
      `Create a flat 2D pastel BASE MAP of a ZOOMED REGION: ${regionHint}.`,
      `Country: ${countryKo}. (Internal reference ${countryEnUpper} — do NOT draw this code on the image.)`,
      ``,
      `1. The REGION fills most of the frame (zoomed in). NORTH UP — do not rotate.`,
      `2. ${colors.join('\n   ')}`,
      `3. ${hangul.join('\n   ')}`,
      `4. ABSOLUTELY NO: pins, capsules, day numbers, routes, dashed lines, icons, logos.`,
      `5. No photorealism, mountains, river networks, 3D, shadows, textures, collage.`,
    ].join('\n')
  }

  return [
    `Create a flat 2D pastel BASE MAP of ${countryKo} only.`,
    `Internal reference ${countryEnUpper} — do NOT draw this code on the image.`,
    ``,
    `1. ${countryKo} landmass large and centered. NORTH UP.`,
    `2. ${colors.join('\n   ')}`,
    `3. Optional faint Hangul label "${countryKo}" only (no Latin).`,
    `4. ${hangul.join('\n   ')}`,
    `5. ABSOLUTELY NO: pins, capsules, day numbers, routes, dashed lines, icons, logos.`,
    `6. No photorealism, mountains, river networks, 3D, shadows, textures, collage.`,
  ].join('\n')
}
