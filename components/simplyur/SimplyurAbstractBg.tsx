/** Abstract wave lines — light hero only (no white strokes). */
export function SimplyurAbstractBg() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <svg
        className="absolute -left-[10%] top-[8%] h-[55%] w-[120%] opacity-[0.14]"
        viewBox="0 0 1200 400"
        fill="none"
        preserveAspectRatio="none"
      >
        <path
          d="M0 220 C180 120 320 320 520 200 S880 80 1200 180"
          stroke="#0B1B44"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="M0 280 C200 180 400 340 620 240 S920 140 1200 240"
          stroke="#E8654F"
          strokeWidth="1.5"
          strokeLinecap="round"
          opacity="0.85"
        />
      </svg>
    </div>
  );
}
