import Link from "next/link";
import { ESIM_INSTALL_AUTH_PATH, ESIM_INSTALL_GENERAL_PATH } from "@/lib/bongsim/esim-install-guide";

export function EsimInstallGuideLinks({ className = "" }: { className?: string }) {
  return (
    <nav aria-label="eSIM 설치 방법" className={className}>
      <Link href={ESIM_INSTALL_AUTH_PATH} className="font-semibold text-teal-800 underline-offset-2 hover:underline">
        인증형 설치 안내
      </Link>
      <span className="mx-2 text-slate-300" aria-hidden>
        ·
      </span>
      <Link href={ESIM_INSTALL_GENERAL_PATH} className="font-semibold text-teal-800 underline-offset-2 hover:underline">
        일반형 설치 안내
      </Link>
    </nav>
  );
}
