import type { Metadata } from "next";
import { EsimBenefitPageShell } from "@/components/bongsim/EsimBenefitPageShell";
import { ESIM_BENEFIT_ROAMING_COUNTRIES } from "@/lib/bongsim/esim-benefit-content";

export const metadata: Metadata = {
  title: "구글맵 데이터 무료 | Bong투어 eSIM",
  description:
    "여행 중 구글지도 길찾기·경로 탐색을 데이터 차감 없이 이용할 수 있는 Bong투어 eSIM 혜택을 안내합니다.",
  alternates: { canonical: "/travel/esim/benefits/google-maps" },
};

export default function EsimGoogleMapsBenefitPage() {
  return (
    <EsimBenefitPageShell
      title="구글맵 데이터 무료"
      subtitle="여행 중 길찾기, 데이터 걱정 없이"
      intro="구글지도 기본 지도를 데이터 차감 없이 이용할 수 있습니다. 길찾기·경로 탐색·주변 장소 확인까지 부담 없이 사용해 보세요."
      countriesHeading="주요 적용 국가"
      countriesText={ESIM_BENEFIT_ROAMING_COUNTRIES}
      noticeItems={[
        "'로밍' 상품에 적용됩니다(상품 선택 화면에서 '로밍'으로 표시된 상품). '로컬' 상품은 제외될 수 있어요.",
        "기본 지도는 무료지만 사진·리뷰·영상 등 다른 콘텐츠는 데이터가 차감될 수 있어요.",
        "적용 상품·국가는 정책에 따라 변경될 수 있어요.",
      ]}
    />
  );
}
