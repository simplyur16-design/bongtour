import type { Metadata } from "next";
import { EsimInstallGuideClient } from "./EsimInstallGuideClient";

export const metadata: Metadata = {
  title: "eSIM 설치 가이드 | Bong투어 eSIM",
  description:
    "여행자님, QR코드로 eSIM을 설치하는 방법을 단계별로 안내합니다. iPhone·Samsung 경로와 자주 묻는 질문을 확인해 보세요.",
};

export default function EsimInstallGuidePage() {
  return <EsimInstallGuideClient />;
}
