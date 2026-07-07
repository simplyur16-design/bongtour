export type DayChipVisualState = "default" | "recommended" | "selected";

/** 칩 시각 상태 — DayChipPicker·simplyur duration picker 공용 */
export function resolveDayChipVisualState(
  day: number,
  value: number | null,
  recommendedDay: number | null | undefined,
): DayChipVisualState {
  if (value === day) return "selected";
  if (recommendedDay != null && recommendedDay === day) return "recommended";
  return "default";
}
