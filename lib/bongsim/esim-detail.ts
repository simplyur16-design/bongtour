import type { CountryOption } from "./types";
import type { EsimCountryDetail, EsimPlanOption, EsimPlanTemplate } from "./types";

const JP_HERO =
  "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=1200&q=80&auto=format&fit=crop";
const TH_HERO =
  "https://images.unsplash.com/photo-1552465011-b4e21bf6e79a?w=1200&q=80&auto=format&fit=crop";
const VN_HERO =
  "https://images.unsplash.com/photo-1583417319070-c77ccbdd8c77?w=1200&q=80&auto=format&fit=crop";
const GENERIC_HERO =
  "https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=1200&q=80&auto=format&fit=crop";

const JP_TEMPLATES: EsimPlanTemplate[] = [
  {
    tierKey: "full",
    title: "완전 무제한",
    subtitle: "공정이용·상품 안내에 따른 정책형 무제한이에요.",
    basePrice: 9000,
    perDay: 650,
    isRecommended: true,
    isUnlimited: true,
    benefitLines: ["지도·SNS 무료 데이터", "주요 앱 무료 데이터", "봉SIM 개통 안내"],
  },
  {
    tierKey: "d5",
    title: "매일 5GB 이후 저속 무제한",
    subtitle: "고화질 영상·게임에도 넉넉한 편이에요.",
    basePrice: 7200,
    perDay: 520,
    benefitLines: ["지도·SNS 무료 데이터", "주요 앱 무료 데이터"],
  },
  {
    tierKey: "d3",
    title: "매일 3GB 이후 저속 무제한",
    subtitle: "영상 시청과 내비를 함께 쓰기 좋아요.",
    basePrice: 6400,
    perDay: 460,
    benefitLines: ["지도·SNS 무료 데이터", "주요 앱 무료 데이터"],
  },
  {
    tierKey: "d2",
    title: "매일 2GB 이후 저속 무제한",
    subtitle: "일상 여행·SNS 위주 일정에 맞춰요.",
    basePrice: 5600,
    perDay: 400,
    benefitLines: ["지도·SNS 무료 데이터"],
  },
  {
    tierKey: "d1",
    title: "매일 1GB 이후 저속 무제한",
    subtitle: "메신저·지도 중심으로 가볍게.",
    basePrice: 4800,
    perDay: 340,
    benefitLines: ["지도·SNS 무료 데이터"],
  },
  {
    tierKey: "d500",
    title: "매일 500MB 이후 저속 무제한",
    subtitle: "짧은 이동·최소 데이터로 충분할 때.",
    basePrice: 3800,
    perDay: 260,
    benefitLines: ["지도·SNS 무료 데이터"],
  },
];

const TH_TEMPLATES: EsimPlanTemplate[] = [
  {
    tierKey: "full",
    title: "완전 무제한",
    subtitle: "공정이용·상품 안내에 따른 정책형 무제한이에요.",
    basePrice: 7800,
    perDay: 580,
    isRecommended: true,
    isUnlimited: true,
    benefitLines: ["지도·SNS 무료 데이터", "봉SIM 개통 안내"],
  },
  {
    tierKey: "d5",
    title: "매일 5GB 이후 저속 무제한",
    subtitle: "방콕·푸켓 일정에 데이터 여유.",
    basePrice: 6200,
    perDay: 480,
    benefitLines: ["지도·SNS 무료 데이터"],
  },
  {
    tierKey: "d3",
    title: "매일 3GB 이후 저속 무제한",
    subtitle: "SNS·지도·영상을 골고루.",
    basePrice: 5400,
    perDay: 420,
    benefitLines: ["지도·SNS 무료 데이터"],
  },
  {
    tierKey: "d2",
    title: "매일 2GB 이후 저속 무제한",
    subtitle: "현지 이동이 많은 일정에.",
    basePrice: 4600,
    perDay: 360,
    benefitLines: ["지도·SNS 무료 데이터"],
  },
  {
    tierKey: "d1",
    title: "매일 1GB 이후 저속 무제한",
    subtitle: "가볍게 쓰는 여행용.",
    basePrice: 3900,
    perDay: 300,
    benefitLines: ["지도·SNS 무료 데이터"],
  },
  {
    tierKey: "d500",
    title: "매일 500MB 이후 저속 무제한",
    subtitle: "최소한의 연결만 필요할 때.",
    basePrice: 3200,
    perDay: 240,
    benefitLines: ["지도·SNS 무료 데이터"],
  },
];

const VN_TEMPLATES: EsimPlanTemplate[] = [
  {
    tierKey: "full",
    title: "완전 무제한",
    subtitle: "공정이용·상품 안내에 따른 정책형 무제한이에요.",
    basePrice: 7500,
    perDay: 560,
    isRecommended: true,
    isUnlimited: true,
    benefitLines: ["지도·SNS 무료 데이터", "봉SIM 개통 안내"],
  },
  {
    tierKey: "d5",
    title: "매일 5GB 이후 저속 무제한",
    subtitle: "영상·지도를 자주 쓰는 일정.",
    basePrice: 6000,
    perDay: 450,
    benefitLines: ["지도·SNS 무료 데이터"],
  },
  {
    tierKey: "d3",
    title: "매일 3GB 이후 저속 무제한",
    subtitle: "관광·맛집 탐방에 적당해요.",
    basePrice: 5200,
    perDay: 400,
    benefitLines: ["지도·SNS 무료 데이터"],
  },
  {
    tierKey: "d2",
    title: "매일 2GB 이후 저속 무제한",
    subtitle: "짧은 일정·SNS 위주.",
    basePrice: 4400,
    perDay: 340,
    benefitLines: ["지도·SNS 무료 데이터"],
  },
  {
    tierKey: "d1",
    title: "매일 1GB 이후 저속 무제한",
    subtitle: "메신저와 지도 중심.",
    basePrice: 3700,
    perDay: 280,
    benefitLines: ["지도·SNS 무료 데이터"],
  },
  {
    tierKey: "d500",
    title: "매일 500MB 이후 저속 무제한",
    subtitle: "가벼운 연결만 필요할 때.",
    basePrice: 3000,
    perDay: 220,
    benefitLines: ["지도·SNS 무료 데이터"],
  },
];

const DETAIL_CORE: Record<
  string,
  Omit<EsimCountryDetail, "code" | "nameKr" | "flag" | "planTemplates">
> = {
  jp: {
    heroImage: JP_HERO,
    heroAlt: "일본 도시 풍경",
    serviceTagline: "eSIM으로 빠르게 개통 · 데이터만 사용",
    reviewRating: 4.8,
    reviewCount: 1284,
    reviewChips: ["개통 빠름", "끊김 적음", "설치 안내 좋음"],
    durations: [1, 2, 3, 4, 5, 6, 7, 10, 14],
    info: {
      deviceCheckLabel: "eSIM 사용 가능 기종에서 확인",
      activation: "QR 또는 앱으로 등록 후 개통",
      startPolicy: "현지 네트워크 연결 시 데이터 시작(상품별 상이)",
      hotspot: "기기·요금제 설정에 따름(대부분 지원)",
      network: "현지 제휴 로밍·현지망(목적지별 상이)",
    },
  },
  th: {
    heroImage: TH_HERO,
    heroAlt: "태국 여행",
    serviceTagline: "eSIM 전용 · 현지에서 바로 연결",
    reviewRating: 4.7,
    reviewCount: 892,
    reviewChips: ["방콕 신호 좋음", "설치 쉬움"],
    durations: [1, 2, 3, 4, 5, 6, 7, 10],
    info: {
      deviceCheckLabel: "eSIM 사용 가능 기종에서 확인",
      activation: "도착 후 QR 등록 권장",
      startPolicy: "네트워크 첫 연결 시 시작",
      hotspot: "기기 설정에 따름",
      network: "태국 현지 제휴 네트워크",
    },
  },
  vn: {
    heroImage: VN_HERO,
    heroAlt: "베트남 풍경",
    serviceTagline: "eSIM으로 간편 개통",
    reviewRating: 4.6,
    reviewCount: 641,
    reviewChips: ["가성비", "데이터 안정"],
    durations: [1, 2, 3, 4, 5, 6, 7, 10],
    info: {
      deviceCheckLabel: "eSIM 사용 가능 기종에서 확인",
      activation: "사전 설치 후 현지에서 활성화",
      startPolicy: "현지 첫 연결 시 시작",
      hotspot: "기기 설정에 따름",
      network: "베트남 현지 제휴 네트워크",
    },
  },
};

const TEMPLATES_BY_CODE: Record<string, EsimPlanTemplate[]> = {
  jp: JP_TEMPLATES,
  th: TH_TEMPLATES,
  vn: VN_TEMPLATES,
};

export function esimPlanId(code: string, duration: number, tierKey: string): string {
  return `esim__${code}__${duration}__${tierKey}`;
}

export function parseEsimPlanId(
  id: string,
): { code: string; duration: number; tierKey: string } | null {
  const parts = id.split("__");
  if (parts.length !== 4 || parts[0] !== "esim") return null;
  const duration = Number(parts[2]);
  if (!Number.isFinite(duration) || duration < 1) return null;
  return { code: parts[1], duration, tierKey: parts[3] };
}

export function getEsimPlansForDuration(detail: EsimCountryDetail, duration: number): EsimPlanOption[] {
  return detail.planTemplates.map((t) => ({
    id: esimPlanId(detail.code, duration, t.tierKey),
    tierKey: t.tierKey,
    title: t.title,
    subtitle: t.subtitle,
    priceKrw: t.basePrice + duration * t.perDay,
    isRecommended: t.isRecommended,
    isUnlimited: t.isUnlimited,
    benefitLines: t.benefitLines,
  }));
}

export function snapDuration(durations: number[], want: number): number {
  if (durations.includes(want)) return want;
  return durations.reduce((best, d) =>
    Math.abs(d - want) < Math.abs(best - want) ? d : best,
  durations[0] ?? 5);
}

export function buildFallbackDetail(country: CountryOption): EsimCountryDetail {
  const code = country.code;
  const templates: EsimPlanTemplate[] = [
    {
      tierKey: "std10",
      title: "데이터 10GB",
      subtitle: "여행 기간 동안 정해진 용량을 사용해요.",
      basePrice: 12000,
      perDay: 800,
      isRecommended: true,
      benefitLines: ["데이터 전용", "봉SIM 개통 안내"],
    },
    {
      tierKey: "std5",
      title: "데이터 5GB",
      subtitle: "가볍게 쓰는 일정에 맞춰요.",
      basePrice: 9000,
      perDay: 600,
      benefitLines: ["데이터 전용"],
    },
  ];
  return {
    code,
    nameKr: country.nameKr,
    flag: country.flag,
    heroImage: GENERIC_HERO,
    heroAlt: `${country.nameKr} 여행`,
    serviceTagline: "eSIM 전용 상품",
    reviewRating: 4.5,
    reviewCount: 120,
    reviewChips: ["간편 개통"],
    durations: [1, 2, 3, 4, 5, 7, 10],
    info: {
      deviceCheckLabel: "eSIM 사용 가능 기종에서 확인",
      activation: "QR 또는 앱으로 등록",
      startPolicy: "현지 연결 시 시작",
      hotspot: "기기 설정에 따름",
      network: country.subtitleKr ? `${country.nameKr} (${country.subtitleKr})` : country.nameKr,
    },
    planTemplates: templates,
  };
}

export function getEsimCountryDetailOrFallback(country: CountryOption): EsimCountryDetail {
  const core = DETAIL_CORE[country.code];
  const templates = TEMPLATES_BY_CODE[country.code];
  if (core && templates) {
    return {
      code: country.code,
      nameKr: country.nameKr,
      flag: country.flag,
      planTemplates: templates,
      ...core,
    };
  }
  return buildFallbackDetail(country);
}
