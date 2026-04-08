import { MAIN_STRENGTH_STRIP_ITEMS } from '@/lib/main-hub-copy'

export default function HomeStrengthsStrip() {
  return (
    <section
      className="border-b border-bt-border bg-bt-page py-8 sm:py-9"
      aria-label="Bong투어 핵심 역량"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <ul className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between sm:gap-8">
          {MAIN_STRENGTH_STRIP_ITEMS.map((item) => (
            <li key={item.label} className="flex min-w-0 flex-1 gap-3 border-l-2 border-bt-accent/35 pl-4">
              <div>
                <p className="text-sm font-semibold text-bt-ink">{item.label}</p>
                <p className="mt-0.5 text-xs text-bt-muted">{item.sub}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
