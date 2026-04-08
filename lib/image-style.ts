/**
 * 이미지 톤 공통 정의 (Pexels 검색 + Gemini/Imagen 생성 시 동일 적용)
 * 기준: 실사·다큐멘터리, 실제 장소, 자연/일상 조명, 과장된 건물·풍경 창조 지양
 * 참고 샘플: 낮 랜드마크(오사카성·도쿄타워 등), 도심 야경/황혼(시부야 크로싱 등) 포함
 */

/** Pexels 검색어에 붙일 보조 키워드 (실사·풍경·도심 랜드마크 유도) */
export const PEXELS_REALISTIC_KEYWORDS = ' travel landscape photorealistic'

/** 단일 단어일 때만 Pexels 쿼리에 실사 키워드 추가 (복합어는 분석 결과 신뢰) */
export function withPexelsRealisticQuery(keyword: string): string {
  const k = (keyword ?? '').trim()
  if (!k) return 'travel landscape photorealistic'
  return k.includes(' ') ? k : `${k}${PEXELS_REALISTIC_KEYWORDS}`
}

/**
 * Gemini/Imagen 프롬프트에 붙일 스타일 문구 (실사·다큐 톤, 건물 지현창조 금지)
 * 사용 예: `generateContent({ prompt: `${subject}. ${IMAGEN_REALISTIC_STYLE_PROMPT}` })
 * 참고: 낮 랜드마크·도심 황혼/야경(네온+자연광 혼합) 모두 허용
 */
export const IMAGEN_REALISTIC_STYLE_PROMPT =
  'Realistic travel photograph, natural or mixed lighting (e.g. urban dusk, neon and twilight). Real place, documentary style. Daytime landmark or city scene at night. No fantastical or exaggerated architecture or landscapes.'

/**
 * 일차 “대표 장소 1곳만” 이미지용 — 위 기본 스타일 대신 사용.
 * “city scene / 여러 랜드마크” 유도를 피하고 단일 피사체 사진으로 고정한다.
 */
export const IMAGEN_SINGLE_LANDMARK_STYLE_SUFFIX =
  'Single photograph, one camera exposure, one main subject only. Photorealistic travel snapshot, natural or urban light. ' +
  'Goal: the iconic representative view of THIS attraction (how visitors usually recognize it)—not required to be a pretty landscape or nature scenery. ' +
  'Do not show a city poster, skyline montage, or several famous buildings together. ' +
  'No second distinct tourist attraction as a separate subject; background may be street, facade, crowd context, or sky.'

/**
 * Imagen이 “편집 합성”으로 여러 장소를 한 프레임에 넣는 경우를 막기 위한 부정(negative) 문구.
 * 프롬프트 앞쪽에도 붙인다.
 */
export const IMAGEN_SINGLE_LANDMARK_NEGATIVE_ANCHOR =
  'NEGATIVE — Do NOT: photo collage, stitched panorama of different spots, before/after split, diptych, triptych, four-quadrant layout, ' +
  'travel brochure or magazine cover, postcard montage, map with photos, infographic, picture-in-picture, or edited composite of multiple landmarks. ' +
  'Must be ONE uncropped-looking still photo of ONE place. '

/**
 * 일차 대표 이미지(Gemini/Imagen fallback) 전용.
 * “하루 일정 요약 포스터”가 아니라 대표 장소 1곳의 실제 사진 같은 단일 장면이어야 함.
 */
export const IMAGEN_ITINERARY_DAY_HERO_CONSTRAINTS =
  'CRITICAL: Only ONE sightseeing place in the entire image. Aim for how that place is typically pictured (iconic angle, entrance, landmark feature)—scenic panorama or nature beauty is optional, not required. ' +
  'Not a day itinerary, not highlights, not multiple stops. ' +
  'No collage, split screen, montage, grid, multi-panel, triptych, brochure layout, travel poster, or infographic. ' +
  'No text, map, icons, arrows. No second temple, tower, shrine, or district shown as a separate subject. ' +
  'One landmark, one continuous scene, one viewpoint, one camera angle.'

/** 품질 미달·API 실패 시 2차 생성용(자동 재시도). 다중 장소 합성 금지. */
export const ITINERARY_DAY_HERO_REGENERATE_PROMPT_EN =
  'Do not combine or edit multiple places into one image. Show exactly one landmark in one continuous realistic photograph. No collage or composite.'

/** 관리자 4슬롯 Gemini 생성 전용 — 슬롯별 구도·인물은 프롬프트 본문에서 지시, 여기서는 공통 톤만. */
export const IMAGEN_ADMIN_TRAVEL_RECORD_SUFFIX =
  'Realistic travel snapshot as from a phone or travel diary, documentary tone. Natural daylight, moderate saturation, no extreme contrast, no fake golden-hour glow. No text, logos, or watermarks. Not a tourism poster or brochure illustration.'
