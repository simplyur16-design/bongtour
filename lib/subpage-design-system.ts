import { SITE_CONTENT_CLASS } from '@/lib/site-content-layout'

/** PR-G: 하위 페이지 공통 페이지 배경 */
export const SUBPAGE_PAGE_SHELL_CLASS =
  'min-h-screen bg-gradient-to-b from-bt-bg-lavender-soft via-white to-bt-bg-lavender/30'

/** PR-G: 헤더·푸터와 맞춘 본문 컨테이너 */
export const SUBPAGE_MAIN_CLASS = `${SITE_CONTENT_CLASS} py-6 sm:py-8`

/** PR-G: 카드 이미지 하단 그라데이션 (메모리 #27 SSOT) */
export const SUBPAGE_CARD_IMAGE_GRADIENT_CLASS =
  'pointer-events-none absolute inset-x-0 bottom-0 z-[2] h-2/3 bg-gradient-to-t from-black/65 via-black/20 to-transparent'

/** PR-G: 카드 이미지 밝은 톤 워시 */
export const SUBPAGE_CARD_IMAGE_WASH_CLASS =
  'pointer-events-none absolute inset-0 z-[1] bg-white/10 mix-blend-soft-light'
