import type { MyEsimBadgeTier } from "@/lib/simplyur/my-esim-design";

export type MyEsimOrderRow = {
  order_id: string;
  order_number: string;
  status_key: string;
  plan_summary: string;
  grand_total_krw: string;
  created_at: string;
  qr_code_img_url: string | null;
  sm_dp_plus_address: string | null;
  activation_code: string | null;
  can_show_qr: boolean;
  can_check_usage: boolean;
};

export type MyEsimUsageResponse = {
  total_used_mb: number;
  unlimited: boolean;
  cap_mb: number | null;
  history: { date: string; usageMb: number }[];
};

export function myEsimBadgeTier(statusKey: string): MyEsimBadgeTier {
  if (statusKey === "active") return "active";
  if (statusKey === "cancelled" || statusKey === "failed") return "expired";
  return "upcoming";
}

export function formatDataAmount(mb: number): string {
  if (!Number.isFinite(mb) || mb <= 0) return "0 GB";
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${Math.round(mb)} MB`;
}

export function todayUsageMb(history: { date: string; usageMb: number }[]): number {
  const today = new Date().toISOString().slice(0, 10);
  const hit = history.find((h) => h.date.startsWith(today));
  if (hit) return hit.usageMb;
  return history.length > 0 ? history[history.length - 1]!.usageMb : 0;
}

export function usageUsedPercent(usedMb: number, capMb: number | null): number {
  if (capMb == null || capMb <= 0) return 0;
  return Math.min(100, Math.round((usedMb / capMb) * 100));
}

export function interpolate(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(vars[key] ?? `{${key}}`));
}

export type UsageSummaryView = {
  usageLabel: string;
  sublabel: string;
  hasCap: boolean;
  usedPct: number;
  usedDisplay: string;
  usedOfLabel: string;
  remainingDisplay: string | null;
  showChart: boolean;
};

export function buildUsageSummaryView(
  order: MyEsimOrderRow,
  usage: MyEsimUsageResponse | null,
  tr: (key: string) => string,
): UsageSummaryView {
  if (!order.can_check_usage) {
    return {
      usageLabel: tr("myEsim.notStarted"),
      sublabel: tr("myEsim.activatesOnConnect"),
      hasCap: false,
      usedPct: 0,
      usedDisplay: "0 GB",
      usedOfLabel: tr("myEsim.usedSuffix"),
      remainingDisplay: null,
      showChart: false,
    };
  }

  if (!usage) {
    return {
      usageLabel: tr("myEsim.loadingUsage"),
      sublabel: "",
      hasCap: false,
      usedPct: 0,
      usedDisplay: "—",
      usedOfLabel: "",
      remainingDisplay: null,
      showChart: false,
    };
  }

  if (usage.unlimited) {
    const todayMb = todayUsageMb(usage.history);
    const todayLabel = formatDataAmount(todayMb);
    return {
      usageLabel: interpolate(tr("myEsim.usedToday"), { amount: todayLabel }),
      sublabel: tr("myEsim.unlimitedResetsDaily"),
      hasCap: false,
      usedPct: 0,
      usedDisplay: todayLabel,
      usedOfLabel: tr("myEsim.usedTodaySuffix"),
      remainingDisplay: null,
      showChart: usage.history.length > 0,
    };
  }

  const used = usage.total_used_mb;
  const cap = usage.cap_mb ?? 0;
  const remaining = Math.max(0, cap - used);
  const usedLabel = formatDataAmount(used);
  const capLabel = formatDataAmount(cap);
  return {
    usageLabel: interpolate(tr("myEsim.usedOfCap"), { used: usedLabel, cap: capLabel }),
    sublabel: "",
    hasCap: cap > 0,
    usedPct: usageUsedPercent(used, cap),
    usedDisplay: usedLabel,
    usedOfLabel: interpolate(tr("myEsim.usedOfSuffix"), { cap: capLabel }),
    remainingDisplay: formatDataAmount(remaining),
    showChart: usage.history.length > 0,
  };
}

export function formatOrderDate(iso: string, locale: string): string {
  try {
    return new Date(iso).toLocaleDateString(
      locale === "zh-TW" ? "zh-TW" : locale === "zh" ? "zh-CN" : locale,
      { year: "numeric", month: "short", day: "numeric" },
    );
  } catch {
    return iso.slice(0, 10);
  }
}

export function chartBarHeight(usageMb: number, maxMb: number): number {
  const max = Math.max(1, maxMb);
  return Math.max(8, Math.round((usageMb / max) * 88));
}

export function weekdayLabel(dateStr: string, locale: string): string {
  try {
    return new Date(dateStr + "T12:00:00").toLocaleDateString(
      locale === "zh-TW" ? "zh-TW" : locale === "zh" ? "zh-CN" : locale,
      { weekday: "short" },
    );
  } catch {
    return dateStr.slice(5);
  }
}
