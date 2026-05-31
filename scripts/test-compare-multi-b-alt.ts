import {
  allowanceCapacityGb,
  judgeCompareMultiOffer,
} from "../lib/bongsim/recommend/compare-multi-offer";
import { classifyPlanSpeedTier } from "../lib/bongsim/recommend/plan-speed-tier";
import type { ProductOption } from "../lib/bongsim/recommend/product-option";

function mk(
  pt: string,
  qos: string,
  price: number,
  al: string,
): ProductOption {
  return {
    option_api_id: `t-${pt}-${al}-${price}`,
    plan_name: "multi test",
    network_family: "roaming",
    plan_type: pt,
    days_raw: "7일",
    allowance_label: al,
    option_label: "",
    qos_raw: qos,
    price_block: { after: { consumer_krw: price } },
    recommended_price: price,
    flags: {},
  };
}

// 동남아8: daily 500MB 6200, 1GB, 2GB, 3GB 18400
const dongnam8 = [
  mk("daily", "384kbps", 6200, "500MB"),
  mk("daily", "384kbps", 12000, "2GB"),
  mk("daily", "384kbps", 18400, "3GB"),
];

// 글로벌151: daily max 2GB only
const global151 = [
  mk("daily", "384kbps", 6200, "500MB"),
  mk("daily", "384kbps", 15000, "2GB"),
];

const unlim5 = mk("unlimited", "5mbps", 35400, "무제한");
const max5 = classifyPlanSpeedTier(unlim5)!;

console.log("500MB gb", allowanceCapacityGb(mk("daily", "", 0, "500MB")));

let ok = 0;

{
  const j = judgeCompareMultiOffer(max5, 35400, dongnam8);
  const pass = j.kind === "alternative" && j.offer.priceKrw === 18400;
  console.log(`${pass ? "OK" : "FAIL"} 무5M+동남아8 → b 3GB 18400:`, j.kind, j.kind !== "hidden" ? j.offer.priceKrw : "");
  if (pass) ok++;
}

{
  const j = judgeCompareMultiOffer(max5, 35400, global151);
  const pass = j.kind === "hidden";
  console.log(`${pass ? "OK" : "FAIL"} 무5M+글로벌151(2GB만) → hidden:`, j.kind);
  if (pass) ok++;
}

{
  // byTier daily cheapest is 500MB — old (b) would pick 6200; new must pick 3GB
  const j = judgeCompareMultiOffer(max5, 35400, dongnam8);
  const not500 = j.kind !== "hidden" && j.offer.priceKrw !== 6200;
  console.log(`${not500 ? "OK" : "FAIL"} (b)가 500MB 최저가(6200) 아님:`, j.kind === "hidden" ? "hidden" : j.offer.priceKrw);
  if (not500) ok++;
}

if (ok !== 3) process.exit(1);
console.log("All 3 passed.");
