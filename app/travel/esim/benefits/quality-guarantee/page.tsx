import type { Metadata } from "next";
import { EsimBenefitPageShell } from "@/components/bongsim/EsimBenefitPageShell";
import { EsimQualityGuaranteeSections } from "@/components/bongsim/EsimQualityGuaranteeSections";

export const metadata: Metadata = {
  title: "품질보장서비스 | Bong투어 eSIM",
  description:
    "제품 결함 시 전액 환불 등 Bong투어 eSIM 품질보장의 취지, 여행자 보호, 환불 기준 안내입니다.",
  alternates: { canonical: "/travel/esim/benefits/quality-guarantee" },
};

export default function EsimQualityGuaranteeBenefitPage() {
  return (
    <EsimBenefitPageShell
      title="품질보장서비스"
      subtitle="결함 시 전액 환불 — 여행자와 함께하는 연결 품질"
      intro="Bong투어 eSIM은 ‘데이터를 많이 썼는지’보다 ‘약속한 연결·서비스가 제대로였는지’를 기준으로 품질을 봅니다. 확인된 제품 결함에는 정책에 따라 전액 환불 또는 재발급을 안내합니다."
      introHeading="품질보장이란"
      introBullets={[
        "사용량과 무관하게, 제품·서비스 결함 여부를 별도로 확인합니다.",
        "현지 연결 문제 사례를 축적해 국가·망별 안내를 개선합니다.",
        "구체적 환불·활성화 기준은 eSIM 환불·서비스 정책을 따릅니다.",
      ]}
      countriesHeading="문의·신청"
      countriesText="결함·연결 이상이 의심되면 주문 정보와 함께 고객센터로 연락해 주세요. 상담 후 정책에 맞는 환불·재발급 절차를 안내해 드립니다."
      countriesBullets={[]}
      noticeHeading="참고"
      noticeItems={[
        "QR 미사용(미활성) 시 전액 환불 등 일반 환불 규정은 정책 페이지를 확인해 주세요.",
        "활성화 후 단순 변심 환불은 제한될 수 있습니다.",
        "품질보장 범위·절차는 운영 정책 변경 시 사전 안내 후 적용될 수 있습니다.",
      ]}
      childrenBeforeNotice
    >
      <div className="mt-6 lg:mt-8">
        <EsimQualityGuaranteeSections />
      </div>
    </EsimBenefitPageShell>
  );
}
