/**
 * 카카오 오픈채팅 1차 연동 URL.
 * 맥락 강화·유형 분기·운영 연계 로드맵: docs/KAKAO-COUNSEL-ROADMAP.md
 * 향후 UTM·쿼리는 이 상수를 래핑하는 헬퍼로 확장 가능.
 */
export const KAKAO_OPEN_CHAT_URL =
  process.env.NEXT_PUBLIC_KAKAO_OPEN_CHAT_URL ?? 'https://open.kakao.com/o/s13CLdai'
