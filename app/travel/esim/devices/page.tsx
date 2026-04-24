import Link from "next/link";
import Header from "@/app/components/Header";
import OverseasTravelSubMainNav from "@/app/components/travel/overseas/OverseasTravelSubMainNav";
import { bongsimPath } from "@/lib/bongsim/constants";

export default function EsimDevicesPage() {
  return (
    <div className="min-h-screen bg-bt-page">
      <Header />
      <OverseasTravelSubMainNav variant="links" />
      <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <h1 className="text-xl font-bold text-slate-900">사용 가능 기기</h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          기기 호환 안내 페이지는 준비 중입니다. 곧 상세 내용을 제공할 예정입니다.
        </p>
        <Link href={bongsimPath()} className="mt-6 inline-block text-sm font-semibold text-teal-700 hover:underline">
          ← eSIM 홈으로
        </Link>
      </main>
    </div>
  );
}
