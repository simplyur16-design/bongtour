import type { CountryOption } from "@/lib/bongsim/types";

/** usimsa 그리드 타일 — 다국가 한 줄 라벨 */
export type UsimsaPickerItem = CountryOption & {
  displayNameKr?: string;
};
