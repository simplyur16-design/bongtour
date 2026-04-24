/** eSIM 공개 페이지 상단 임시 공지 — 결제 연동 전 안내 */
export default function EsimServiceNoticeBanner() {
  return (
    <div
      className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-center text-sm text-amber-800"
      role="status"
    >
      <p className="mb-1 text-base" aria-hidden>
        📢
      </p>
      <p className="font-bold">서비스 준비 중입니다</p>
      <p className="mt-2 leading-relaxed">
        현재 결제 시스템 연동 작업 중이며, 다음 주부터 eSIM 구매가 가능합니다. 빠른 시일 내에 더 나은 서비스로 찾아뵙겠습니다.
        감사합니다.
      </p>
    </div>
  )
}
