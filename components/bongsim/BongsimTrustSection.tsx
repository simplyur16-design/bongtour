type TrustItem = { title: string; sub: string; icon: string };

const TRUST: TrustItem[] = [
  {
    title: "믿음직한 로컬망 선택",
    sub: "Bong투어의 까다로운 기준으로 선별한 고품질 로컬망. 끊김 걱정 없이 현지인처럼 데이터를 즐기세요.",
    icon: "🛰",
  },
  {
    title: "여행 전문가의 1:1 케어",
    sub: "IT가 아닌 여행 서비스의 마음으로. 여정의 끝까지 문제 해결을 함께 고민해요.",
    icon: "💚",
  },
  {
    title: "구매 즉시 이메일 QR",
    sub: "자정에도 새벽에도 바로 발급돼요. 출국 직전 공항에서도 늦지 않아요.",
    icon: "⚡",
  },
  {
    title: "simplyur로 이어지는 관리",
    sub: "설치는 웹에서, 관리는 앱으로. 곧 출시될 simplyur에서 데이터 잔량·일정을 한눈에.",
    icon: "📱",
  },
];

export function BongsimTrustSection() {
  return (
    <section
      className="rounded-3xl border border-slate-200/90 bg-white px-4 py-8 shadow-sm ring-1 ring-slate-100/70 sm:px-6 lg:px-10 lg:py-10"
      aria-label="Bong투어 eSIM 특장점"
    >
      <div className="flex flex-col gap-1 lg:flex-row lg:items-end lg:justify-between lg:gap-6">
        <div>
          <h2 className="text-base font-bold text-slate-900 lg:text-lg">왜 Bong투어 eSIM일까요?</h2>
          <p className="mt-1 text-[12px] leading-relaxed text-slate-600 sm:text-[13px]">
            연결은 기술이지만, 안심은 마음입니다.
          </p>
        </div>
      </div>
      <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 lg:mt-8 lg:grid-cols-4 lg:gap-5">
        {TRUST.map((t) => (
          <div
            key={t.title}
            className="flex flex-col rounded-2xl border border-slate-100 bg-slate-50/80 p-4 shadow-sm ring-1 ring-slate-100/60 sm:p-4 lg:min-h-[9.5rem] lg:p-5"
          >
            <span className="text-xl sm:text-2xl" aria-hidden>
              {t.icon}
            </span>
            <p className="mt-3 text-[12px] font-bold leading-snug text-slate-900 sm:text-[13px]">{t.title}</p>
            <p className="mt-1.5 flex-1 text-[11px] leading-relaxed text-slate-600 sm:text-[11px] lg:text-[12px]">{t.sub}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
