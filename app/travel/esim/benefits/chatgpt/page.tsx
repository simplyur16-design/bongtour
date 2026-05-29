import type { Metadata } from "next";
import { EsimBenefitPageShell } from "@/components/bongsim/EsimBenefitPageShell";
import { ESIM_BENEFIT_ROAMING_COUNTRIES } from "@/lib/bongsim/esim-benefit-content";

export const metadata: Metadata = {
  title: "ChatGPT 데이터 무료 | Bong투어 eSIM",
  description:
    "여행 중 ChatGPT 번역·정보 검색을 데이터 부담 없이 이용할 수 있는 Bong투어 eSIM 혜택을 안내합니다.",
  alternates: { canonical: "/travel/esim/benefits/chatgpt" },
};

export default function EsimChatGptBenefitPage() {
  return (
    <EsimBenefitPageShell
      title="ChatGPT 데이터 무료"
      subtitle="여행 중 궁금한 모든 것, 데이터 부담 없이"
      intro="ChatGPT를 데이터 부담 없이 이용할 수 있습니다. 번역, 정보 검색, 여행 문의까지 편리하게 활용해 보세요."
      countriesHeading="주요 적용 국가"
      countriesText={ESIM_BENEFIT_ROAMING_COUNTRIES}
      noticeItems={[
        "'로밍' 상품에 적용됩니다(상품 선택 화면에서 '로밍'으로 표시된 상품). '로컬' 상품은 제외될 수 있어요.",
        "지정된 국가·상품에서만 적용됩니다.",
        "적용 대상은 정책에 따라 변경될 수 있어요.",
      ]}
    />
  );
}
