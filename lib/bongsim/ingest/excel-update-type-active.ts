/**
 * USIMSA 엑셀 `변경구분` / Update Type → `bongsim_product_option.is_active`.
 * 삭제만 비활성, 그 외(신규·유지·금액변경 등)는 판매 가능.
 */
export function isActiveFromExcelUpdateType(excelUpdateType: string | null | undefined): boolean {
  const raw = (excelUpdateType ?? "").trim();
  if (!raw) return true;
  const lower = raw.toLowerCase();
  if (raw === "삭제" || lower === "delete" || lower === "deletion" || lower === "removed") {
    return false;
  }
  return true;
}
