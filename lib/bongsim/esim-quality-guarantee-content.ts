/** 품질보장 혜택 설명 — 랜딩·/benefits/quality-guarantee SSOT */

export type EsimQualityFaqItem = {
  question: string;
  answer: string;
};

export const ESIM_QUALITY_GUARANTEE_FAQ: readonly EsimQualityFaqItem[] = [
  {
    question: "왜 데이터 사용량과 무관하게 품질보장을 하나요?",
    answer:
      "연결·속도 문제는 여행자 잘못만으로 설명되기 어렵습니다. Bong투어 eSIM 운영, 현지 통신망, 단말·설정 환경이 겹칠 때가 많아서, 사용량과 관계없이 ‘제품·서비스 결함’ 기준으로 보호 범위를 분리해 두었습니다.",
  },
  {
    question: "품질보장을 통해 여행자가 얻는 것은 무엇인가요?",
    answer:
      "현지에서 막히는 경험을 줄이고, 확인된 결함에는 전액 환불 등 공정한 기준을 적용합니다. 그 과정에서 쌓인 사례를 바탕으로 국가·망별 안내와 상품 구성을 계속 다듬어, 다음 여행에서 더 나은 연결을 목표로 합니다.",
  },
] as const;

export const ESIM_QUALITY_GUARANTEE_PROMISE = {
  headline: "결함 시 전액 환불",
  lead: "QR 발송 후 활성화 전·후 기준은 eSIM 환불·서비스 정책을 따릅니다. 제품 결함으로 확인되면 전액 환불 또는 재발급을 안내해 드립니다.",
} as const;

export const ESIM_QUALITY_GUARANTEE_CLOSING = {
  paragraphs: [
    "Bong투어는 여행자의 데이터 경험과 여행 전체를 함께 보는 브랜드를 지향합니다.",
    "품질보장은 그 첫 번째 공약입니다. 앞으로도 현지 피드백과 운영 데이터를 바탕으로 국가별·망별 품질을 꾸준히 개선하겠습니다.",
    "여행은 준비 과정부터 편해야 합니다.",
  ],
} as const;
