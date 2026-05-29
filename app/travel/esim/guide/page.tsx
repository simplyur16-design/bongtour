import type { Metadata } from "next";
import { EsimInstallGuideClient } from "./EsimInstallGuideClient";

export const metadata: Metadata = {
  title: "eSIM 설치 가이드 | Bong투어 eSIM",
  description:
    "여행자님, eSIM 발급부터 설치·활성화·삭제까지 iPhone·Android 경로별로 단계별 안내와 자주 묻는 질문을 확인해 보세요.",
};

export default function EsimInstallGuidePage() {
  return <EsimInstallGuideClient />;
}
