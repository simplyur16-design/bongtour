/**
 * simplyur 앱 사전 예고 배너.
 *
 * "광고가 아니라 귀띔" 톤으로 전역에 몇 군데에만 자연스럽게 배치한다.
 *
 * 사용 위치 (기획안 기준):
 *   - variant="inline": 봉심 홈 PC/모바일 하단 한 줄
 *   - variant="card":   결제 완료 페이지 Simply Step 영역
 *
 * simplyur 출시 후에는 이 컴포넌트만 교체하거나 제거하면 노출을 일괄 정리할 수 있다.
 */

type Props = {
  variant?: "inline" | "card";
  /** 추후 출시 알림 신청 폼 라우트 생기면 연결 */
  alertHref?: string;
};

export function SimplyurTeaserBanner({ variant = "inline", alertHref }: Props) {
  if (variant === "card") {
    return (
      <section
        aria-label="simplyur 앱 예고"
        className="rounded-2xl border border-purple-100 bg-gradient-to-br from-purple-50 via-white to-sky-50 p-5 shadow-sm sm:p-6 lg:rounded-3xl lg:p-7"
      >
        <p className="text-[11px] font-bold uppercase tracking-wide text-purple-700">Simply Step</p>
        <h3 className="mt-1 text-lg font-bold text-slate-900">
          다음 여행은 더 &apos;심플&apos;해질 거예요
        </h3>
        <p className="mt-2 text-[13px] leading-relaxed text-slate-600">
          지금 구매하신 eSIM, 다음 여행부턴 곧 출시될 <span className="font-semibold text-purple-700">simplyur</span> 앱에서
          데이터 잔량·일정을 한눈에 관리할 수 있어요.
        </p>
        {alertHref ? (
          <a
            href={alertHref}
            className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl bg-purple-700 px-5 text-[13px] font-bold text-white shadow-sm transition hover:bg-purple-800"
          >
            출시 알림 신청하기
          </a>
        ) : (
          <p className="mt-4 inline-flex items-center rounded-xl bg-white px-4 py-2.5 text-[12px] font-semibold text-purple-800 ring-1 ring-purple-100">
            곧 만나요 · 준비 중
          </p>
        )}
      </section>
    );
  }

  // inline: 홈 하단 한 줄 귀띔
  return (
    <aside
      aria-label="simplyur 앱 예고"
      className="mt-6 rounded-2xl border border-slate-200/80 bg-white/70 px-4 py-3 text-center text-[12px] leading-relaxed text-slate-600 shadow-sm sm:text-[13px] lg:px-6 lg:py-4"
    >
      여행을 하나로 모으는 가장 쉬운 방법,{" "}
      <span className="font-bold text-purple-700">simplyur</span> 앱이 곧 찾아옵니다.
    </aside>
  );
}
