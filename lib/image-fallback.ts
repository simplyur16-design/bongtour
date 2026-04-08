/**
 * Pexels 검색 실패 시 사용. 빈 칸·깨진 이미지 금지 원칙에 따라
 * 럭셔리 파노라마 풍경 1장을 상수로 보장.
 */
export const LUXURY_FALLBACK_IMAGE_URL =
  process.env.LUXURY_FALLBACK_IMAGE_URL ??
  'https://images.pexels.com/photos/1179229/pexels-photo-1179229.jpeg?auto=compress&cs=tinysrgb&w=1920'
