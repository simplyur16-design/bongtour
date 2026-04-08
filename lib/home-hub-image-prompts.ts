import type { HomeHubCardImageKey } from '@/lib/home-hub-images'
import type { HubImageSeasonKey } from '@/lib/home-hub-candidates-types'

export type { HubImageSeasonKey }

const SEASON_HINT: Record<HubImageSeasonKey, string> = {
  default: '시즌 중립적이고 밝은 톤.',
  spring: '봄의 산뜻함과 연한 색감.',
  summer: '여름의 밝은 하늘과 활기찬 여행 무드.',
  autumn: '가을의 깊이와 따뜻한 빛.',
  winter: '겨울의 맑고 차분한 대기.',
}

const CARD_BASE: Record<HomeHubCardImageKey, string> = {
  overseas:
    'Premium global travel mood, city skyline and open horizon, editorial photography, bright and trustworthy, no text no watermark no logos, generous negative space in center for typography overlay, 16:9 landscape feel',
  training:
    'Institutional visit and professional exchange mood, briefing or collaborative scene, natural light, credible but not stiff stock conference room, editorial, no text no watermark, center area clear for text overlay',
  domestic:
    'Korean local landscape or urban depth, seasonal atmosphere, discovery and warmth, editorial travel style, no text no watermark, center composition breathing room',
  bus:
    'Group mobility and airport or highway context, reliable fleet operations mood, restrained not car-ad exaggerated, silver and charcoal tones, no text no watermark, clear lower area for labels',
}

/**
 * 카드·시즌별 기본 프롬프트 (Imagen용 영문 위주 + 시즌 힌트).
 */
export function getDefaultHomeHubImagePrompt(
  cardKey: HomeHubCardImageKey,
  season: HubImageSeasonKey | string
): string {
  const base = CARD_BASE[cardKey] ?? CARD_BASE.overseas
  const sk = (season as HubImageSeasonKey) in SEASON_HINT ? (season as HubImageSeasonKey) : 'default'
  const hint = SEASON_HINT[sk] ?? SEASON_HINT.default
  return `${base} ${hint}`
}

/** 카드별 `default` 시즌 기준 기본 프롬프트 (UI·API 기본값 주입용) */
export const HOME_HUB_DEFAULT_PROMPTS: Record<HomeHubCardImageKey, string> = {
  overseas: getDefaultHomeHubImagePrompt('overseas', 'default'),
  training: getDefaultHomeHubImagePrompt('training', 'default'),
  domestic: getDefaultHomeHubImagePrompt('domestic', 'default'),
  bus: getDefaultHomeHubImagePrompt('bus', 'default'),
}

export const homeHubOverseasDefaultPrompt = HOME_HUB_DEFAULT_PROMPTS.overseas
export const homeHubTrainingDefaultPrompt = HOME_HUB_DEFAULT_PROMPTS.training
export const homeHubDomesticDefaultPrompt = HOME_HUB_DEFAULT_PROMPTS.domestic
export const homeHubBusDefaultPrompt = HOME_HUB_DEFAULT_PROMPTS.bus
