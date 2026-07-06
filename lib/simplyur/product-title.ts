import type { SimplyurLocale } from "@/lib/simplyur/constants";

type TitleParts = {
  days: number | null;
  dataLabel: string;
  networkLabel: string;
};

function isLocalNetwork(networkLabel: string): boolean {
  return networkLabel.toLowerCase().includes("local") || networkLabel.includes("本地") || networkLabel.includes("ローカル");
}

/** design_handoff_product — "Korea {N}-day {data} {network}" (locale-aware). */
export function formatSimplyurProductTitle(
  locale: SimplyurLocale,
  { days, dataLabel, networkLabel }: TitleParts,
): string {
  const n = days ?? 0;
  const local = isLocalNetwork(networkLabel);

  if (locale === "en") {
    const networkShort = local ? "Local" : "Roaming";
    return n > 0
      ? `Korea ${n}-day ${dataLabel} ${networkShort}`
      : `Korea ${dataLabel} ${networkShort}`;
  }

  if (locale === "ja") {
    const networkJa = local ? "ローカル" : "ローミング";
    return n > 0 ? `韓国 ${n}日 ${dataLabel} ${networkJa}` : `韓国 ${dataLabel} ${networkJa}`;
  }

  if (locale === "zh") {
    const networkZh = local ? "本地" : "漫游";
    return n > 0 ? `韩国 ${n}天 ${dataLabel} ${networkZh}` : `韩国 ${dataLabel} ${networkZh}`;
  }

  if (locale === "zh-TW") {
    const networkZh = local ? "本地" : "漫遊";
    return n > 0 ? `韓國 ${n}天 ${dataLabel} ${networkZh}` : `韓國 ${dataLabel} ${networkZh}`;
  }

  const networkVi = local ? "Local" : "Roaming";
  return n > 0
    ? `Hàn Quốc ${n} ngày ${dataLabel} ${networkVi}`
    : `Hàn Quốc ${dataLabel} ${networkVi}`;
}

export function simplyurNetworkLabelFromFamily(
  family: string | undefined,
  roamingLabel: string,
  localLabel: string,
): string {
  return (family || "").toLowerCase() === "local" ? localLabel : roamingLabel;
}
