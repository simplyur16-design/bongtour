/**
 * Gemini/Imagen 대표 이미지용 프롬프트 생성.
 * `buildPexelsKeyword`를 호출하지 않음 — 주제 해석만 `resolveTravelSubjectEnForMedia` SSOT를 공유.
 */

import { resolveTravelSubjectEnForMedia } from '@/lib/pexels-keyword'

const GEMINI_IMAGE_SCENE_SUFFIX =
  'wide-angle travel photograph, natural daylight, realistic detail, documentary travel photography style'

/** 관리자 4슬롯 생성 순서 (응답 배열 0..3과 동일). */
export type GeminiImageSlotType = 'no_person_wide' | 'no_person_zoom' | 'person_half' | 'person_full'

export const GEMINI_IMAGE_SLOT_ORDER: GeminiImageSlotType[] = [
  'no_person_wide',
  'no_person_zoom',
  'person_half',
  'person_full',
]

export type GeminiImagePromptOptions = {
  destination: string | null
  primaryRegion: string | null
  themeTags: string | null
  title: string | null
  /** 운영 라벨 — 장면 프롬프트에는 넣지 않음(호환용) */
  displayCategory?: string | null
  attractionName?: string | null
  poiNamesRaw?: string | null
  scheduleJson?: string | null
}

const GEMINI_SLOT_COMMON_NEGATIVE_EN =
  'No text, logos, or watermarks. Do not invent buildings, streets, or landmarks not implied by the scene. No tourism poster, magazine cover, or stock-art look. No collage, split screen, or composite of multiple places. Single continuous photograph. Place identity must stay primary over people when both appear.'

/** 슬롯별 영문 지시 — 입력 키워드(장소/배경/시점)는 resolveBaseSceneDescription에서 앞에 붙음. */
const SLOT_INSTRUCTIONS_EN: Record<GeminiImageSlotType, string> = {
  no_person_wide:
    'No people, no faces. Wide-angle shot: representative street, plaza, building exteriors, or landmark visible in a broad frame; real layout and architecture only. Clearly a wide establishing view.',
  no_person_zoom:
    'No people, no faces. Tighter framing than a wide shot: entrance, facade, or core landmark feature fills more of the frame; same real place type, clearly more zoomed-in than a wide establishing shot.',
  person_half:
    'One or two adult Korean female leisure travelers, upper body / half-length only. They are secondary; the background must clearly show the same real place so the location stays identifiable. Casual travel clothing, not staged posing.',
  person_full:
    'One or two adult Korean female leisure travelers, full body in frame. Same real place; people secondary, environment and landmark identity primary. Casual travel snapshot, not studio lighting.',
}

function resolveBaseSceneDescription(
  options: GeminiImagePromptOptions,
  promptOverride: string | null
): string {
  const raw = promptOverride?.trim()
  if (raw) {
    return raw.slice(0, 500)
  }
  const subject = resolveTravelSubjectEnForMedia({
    destination: options.destination,
    primaryRegion: options.primaryRegion,
    themeTags: options.themeTags,
    title: options.title,
    attractionName: options.attractionName,
    poiNamesRaw: options.poiNamesRaw,
    scheduleJson: options.scheduleJson,
  })
  if (!subject || subject === 'travel') {
    return 'Travel destination wide shot, authentic atmosphere, real architecture and environment only'
  }
  return `Photorealistic travel scene featuring ${subject}, prominent environment and architecture, real place structure and building exteriors as found, not invented`
}

/**
 * 슬롯별 Imagen 프롬프트. `promptOverride`가 있으면 최우선 장면 재료(일정 저장 키워드 등).
 */
export function buildGeminiImagePromptForSlot(
  options: GeminiImagePromptOptions,
  promptOverride: string | null,
  slot: GeminiImageSlotType
): string {
  const base = resolveBaseSceneDescription(options, promptOverride)
  const slotBlock = SLOT_INSTRUCTIONS_EN[slot]
  return `${base}. ${slotBlock} ${GEMINI_SLOT_COMMON_NEGATIVE_EN}`.trim()
}

/**
 * 단일 후보용 (레거시). 신규 관리자 경로는 `buildGeminiImagePromptForSlot` 4회.
 */
export function buildGeminiImagePrompt(options: GeminiImagePromptOptions): string {
  const base = resolveBaseSceneDescription(options, null)
  if (base.startsWith('Travel destination wide shot')) {
    return `Travel destination wide shot, authentic atmosphere, ${GEMINI_IMAGE_SCENE_SUFFIX}`
  }
  return `${base}, ${GEMINI_IMAGE_SCENE_SUFFIX}`
}
