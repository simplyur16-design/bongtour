"use client";

import { useCallback, useEffect, useId, useState } from "react";

const TEST_MODE_FLAG = (process.env.NEXT_PUBLIC_BONGSIM_CHECKOUT_TEST_MODE ?? "").trim().toLowerCase() === "true";

export function TestModeCompleteModal() {
  const titleId = useId();
  const [open, setOpen] = useState(TEST_MODE_FLAG);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  if (!TEST_MODE_FLAG || !open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="presentation">
      <button
        type="button"
        aria-label="닫기"
        className="absolute inset-0 bg-black/50"
        onClick={close}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-[101] w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
      >
        <h2 id={titleId} className="text-lg font-semibold text-slate-900">
          결제가 완료되었습니다
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">현재는 테스트중입니다</p>
        <button
          type="button"
          onClick={close}
          className="mt-6 w-full rounded-xl bg-teal-700 px-4 py-3 text-center text-sm font-semibold text-white hover:bg-teal-800"
        >
          확인
        </button>
      </div>
    </div>
  );
}
