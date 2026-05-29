import { EsimVerificationGuideContent } from "@/components/bongsim/esim/EsimVerificationGuideContent";

/** PlanSelectPopup 인증 토글 — 인증 필요 선택 시 인라인 안내 박스 */
export function EsimVerificationGuideBox() {
  return (
    <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50/90 px-3.5 py-3">
      <EsimVerificationGuideContent />
    </div>
  );
}
