/**
 * 허브 카드용 이미지 미정 placeholder (시각만; 스크린리더는 링크 `aria-label`에 본문 포함).
 *
 * TODO(운영): 카드별 대표 사진은 관리자 `/admin/home-hub-card-images` 및
 * `public/data/home-hub-active.json` 의 `images` / `mobileMainServiceTiles` 로 교체하면
 * 메인·모바일 카드가 자동 반영된다.
 */
export default function HomeHubPhotoPlaceholder() {
  return (
    <div
      className="pointer-events-none absolute inset-0 z-[1] flex flex-col items-center justify-center bg-[#1F1B2D]"
      aria-hidden
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={44}
        height={44}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.35}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-white/45"
      >
        <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
        <circle cx="12" cy="13" r="3" />
      </svg>
      <span className="mt-3 text-[10px] font-bold uppercase tracking-[0.22em] text-white/50">IMAGE PENDING</span>
    </div>
  )
}
