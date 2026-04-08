type Chip = { label: string; href: string }

/** 2차 분기 앵커 — 1차 스캐폴딩(추후 필터/탭과 연결) */
export default function TravelExploreChips({ chips }: { chips: readonly Chip[] }) {
  return (
    <nav
      className="mx-auto max-w-6xl px-4 sm:px-6"
      aria-label="빠른 분기"
    >
      <ul className="flex flex-wrap gap-2 py-6 sm:gap-3">
        {chips.map((c) => (
          <li key={c.label}>
            <a
              href={c.href}
              className="inline-flex rounded-lg border border-bt-border bg-bt-page px-3 py-2 text-xs font-medium text-bt-ink transition hover:border-bt-accent/40 hover:bg-bt-accent-subtle sm:text-sm"
            >
              {c.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
