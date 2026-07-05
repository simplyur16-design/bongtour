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

export function formatSimplyurPlanDisplay(product: ProductOption, locale: SimplyurLocale) {
  const d = DISPLAY[locale] ?? DISPLAY.en;
  const days = extractDaysFromDaysRaw(product.days_raw) ?? 0;
  const daysLabel = days > 0 ? d.days(days) : FALLBACK_DAYS[locale] ?? FALLBACK_DAYS.en;
  const category = resolveDataCategory(product);
  const bucket = detectAllowanceBucket(product);

  let dataLabel: string;
  if (category === "unlimited") {
    dataLabel =
      product.allowance_label.includes("완전") ||
      product.allowance_label.toLowerCase().includes("full")
        ? d.fullUnlimited
        : d.allowance.unlimited;
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
    summary: `${daysLabel} · ${dataLabel}`,
  };
}
