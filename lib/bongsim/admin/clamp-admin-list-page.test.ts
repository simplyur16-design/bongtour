import { describe, expect, it } from "vitest";
import { clampAdminListPage } from "@/lib/bongsim/admin/clamp-admin-list-page";

// REGRESSION-FREEZE[bongsim-admin-payments-pagination]: 이전/다음 clamp — manifest
describe("clampAdminListPage", () => {
  it("keeps page within 1..totalPages", () => {
    expect(clampAdminListPage(1, 4)).toBe(1);
    expect(clampAdminListPage(2, 4)).toBe(2);
    expect(clampAdminListPage(0, 4)).toBe(1);
    expect(clampAdminListPage(5, 4)).toBe(4);
    expect(clampAdminListPage(3, 1)).toBe(1);
  });
});
