import HomePageLoading from "@/components/route-loading/HomePageLoading";

/** simplyur는 `app/simplyur/loading.tsx` — 루트는 surface header 없이 홈 로딩만 (ISR 유지) */
export default function Loading() {
  return <HomePageLoading />;
}
