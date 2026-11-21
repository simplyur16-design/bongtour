import { describe, expect, it } from "vitest";
import type { ProductOption } from "@/lib/bongsim/recommend/product-option";
import { orderFeaturedFirst, pickFeaturedPlanIds } from "@/lib/simplyur/catalog/featured-plans";
import { sortKoreaPlansBestFirst } from "@/lib/simplyur/catalog/sort-korea-plans";
import { buildSimplyurKoreaPack } from "@/lib/simplyur/catalog/load-korea-catalog";

// REGRESSION-FREEZE[simplyur-featured-plans]: 5/3/10-day regular unlimited first + featured — manifest

function row(id: string, days: number, planType: string, label: string, qos: string | null, krw: number): ProductOption {
  return {
    option_api_id: id,
    plan_name: "대한민국",
    network_family: "roaming",
    plan_type: planType as ProductOption["plan_type"],
    days_raw: `${days}일`,
    allowance_label: label,
    option_label: "",
    qos_raw: qos,
    price_block: { after: { consumer_krw: krw } },
    flags: {},
  };
}

function catalog(): ProductOption[] {
  const out: ProductOption[] = [];
  for (const d of [1, 3, 5, 7, 10]) {
    out.push(row(`full-${d}`, d, "unlimited", "완전 무제한", "5Mbps", 3000 * d));
    out.push(row(`u3-${d}`, d, "unlimited", "무제한", "3Mbps", 2400 * d));
    out.push(row(`u1-${d}`, d, "unlimited", "무제한", "1Mbps", 2000 * d));
    out.push(row(`d500-${d}`, d, "daily", "500MB", null, 600 * d));
  }
  return out;
}

describe("simplyur featured plans", () => {
  it("picks the regular unlimited with the highest speed for 5, 3, 10 days (in that order)", () => {
    expect(pickFeaturedPlanIds(catalog())).toEqual(["u3-5", "u3-3", "u3-10"]);
  });

  it("featured first, the rest keeps best-first order; nothing is dropped", () => {
    const sorted = sortKoreaPlansBestFirst(catalog());
    const { products, featuredIds } = orderFeaturedFirst(sorted);
    expect(products.slice(0, 3).map((p) => p.option_api_id)).toEqual(["u3-5", "u3-3", "u3-10"]);
    expect(products).toHaveLength(sorted.length);
    expect([...featuredIds].sort()).toEqual(["u3-10", "u3-3", "u3-5"]);
    const rest = products.slice(3).map((p) => p.option_api_id);
    expect(rest).toEqual(sorted.map((p) => p.option_api_id).filter((id) => !featuredIds.has(id)));
    // within the 5-day group (what the app/web show for the default 5-day chip) the featured plan is first
    const five = products.filter((p) => p.days_raw === "5일").map((p) => p.option_api_id);
    expect(five).toEqual(["u3-5", "full-5", "u1-5", "d500-5"]);
  });

  it("skips a trip length without a regular unlimited plan", () => {
    const only1 = catalog().filter((p) => !p.days_raw.startsWith("10") && !p.days_raw.startsWith("3"));
    expect(pickFeaturedPlanIds(only1)).toEqual(["u3-5"]);
  });

  it("pack rows carry featured=true only on representatives; min_display stays the cheapest", () => {
    const pack = buildSimplyurKoreaPack(catalog(), "en", { USD: 1350, JPY: 9.2, CNY: 185, TWD: 42, VND: 0.055 });
    const rows = pack.roaming.products;
    expect(rows.slice(0, 3).map((p) => [p.option_api_id, p.featured])).toEqual([
      ["u3-5", true],
      ["u3-3", true],
      ["u3-10", true],
    ]);
    expect(rows.filter((p) => p.featured)).toHaveLength(3);
    const cheapest = rows.find((p) => p.option_api_id === "d500-1");
    expect(pack.roaming.min_display).toEqual(cheapest?.simplyur_display);
  });
});
