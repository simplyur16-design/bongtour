import type { Metadata } from "next";
import { EsimBenefitPageShell } from "@/components/bongsim/EsimBenefitPageShell";

const TRAVELER_VERIFICATION_URL = "https://global.cmlink.com/en/real-name";

export const metadata: Metadata = {
  title: "여행자 인증(실명 인증) 안내 | Bong투어 eSIM",
  description:
    "홍콩·마카오·대만 eSIM 사용 전 여행자 인증(실명 인증) 방법과 ICCID(8985234) 확인 기준을 안내합니다.",
  alternates: { canonical: "/travel/esim/benefits/traveler-verification" },
};

export default function EsimTravelerVerificationPage() {
  return (
    <EsimBenefitPageShell
      title="여행자 인증(실명 인증) 안내"
      subtitle="홍콩·마카오·대만은 사용 전 본인 확인이 필요해요"
      introHeading="여행자 인증이란"
      intro="일부 국가의 통신 정책상, 본인 확인이 완료되어야 데이터 사용이 가능합니다. 간단한 여권 정보 인증으로 진행됩니다."
      introBullets={[
        "홍콩·마카오·대만 상품 이용 시 여행자 인증이 필요합니다.",
        "중국 본토 단독 상품은 여행자 인증이 필요 없습니다.",
        "eSIM 설치 후 인증할 수 있어요.",
        "인증이 필요한 상품은 국내에서 미리 설치·인증해도 날짜가 차감되지 않아요.",
      ]}
      countriesHeading="내 상품이 인증 대상인지 확인"
      countriesText="ICCID 번호 앞자리로 인증 필요 여부를 확인할 수 있어요."
      countriesBullets={[
        "ICCID가 8985234로 시작 → 여행자 인증 필요 (홍콩·마카오·대만)",
        "그 외 ICCID(예: 90000·8985235 등) → 인증 불필요 (중국 본토 포함)",
        "ICCID는 주문 완료 화면·이메일·마이페이지에서 확인할 수 있어요.",
      ]}
      noticeHeading="인증 방법"
      noticeLink={{
        href: TRAVELER_VERIFICATION_URL,
        label: "여행자 인증 페이지 열기 (홍콩·마카오·대만)",
      }}
      noticeItems={[
        "여권 사진은 그림자·빛반사 없이, 가장자리 4면이 잘리지 않게 반듯하게 촬영해 주세요.",
        "승인 여부는 인증 시 입력한 이메일로 확인할 수 있어요.",
        "ICCID는 한 번에 3개까지 등록할 수 있어요(+Add).",
        "미성년자는 보호자가 대신 등록해 주세요.",
      ]}
    />
  );
}
