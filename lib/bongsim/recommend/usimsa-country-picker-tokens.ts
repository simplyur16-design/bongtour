"use client";

/** usimsa 국가/다국가 그리드 — 모바일 4열 */
export const USIMSA_COUNTRY_GRID_CLASS =
  "grid w-full grid-cols-4 gap-x-1 gap-y-5 overflow-visible px-4 pt-1";

/** 국기 원형 — 14px 라벨과 균형 (50→52, +1 step) */
export const USIMSA_COUNTRY_FLAG_PX = 52;
export const USIMSA_COUNTRY_FLAG_BOX_CLASS = "h-[52px] w-[52px]";

/** usimsa 국가명 — 14px / 20px */
export const USIMSA_COUNTRY_LABEL_CLASS =
  "mt-1.5 w-full min-w-0 px-0.5 text-center text-[14px] font-medium leading-[20px] tracking-[-0.7px] text-[#222]";

export const USIMSA_COUNTRY_LABEL_SELECTED_CLASS =
  "font-semibold text-[#0176f9]";

export const USIMSA_COUNTRY_SUBTITLE_CLASS =
  "mt-0.5 line-clamp-2 w-full min-w-0 px-0.5 text-center text-[12px] font-normal leading-[18px] tracking-[-0.6px] text-[#767676]";

export const USIMSA_COUNTRY_SUBTITLE_SELECTED_CLASS = "font-medium text-[#0176f9]";

/** 「여러 나라를 방문하시나요?」 — 16/14px, 중앙, 봉투어 브랜드 배경 */
export const USIMSA_MULTI_TRIP_ENTRY_BOX_CLASS =
  "rounded-xl bg-bt-brand-blue-soft px-4 py-4 text-center transition active:opacity-90";

export const USIMSA_MULTI_TRIP_ENTRY_TITLE_CLASS =
  "block text-[16px] font-semibold leading-[22px] tracking-[-0.8px] text-[#111]";

export const USIMSA_MULTI_TRIP_ENTRY_SUBTITLE_CLASS =
  "mt-1 block text-[14px] font-normal leading-[20px] tracking-[-0.7px] text-[#767676]";

/** 인기국가 탭 — 더보기 전 노출 (11개 + 더보기 = 4열×3행) */
export const USIMSA_POPULAR_COLLAPSED_COUNT = 11;

/** 다국가 탭 — 더보기 전 노출 (11개 + 더보기) */
export const USIMSA_MULTI_COLLAPSED_COUNT = 11;
