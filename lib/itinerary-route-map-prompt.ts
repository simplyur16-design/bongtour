/**
 * 플랫 2D 일정 동선 지도 Gemini 이미지 프롬프트.
 * 거점 캡슐만 그리게 하고, 점선 동선은 코드(sharp)로 합성한다.
 */

import type { ItineraryRouteMapHub } from '@/lib/itinerary-route-map-types'
import type { RouteMapHubPoint } from '@/lib/itinerary-route-map-layout'

export function buildItineraryRouteMapPrompt(input: {
  countryKo: string
  countryEn: string
  hubs: ItineraryRouteMapHub[]
  points: RouteMapHubPoint[]
}): string {
  const { countryKo, countryEn, hubs, points } = input
  const countryEnUpper = countryEn.trim().toUpperCase() || 'MAP'

  const exactLabels = hubs.map((h) => h.cityKo.trim()).filter(Boolean)
  const exactBlock =
    exactLabels.length > 0
      ? [
          `CRITICAL — copy these Korean city names EXACTLY:`,
          ...exactLabels.map((t) => `  - "${t}"`),
          `Forbidden corruption: 교토→고투.`,
        ].join('\n')
      : ''

  const hubLines = points
    .map((p, i) => {
      const pctX = Math.round(p.x * 100)
      const pctY = Math.round(p.y * 100)
      return [
        `  * Hub ${i + 1}:`,
        `    - Place BLUE ROUNDED CAPSULE (pill) with white day text "${p.dayLabel}" so its CENTER is at about ${pctX}% from the left and ${pctY}% from the top of the image.`,
        `    - Korean label EXACTLY "${p.cityKo}" next to/below the capsule.`,
        `    - Capsule only — no pins, no route lines from this hub.`,
      ].join('\n')
    })
    .join('\n')

  return [
    `Create a flat 2D pastel itinerary BASE MAP (Gemini). Country silhouette + blue day capsules + Korean city labels ONLY.`,
    ``,
    exactBlock,
    exactBlock ? `` : '',
    `DO NOT DRAW ANY ROUTES:`,
    `- No dashed lines, solid lines, arrows, paths, transit capsules, trains, buses, or connection strokes between cities.`,
    `- Route lines will be added later by software. Leave empty space between capsules.`,
    ``,
    `1. Background & geography`,
    `- Solid very light blue or white background.`,
    `- Simplified ${countryKo} (${countryEnUpper}) landmass: large pastel mint/green, dark thin outline, centered.`,
    `- Soft faint gray watermark "${countryEnUpper}" inside landmass.`,
    `- No mountains, rivers, photorealism, 3D, shadows.`,
    ``,
    `2. Location markers (exact positions)`,
    hubLines || '  * Blue day capsules + Korean names.',
    ``,
    `3. Typography`,
    `- Sharp Hangul gothic. Cities Korean-only.`,
    `- No logos, no collage, no brochure chrome.`,
  ]
    .filter((line) => line !== undefined)
    .join('\n')
}
