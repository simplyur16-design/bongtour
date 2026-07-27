import { describe, expect, it } from "vitest";
import {
  catalogMetaFromSlimRows,
  type CountryCatalogMetaRow,
} from "@/lib/bongsim/data/list-country-catalog-meta";

function row(partial: Partial<CountryCatalogMetaRow> & Pick<CountryCatalogMetaRow, "plan_name">): CountryCatalogMetaRow {
  return {
    network_family: "roaming",
    plan_type: "unlimited",
    allowance_label: "완전 무제한",
    flags: { kyc: "X" },
    ...partial,
  };
}

describe("catalogMetaFromSlimRows", () => {
  it("marks jp unlimited from roaming true-unlimited without price_block", () => {
    const meta = catalogMetaFromSlimRows(
      [
        row({ plan_name: "일본", allowance_label: "완전 무제한" }),
        row({ plan_name: "일본", allowance_label: "1GB", plan_type: "daily" }),
      ],
      ["jp"],
    );
    expect(meta.jp?.isUnlimited).toBe(true);
    expect(meta.jp?.travelerVerification).toBe("none");
  });

  it("forces travelerVerification none for china even when flags.kyc=O", () => {
    const meta = catalogMetaFromSlimRows(
      [row({ plan_name: "중국", flags: { kyc: "O" }, allowance_label: "1GB", plan_type: "daily" })],
      ["cn"],
    );
    expect(meta.cn?.travelerVerification).toBe("none");
  });

  it("keeps required for taiwan when flags.kyc=O", () => {
    const meta = catalogMetaFromSlimRows(
      [row({ plan_name: "대만", flags: { kyc: "O" }, allowance_label: "1GB", plan_type: "daily" })],
      ["tw"],
    );
    expect(meta.tw?.travelerVerification).toBe("required");
  });
});
