import Link from "next/link";
import { ESIM_INSTALL_GUIDE_PATH, ESIM_TRAVELER_AUTH_PATH } from "@/lib/bongsim/esim-install-guide";

export function EsimInstallGuideLinks({
  className = "",
  includeAuth = false,
}: {
  className?: string;
  includeAuth?: boolean;
}) {
  return (
    <nav aria-label="eSIM 설치 방법" className={className}>
      <Link href={ESIM_INSTALL_GUIDE_PATH} className="font-semibold text-teal-800 underline-offset-2 hover:underline">
        eSIM 설치 안내
      </Link>
      {includeAuth ? (
        <>
          <span className="mx-2 text-slate-300" aria-hidden>
            ·
          </span>
          <Link href={ESIM_TRAVELER_AUTH_PATH} className="font-semibold text-teal-800 underline-offset-2 hover:underline">
            여행자 인증
          </Link>
        </>
      ) : null}
    </nav>
  );
}
