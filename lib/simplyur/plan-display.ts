/**
 * SimplyUR plan card labels (days / data / unlimited hints).
 * REGRESSION-FREEZE[simplyur-plan-unlimited-hint]: Unlimited vs Full unlimited data_hint — manifest
 */
import {
  extractDaysFromDaysRaw,
  isTrueUnlimited,
  type ProductOption,
} from "@/lib/bongsim/recommend/product-option";
import type { SimplyurLocale } from "@/lib/simplyur/constants";
import { withoutHangul } from "@/lib/simplyur/display-guard";

type DataCategory = "unlimited" | "daily" | "fixed";
type AllowanceBucketId = "unlimited" | "500mb" | "1gb" | "2gb" | "3gb" | "4gb" | "5gb";

type DisplayStrings = {
  days: (n: number) => string;
  allowance: Record<AllowanceBucketId, string>;
  fullUnlimited: string;
  /** Card title when qos max speed is known. */
  unlimitedWithSpeed: (mbps: string) => string;
  fullUnlimitedWithSpeed: (mbps: string) => string;
  /** Short card subline — why pick each unlimited tier. */
  unlimitedHint: string;
  unlimitedHintWithSpeed: (mbps: string) => string;
  fullUnlimitedHint: string;
  fullUnlimitedHintWithSpeed: (mbps: string) => string;
  fixedTotal: (label: string) => string;
};

const FALLBACK_DAYS: Record<SimplyurLocale, string> = {
  en: "—",
  ja: "—",
  zh: "—",
  "zh-TW": "—",
  vi: "—",
};

const FALLBACK_DATA: Record<SimplyurLocale, string> = {
  en: "Mobile data",
  ja: "モバイルデータ",
  zh: "移动数据",
  "zh-TW": "行動數據",
  vi: "Dữ liệu di động",
};

const DISPLAY: Record<SimplyurLocale, DisplayStrings> = {
  en: {
    days: (n) => (n === 1 ? "1 day" : `${n} days`),
    allowance: {
      unlimited: "Unlimited",
      "500mb": "500 MB/day",
      "1gb": "1 GB/day",
      "2gb": "2 GB/day",
      "3gb": "3 GB/day",
      "4gb": "4 GB/day",
      "5gb": "5 GB/day",
    },
    fullUnlimited: "Full unlimited",
    unlimitedWithSpeed: (mbps) => `Unlimited · up to ${mbps}`,
    fullUnlimitedWithSpeed: (mbps) => `Full unlimited · up to ${mbps}`,
    unlimitedHint: "Data doesn’t run out — everyday use at this plan’s max speed",
    unlimitedHintWithSpeed: (mbps) =>
      `Data doesn’t run out — maps, chat & browsing at up to ${mbps}`,
    fullUnlimitedHint:
      "No daily GB bucket — better for video, hotspot & heavy use (fair use may apply)",
    fullUnlimitedHintWithSpeed: (mbps) =>
      `No daily GB bucket · up to ${mbps} — better for video & heavy use (fair use may apply)`,
    fixedTotal: (label) => `${label} total`,
  },
  ja: {
    days: (n) => `${n}日`,
    allowance: {
      unlimited: "無制限",
      "500mb": "500MB/日",
      "1gb": "1GB/日",
      "2gb": "2GB/日",
      "3gb": "3GB/日",
      "4gb": "4GB/日",
      "5gb": "5GB/日",
    },
    fullUnlimited: "完全無制限",
    unlimitedWithSpeed: (mbps) => `無制限 · 最大${mbps}`,
    fullUnlimitedWithSpeed: (mbps) => `完全無制限 · 最大${mbps}`,
    unlimitedHint: "容量切れなし · 日常利用向け（プランの最大速度）",
    unlimitedHintWithSpeed: (mbps) =>
      `容量切れなし · 地図・SNS・ブラウズ向け（最大${mbps}）`,
    fullUnlimitedHint: "1日のGB上限なし · 動画やヘビー利用向け（公正利用あり）",
    fullUnlimitedHintWithSpeed: (mbps) =>
      `1日のGB上限なし · 最大${mbps} · 動画・ヘビー利用向け（公正利用あり）`,
    fixedTotal: (label) => `合計 ${label}`,
  },
  zh: {
    days: (n) => `${n}天`,
    allowance: {
      unlimited: "无限",
      "500mb": "500MB/天",
      "1gb": "1GB/天",
      "2gb": "2GB/天",
      "3gb": "3GB/天",
      "4gb": "4GB/天",
      "5gb": "5GB/天",
    },
    fullUnlimited: "完全无限",
    unlimitedWithSpeed: (mbps) => `无限 · 最高${mbps}`,
    fullUnlimitedWithSpeed: (mbps) => `完全无限 · 最高${mbps}`,
    unlimitedHint: "用不完流量 · 日常地图/聊天（有最高速度）",
    unlimitedHintWithSpeed: (mbps) => `用不完流量 · 地图、聊天、浏览（最高${mbps}）`,
    fullUnlimitedHint: "无每日 GB 额度 · 更适合视频与重度使用（可能有合理使用）",
    fullUnlimitedHintWithSpeed: (mbps) =>
      `无每日 GB 额度 · 最高${mbps} · 更适合视频与重度使用（可能有合理使用）`,
    fixedTotal: (label) => `共 ${label}`,
  },
  "zh-TW": {
    days: (n) => `${n}天`,
    allowance: {
      unlimited: "無限",
      "500mb": "500MB/天",
      "1gb": "1GB/天",
      "2gb": "2GB/天",
      "3gb": "3GB/天",
      "4gb": "4GB/天",
      "5gb": "5GB/天",
    },
    fullUnlimited: "完全無限",
    unlimitedWithSpeed: (mbps) => `無限 · 最高${mbps}`,
    fullUnlimitedWithSpeed: (mbps) => `完全無限 · 最高${mbps}`,
    unlimitedHint: "流量用不完 · 日常地圖/聊天（有最高速度）",
    unlimitedHintWithSpeed: (mbps) => `流量用不完 · 地圖、聊天、瀏覽（最高${mbps}）`,
    fullUnlimitedHint: "無每日 GB 額度 · 更適合影片與重度使用（可能有合理使用）",
    fullUnlimitedHintWithSpeed: (mbps) =>
      `無每日 GB 額度 · 最高${mbps} · 更適合影片與重度使用（可能有合理使用）`,
    fixedTotal: (label) => `共 ${label}`,
  },
  vi: {
    days: (n) => `${n} ngày`,
    allowance: {
      unlimited: "Không giới hạn",
      "500mb": "500 MB/ngày",
      "1gb": "1 GB/ngày",
      "2gb": "2 GB/ngày",
      "3gb": "3 GB/ngày",
      "4gb": "4 GB/ngày",
      "5gb": "5 GB/ngày",
    },
    fullUnlimited: "Không giới hạn toàn phần",
    unlimitedWithSpeed: (mbps) => `Không giới hạn · tối đa ${mbps}`,
    fullUnlimitedWithSpeed: (mbps) => `Không giới hạn toàn phần · tối đa ${mbps}`,
    unlimitedHint: "Không hết dung lượng · dùng hàng ngày ở tốc độ tối đa của gói",
    unlimitedHintWithSpeed: (mbps) =>
      `Không hết dung lượng · bản đồ, chat, duyệt web (tối đa ${mbps})`,
    fullUnlimitedHint:
      "Không hạn mức GB/ngày · phù hợp xem video & dùng nhiều (có thể có fair use)",
    fullUnlimitedHintWithSpeed: (mbps) =>
      `Không hạn mức GB/ngày · tối đa ${mbps} · phù hợp xem video & dùng nhiều (có thể có fair use)`,
    fixedTotal: (label) => `${label} tổng`,
  },
};

function normalizeCapacityLabel(raw: string): string {
  const s = raw.trim();
  const gb = s.match(/(\d+(?:\.\d+)?)\s*gb/i);
  if (gb) return `${gb[1]!.toUpperCase()}GB`;
  const mb = s.match(/(\d+(?:\.\d+)?)\s*mb/i);
  if (mb) return `${mb[1]!.toUpperCase()}MB`;
  return s;
}

function detectAllowanceBucket(p: ProductOption): AllowanceBucketId | null {
  const label = (p.allowance_label || "").toLowerCase();
  const compact = label.replace(/\s/g, "");
  if (isTrueUnlimited(p)) return "unlimited";
  if (/500\s*mb|500mb|0\.5gb/i.test(compact)) return "500mb";
  if (/(?<!\d)5gb(?!\d)/i.test(compact)) return "5gb";
  if (/(?<!\d)4gb(?!\d)/i.test(compact)) return "4gb";
  if (/(?<!\d)3gb(?!\d)/i.test(compact)) return "3gb";
  if (/(?<!\d)2gb(?!\d)/i.test(compact)) return "2gb";
  if (/(?<!\d)1gb(?!\d)/i.test(compact)) return "1gb";
  return null;
}

function resolveDataCategory(p: ProductOption): DataCategory {
  const pt = (p.plan_type ?? "").trim().toLowerCase();
  if (pt === "unlimited" || pt === "daily" || pt === "fixed") return pt;
  if (isTrueUnlimited(p)) return "unlimited";
  if ((p.option_label ?? "").includes("매일")) return "daily";
  const allowance = (p.allowance_label ?? "").trim().toLowerCase().replace(/\s/g, "");
  if (/(\d+)(mb|gb)/i.test(allowance)) return "daily";
  return "daily";
}

function isFullUnlimitedLabel(allowanceLabel: string): boolean {
  return (
    allowanceLabel.includes("완전") || allowanceLabel.toLowerCase().includes("full")
  );
}

/** Parse plan max speed for traveler-facing "up to X Mbps" labels. */
export function formatSimplyurQosMbps(qosRaw: string | null | undefined): string | null {
  const low = (qosRaw || "").trim().toLowerCase();
  if (!low) return null;
  const kb = low.match(/(\d+(?:\.\d+)?)\s*kbps/);
  if (kb) {
    const n = parseFloat(kb[1]!);
    if (!Number.isFinite(n) || n <= 0) return null;
    const mbps = n / 1000;
    const rounded = mbps >= 1 ? String(Math.round(mbps)) : mbps.toFixed(2).replace(/\.?0+$/, "");
    return `${rounded} Mbps`;
  }
  const mb = low.match(/(\d+(?:\.\d+)?)\s*mbps/);
  if (mb) {
    const n = parseFloat(mb[1]!);
    if (!Number.isFinite(n) || n <= 0) return null;
    const rounded = n >= 1 ? String(Math.round(n)) : n.toFixed(2).replace(/\.?0+$/, "");
    return `${rounded} Mbps`;
  }
  return null;
}

export function formatSimplyurPlanDisplay(product: ProductOption, locale: SimplyurLocale) {
  const d = DISPLAY[locale] ?? DISPLAY.en;
  const days = extractDaysFromDaysRaw(product.days_raw) ?? 0;
  const daysLabel = days > 0 ? d.days(days) : FALLBACK_DAYS[locale] ?? FALLBACK_DAYS.en;
  const category = resolveDataCategory(product);
  const bucket = detectAllowanceBucket(product);

  let dataLabel: string;
  let dataHint: string | null = null;
  if (category === "unlimited") {
    const isFull = isFullUnlimitedLabel(product.allowance_label);
    const mbps = formatSimplyurQosMbps(product.qos_raw);
    if (isFull) {
      dataLabel = mbps ? d.fullUnlimitedWithSpeed(mbps) : d.fullUnlimited;
      dataHint = mbps ? d.fullUnlimitedHintWithSpeed(mbps) : d.fullUnlimitedHint;
    } else if (mbps) {
      dataLabel = d.unlimitedWithSpeed(mbps);
      dataHint = d.unlimitedHintWithSpeed(mbps);
    } else {
      dataLabel = d.allowance.unlimited;
      dataHint = d.unlimitedHint;
    }
  } else if (category === "daily" && bucket) {
    dataLabel = d.allowance[bucket];
  } else if (category === "fixed") {
    const cap = normalizeCapacityLabel(product.allowance_label);
    dataLabel = d.fixedTotal(withoutHangul(cap, FALLBACK_DATA[locale] ?? FALLBACK_DATA.en));
  } else {
    const cap = normalizeCapacityLabel(product.allowance_label);
    dataLabel = withoutHangul(cap, bucket ? d.allowance[bucket] : FALLBACK_DATA[locale] ?? FALLBACK_DATA.en);
  }

  return {
    daysLabel,
    dataLabel,
    dataHint,
    summary: `${daysLabel} · ${dataLabel}`,
  };
}
