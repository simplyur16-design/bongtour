import type { SimplyurLocale } from '@/src/constants/simplyur';

type TitleParts = {
  days: number | null;
  dataLabel: string;
  networkLabel: string;
};

function isLocalNetwork(networkLabel: string): boolean {
  return (
    networkLabel.toLowerCase().includes('local') ||
    networkLabel.includes('本地') ||
    networkLabel.includes('ローカル')
  );
}

/** design_handoff_product — sync with lib/simplyur/product-title.ts */
export function formatProductTitle(locale: SimplyurLocale, parts: TitleParts): string {
  const { days, dataLabel, networkLabel } = parts;
  const n = days ?? 0;
  const local = isLocalNetwork(networkLabel);

  if (locale === 'en') {
    const networkShort = local ? 'Local' : 'Roaming';
    return n > 0
      ? `Korea ${n}-day ${dataLabel} ${networkShort}`
      : `Korea ${dataLabel} ${networkShort}`;
  }

  if (locale === 'ja') {
    const networkJa = local ? 'ローカル' : 'ローミング';
    return n > 0 ? `韓国 ${n}日 ${dataLabel} ${networkJa}` : `韓国 ${dataLabel} ${networkJa}`;
  }

  if (locale === 'zh') {
    const networkZh = local ? '本地' : '漫游';
    return n > 0 ? `韩国 ${n}天 ${dataLabel} ${networkZh}` : `韩国 ${dataLabel} ${networkZh}`;
  }

  if (locale === 'zh-TW') {
    const networkZh = local ? '本地' : '漫遊';
    return n > 0 ? `韓國 ${n}天 ${dataLabel} ${networkZh}` : `韓國 ${dataLabel} ${networkZh}`;
  }

  const networkVi = local ? 'Local' : 'Roaming';
  return n > 0
    ? `Hàn Quốc ${n} ngày ${dataLabel} ${networkVi}`
    : `Hàn Quốc ${dataLabel} ${networkVi}`;
}

export function networkLabelFromFamily(
  family: string | undefined,
  roamingLabel: string,
  localLabel: string,
): string {
  return (family || '').toLowerCase() === 'local' ? localLabel : roamingLabel;
}
