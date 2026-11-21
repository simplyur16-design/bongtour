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
  download_link?: string | null;
  apple_quick_install_url?: string | null;
  android_quick_install_url?: string | null;
  can_show_qr: boolean;
  can_check_usage: boolean;
  /** Paid/delivered — unused check runs on cancel request */
  can_request_refund?: boolean;
};

export type MyEsimUsageResponse = {
  total_used_mb: number;
  unlimited: boolean;
  cap_mb: number | null;
  history: { date: string; usageMb: number }[];
  /** 1.0.3 API: "daily" = cap_mb is a per-day allowance; total_used_mb/used_mb is today's usage. */
  cap_scope?: "daily" | "total" | "none";
  used_mb?: number;
  today_used_mb?: number;
  cumulative_used_mb?: number;
};

export function myEsimBadgeTier(
  statusKey: string,
  opts?: { can_show_qr?: boolean },
): MyEsimBadgeTier {
  if (statusKey === "active") return "active";
  if (statusKey === "cancelled" || statusKey === "failed") return "expired";
  if (statusKey === "refundPending") return "refundPending";
  if (opts?.can_show_qr) return "ready";
  return "preparing";
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
  if (!Number.isFinite(usedMb) || usedMb <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((usedMb / capMb) * 100)));
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
  /** Word after remainingDisplay ("left" / "left today"). */
  leftLabel: string;
  /** Plan allowance fully used (ring 100%, label says so instead of "X of Y"). */
  capReached: boolean;
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
      leftLabel: tr("myEsim.leftWord"),
      capReached: false,
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
      leftLabel: tr("myEsim.leftWord"),
      capReached: false,
      showChart: false,
    };
  }

  if (usage.unlimited) {
    const todayMb = usage.today_used_mb ?? todayUsageMb(usage.history);
    const todayLabel = formatDataAmount(todayMb);
    return {
      usageLabel: interpolate(tr("myEsim.usedToday"), { amount: todayLabel }),
      sublabel: tr("myEsim.unlimitedResetsDaily"),
      hasCap: false,
      usedPct: 0,
      usedDisplay: todayLabel,
      usedOfLabel: tr("myEsim.usedTodaySuffix"),
      remainingDisplay: null,
      leftLabel: tr("myEsim.leftWord"),
      capReached: false,
      showChart: usage.history.length > 0,
    };
  }

  const daily = usage.cap_scope === "daily";
  const rawUsed = usage.used_mb ?? usage.total_used_mb;
  const used = Number.isFinite(rawUsed) && rawUsed > 0 ? rawUsed : 0;
  const cap = usage.cap_mb != null && usage.cap_mb > 0 ? usage.cap_mb : 0;
  const capLabel = formatDataAmount(cap);
  const leftLabel = tr(daily ? "myEsim.leftToday" : "myEsim.leftWord");
  if (cap <= 0) {
    const usedLabel = formatDataAmount(used);
    return {
      usageLabel: interpolate(tr("myEsim.usedAmount"), { amount: usedLabel }),
      sublabel: "",
      hasCap: false,
      usedPct: 0,
      usedDisplay: usedLabel,
      usedOfLabel: tr("myEsim.usedSuffix"),
      remainingDisplay: null,
      leftLabel,
      capReached: false,
      showChart: usage.history.length > 0,
    };
  }
  // Never show "2.9 GB of 2.0 GB": at/over the cap the allowance is simply used up.
  const capReached = used >= cap;
  const shownUsed = Math.min(used, cap);
  const usedLabel = formatDataAmount(shownUsed);
  const usageLabel = capReached
    ? interpolate(tr(daily ? "myEsim.dailyCapReached" : "myEsim.capReached"), { cap: capLabel })
    : interpolate(tr(daily ? "myEsim.usedOfCapToday" : "myEsim.usedOfCap"), { used: usedLabel, cap: capLabel });
  return {
    usageLabel,
    sublabel: daily ? tr("myEsim.dailyPlanResets") : "",
    hasCap: true,
    usedPct: capReached ? 100 : usageUsedPercent(shownUsed, cap),
    usedDisplay: usedLabel,
    usedOfLabel: interpolate(tr(daily ? "myEsim.usedOfSuffixToday" : "myEsim.usedOfSuffix"), { cap: capLabel }),
    remainingDisplay: formatDataAmount(Math.max(0, cap - shownUsed)),
    leftLabel,
    capReached,
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
