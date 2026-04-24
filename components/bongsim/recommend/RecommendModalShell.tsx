"use client";

import { useEffect, useState } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** 배경 클릭 시 닫기 (기본 false) */
  closeOnBackdrop?: boolean;
};

export function RecommendModalShell({
  open,
  onClose,
  children,
  closeOnBackdrop = false,
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

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      role="presentation"
      onClick={closeOnBackdrop ? onClose : undefined}
    >
      <div
        role="dialog"
        aria-modal="true"
        className={`max-h-[92vh] w-full max-w-md overflow-hidden rounded-t-2xl bg-white shadow-2xl transition-all duration-300 ease-out sm:rounded-2xl ${
          entered ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
