import { describe, expect, it } from "vitest";
import {
  clampAdminListPage,
  resolveAdminListPaging,
} from "@/lib/bongsim/admin/clamp-admin-list-page";

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

describe("resolveAdminListPaging", () => {
  it("clamps past-the-end page so list is not empty after count shrinks", () => {
    // pageSize 50, 12 rows → 1 page; requesting page 5 must fall back to page 1 / offset 0
    expect(resolveAdminListPaging({ page: 5, pageSize: 50, totalCount: 12 })).toEqual({
      page: 1,
      totalPages: 1,
      offset: 0,
    });
  });

  it("keeps in-range page and offset", () => {
    expect(resolveAdminListPaging({ page: 2, pageSize: 50, totalCount: 120 })).toEqual({
      page: 2,
      totalPages: 3,
      offset: 50,
    });
  });

  it("handles empty result set as one page", () => {
    expect(resolveAdminListPaging({ page: 3, pageSize: 50, totalCount: 0 })).toEqual({
      page: 1,
      totalPages: 1,
      offset: 0,
    });
  });
});
