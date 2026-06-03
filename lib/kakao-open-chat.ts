/**
 * 카카오 오픈채팅 1차 연동 URL.
 * 맥락 강화·유형 분기·운영 연계 로드맵: docs/KAKAO-COUNSEL-ROADMAP.md
 * 향후 UTM·쿼리는 이 상수를 래핑하는 헬퍼로 확장 가능.
 */
/** 코드 내장 기본값(미설정 시). 운영 검수 `verify:inquiry:live` 에서는 이 값과 동일한 env 는 거부한다. */
export const KAKAO_OPEN_CHAT_URL_FALLBACK = 'https://pf.kakao.com/_xlxjrxlX/chat' as const

/** 운영 기본: 카카오 채널 1:1 상담(/chat). env 로 덮어쓸 수 있음. */
export const KAKAO_OPEN_CHAT_URL =
  process.env.NEXT_PUBLIC_KAKAO_OPEN_CHAT_URL?.trim() || KAKAO_OPEN_CHAT_URL_FALLBACK
