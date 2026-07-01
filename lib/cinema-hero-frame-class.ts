/**
 * 풀폭 히어로 프레임 — 가로 100%, 세로는 화면·상한으로 제한.
 * 너무 납작하면 cover 줌이 심해지므로 sm 이상에서 높이를 조금 더 준다.
 */
export const CINEMA_HERO_FRAME_CLASS =
  'relative h-[min(60vh,30rem)] w-full overflow-hidden sm:h-[min(64vh,34rem)]'

/** cover 크롭 초점 — 사진 하단 1/3 중앙(≈2/3 지점) */
export const CINEMA_HERO_OBJECT_POSITION = 'center 67%'
