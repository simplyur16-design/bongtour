"use client";

import { useEffect, useState } from "react";

/**
 * Bong투어 브랜드 스플래시 화면.
 *
 * 타이밍 (총 2.0초):
 *   0.00 ~ 0.88s  "Simply your" 11자 타이핑 (80ms/char)
 *   0.88 ~ 1.28s  "Bongtour" 8자 타이핑 (50ms/char)
 *   1.28 ~ 1.73s  로딩 점 3개 순차 (150ms/dot)
 *   1.73 ~ 2.00s  페이드아웃
 *
 * 세션당 1회만 노출 (sessionStorage). 재방문자/같은 탭 이동 시 즉시 스킵.
 *
 * 배경: Bong투어 오렌지 그라데이션 (이미지 없음 → 로딩 0ms 보장).
 * 나중에 배경 이미지 추가하고 싶으면 <div className="bg-gradient-..."> 자리에
 * <Image priority src="..." /> 를 absolute로 얹으면 됨.
 */

const LINE1 = "Simply your";
const LINE2 = "Bongtour";

// 단계별 지속시간 (ms) — 합계 2000ms 맞춤
const L1_CHAR_MS = 80;
const L2_CHAR_MS = 50;
const DOT_STEP_MS = 150;
const FADE_MS = 270;

const L1_DUR = LINE1.length * L1_CHAR_MS; // 880
const L2_START = L1_DUR;                  // 880
const L2_DUR = LINE2.length * L2_CHAR_MS; // 400
const DOTS_START = L2_START + L2_DUR;     // 1280
const DOTS_DUR = 3 * DOT_STEP_MS;         // 450
const FADE_START = DOTS_START + DOTS_DUR; // 1730
const TOTAL = FADE_START + FADE_MS;       // 2000

const SESSION_KEY = "bt-splash-seen-v1";

export function BongtourSplash() {
  // 초기 상태: sessionStorage 체크 전까지 null → hydration mismatch 방지
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(true);
  const [fading, setFading] = useState(false);
  const [typed1, setTyped1] = useState("");
  const [typed2, setTyped2] = useState("");
  const [dots, setDots] = useState(0); // 0 ~ 3

  useEffect(() => {
    setMounted(true);
    try {
      if (typeof window !== "undefined" && window.sessionStorage.getItem(SESSION_KEY)) {
        setVisible(false);
        return;
      }
    } catch {
      /* private mode 등에서 sessionStorage 접근 실패 — 그냥 매번 노출 */
    }

    const timers: ReturnType<typeof setTimeout>[] = [];

    /* Line 1 타이핑 */
    for (let i = 1; i <= LINE1.length; i++) {
      timers.push(setTimeout(() => setTyped1(LINE1.slice(0, i)), i * L1_CHAR_MS));
    }

    /* Line 2 타이핑 */
    for (let i = 1; i <= LINE2.length; i++) {
      timers.push(setTimeout(() => setTyped2(LINE2.slice(0, i)), L2_START + i * L2_CHAR_MS));
    }

    /* 로딩 점 */
    for (let i = 1; i <= 3; i++) {
      timers.push(setTimeout(() => setDots(i), DOTS_START + i * DOT_STEP_MS));
    }

    /* 페이드 시작 */
    timers.push(setTimeout(() => setFading(true), FADE_START));

    /* 최종 제거 + 세션 플래그 기록 */
    timers.push(
      setTimeout(() => {
        setVisible(false);
        try {
          window.sessionStorage.setItem(SESSION_KEY, "1");
        } catch {
          /* ignore */
        }
      }, TOTAL),
    );

    return () => {
      timers.forEach(clearTimeout);
    };
  }, []);

  // SSR에선 아무 것도 렌더하지 않음 (첫 페인트 직후 JS에서 결정)
  if (!mounted) return null;
  if (!visible) return null;

  return (
    <div
      aria-hidden
      className={`fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden transition-opacity duration-[270ms] ease-out ${
        fading ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
      style={{
        // Tailwind 클래스 대신 인라인으로 깔끔한 오렌지 그라데이션 구성.
        // Bong투어 브랜드 오렌지 #F59E0B → #F97316 → #EA580C 느낌.
        background:
          "radial-gradient(1200px 700px at 80% 20%, rgba(255, 220, 160, 0.55) 0%, rgba(255, 220, 160, 0) 60%), linear-gradient(135deg, #FBBF24 0%, #F59E0B 35%, #F97316 75%, #EA580C 100%)",
      }}
    >
      {/* 가운데 살짝 위쪽에 텍스트 정렬 (모두투어 스타일 참고) */}
      <div className="flex flex-col items-start gap-1 px-8 -translate-y-[6vh] sm:-translate-y-[8vh]">
        <h1
          className="text-[clamp(1.75rem,7vw,3rem)] font-extrabold leading-[1.05] tracking-tight text-white"
          style={{ letterSpacing: "-0.01em" }}
        >
          <span className="inline-block min-h-[1em] min-w-[1ch]">{typed1}</span>
          <span
            className={`ml-0.5 inline-block w-[0.12em] align-[-0.05em] bg-white ${
              typed1.length < LINE1.length ? "animate-pulse" : "opacity-0"
            }`}
            style={{ height: "0.95em" }}
            aria-hidden
          />
        </h1>
        <h2
          className="mt-2 text-[clamp(2.25rem,10vw,4.25rem)] font-black leading-none tracking-tight"
          style={{ color: "#FEF3C7", letterSpacing: "-0.02em" }}
        >
          <span className="inline-block min-h-[1em] min-w-[1ch]">{typed2}</span>
          <span
            className={`ml-0.5 inline-block w-[0.12em] align-[-0.05em] bg-amber-100 ${
              typed2.length < LINE2.length && typed1.length === LINE1.length ? "animate-pulse" : "opacity-0"
            }`}
            style={{ height: "0.95em" }}
            aria-hidden
          />
        </h2>

        {/* 로딩 점 */}
        <div
          className="mt-6 flex gap-1.5 text-white/90 text-lg font-bold leading-none"
          aria-hidden
          style={{ minHeight: "1em" }}
        >
          <span className={dots >= 1 ? "opacity-100 transition-opacity duration-150" : "opacity-0"}>•</span>
          <span className={dots >= 2 ? "opacity-100 transition-opacity duration-150" : "opacity-0"}>•</span>
          <span className={dots >= 3 ? "opacity-100 transition-opacity duration-150" : "opacity-0"}>•</span>
        </div>
      </div>
    </div>
  );
}
