/** 스티키 카드 인원 스텝퍼 — ASCII 기호만 사용(인코딩·폰트 깨짐 방지) */
export const PAX_STEP_DECREMENT_GLYPH = '-'
export const PAX_STEP_INCREMENT_GLYPH = '+'

export const PAX_STEP_BUTTON_CLASS =
  'inline-flex h-9 w-9 shrink-0 select-none items-center justify-center rounded-lg border-2 border-[#1F1B2D] bg-white text-xl font-black leading-none text-[#1F1B2D] shadow-sm transition-colors hover:bg-[#EFEDF8] active:bg-[#FAFAFC] disabled:pointer-events-none disabled:border-[#DAD4EE] disabled:bg-[#FAFAFC] disabled:text-[#1F1B2D]/30'

export const STICKY_PAX_ROWS = [
  { key: 'adult' as const, label: '\uC131\uC778', ageLine: '\uB9CC 12\uC138 \uC774\uC0C1', minVal: 1 },
  { key: 'child' as const, label: '\uC544\uB3D9', ageLine: '\uB9CC 2~11\uC138', minVal: 0 },
  { key: 'infant' as const, label: '\uC720\uC544', ageLine: '\uB9CC 2\uC138 \uBBF8\uB9CC', minVal: 0 },
] as const
