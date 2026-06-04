"use client";

import { useEffect, useState } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** 배경 클릭 시 닫기 (기본 false) */
  closeOnBackdrop?: boolean;
  /** 다이얼로그 패널 너비 (Tailwind max-w-*). 기본 max-w-md */
  maxWidthClassName?: string;
  /** 모바일 패널 위치. 기본 bottom(하단 시트), center는 화면 중앙 */
  mobilePlacement?: "bottom" | "center";
};

export function RecommendModalShell({
  open,
  onClose,
  children,
  closeOnBackdrop = false,
  maxWidthClassName = "max-w-md",
  mobilePlacement = "bottom",
}: Props) {
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    if (!open) {
      setEntered(false);
      return;
    }
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, [open]);

  if (!open) return null;

  const centeredOnMobile = mobilePlacement === "center";

  return (
    <div
      className={
        centeredOnMobile
          ? "fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
          : "fixed inset-0 z-[100] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      }
      role="presentation"
      onClick={closeOnBackdrop ? onClose : undefined}
    >
      <div
        role="dialog"
        aria-modal="true"
        className={`bt-bongsim-readable max-h-[92vh] w-full ${maxWidthClassName} overflow-hidden bg-white text-slate-900 shadow-2xl transition-all duration-300 ease-out ${
          centeredOnMobile
            ? "rounded-2xl"
            : "rounded-t-2xl sm:rounded-2xl"
        } ${
          entered
            ? "translate-y-0 opacity-100"
            : centeredOnMobile
              ? "scale-[0.97] opacity-0"
              : "translate-y-6 opacity-0"
        } ${entered && centeredOnMobile ? "scale-100" : ""}`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
