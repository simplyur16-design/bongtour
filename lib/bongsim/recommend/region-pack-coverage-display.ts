/**
 * 다국가 타일 클릭 시 지원국가 시트 — 라벨에 국가명이 이미 있으면 생략.
 * · 미국/캐나다, 유럽 33개국 → 클릭 즉시 선택
 * · 동남아 3개국, 글로벌 151개국 등 → 클릭 시 지원국가 시트 → 선택
 */
export function regionPackShowsCoverageOnSelect(displayLabel: string): boolean {
  const label = displayLabel.trim();
  if (!label) return true;
  if (label.includes("/")) return false;
  if (/^유럽\s+\d+개국$/.test(label)) return false;
  return true;
}
