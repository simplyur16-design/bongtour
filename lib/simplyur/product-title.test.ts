import { describe, expect, it } from "vitest";
import { formatSimplyurProductTitle } from "./product-title";

describe("formatSimplyurProductTitle", () => {
  it("formats English Korea plan title", () => {
    expect(
      formatSimplyurProductTitle("en", {
        days: 7,
        dataLabel: "Unlimited",
        networkLabel: "Roaming network",
      }),
    ).toBe("Korea 7-day Unlimited Roaming");
  });

  it("formats JPY locale title with local network", () => {
    expect(
      formatSimplyurProductTitle("ja", {
        days: 3,
        dataLabel: "無制限",
        networkLabel: "Local Korean network",
      }),
    ).toBe("韓国 3日 無制限 ローカル");
  });
});
