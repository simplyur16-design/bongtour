import ProductResultCardsClient from '@/app/components/home/ProductResultCardsClient'
import type { ResultItem } from '@/components/products/ProductResultsList'

type Props = {
  monthlyMessages: Record<string, string>
  monthlyProducts: Record<string, ResultItem[]>
}

function formatMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split('-')
  return `${year}년 ${parseInt(month, 10)}월`
}

export default function AirHotelSeasonGrid({ monthlyMessages, monthlyProducts }: Props) {
  const monthKeys = Object.keys(monthlyMessages).sort()

  return (
    <section className="border-b border-bt-border py-8 sm:py-12">
      <div className="mx-auto max-w-6xl space-y-12 px-4">
        {monthKeys.map((monthKey) => {
          const products = monthlyProducts[monthKey] ?? []
          const message = monthlyMessages[monthKey] ?? ''
          const monthLabel = formatMonthLabel(monthKey)

          if (products.length === 0) return null

          return (
            <div key={monthKey}>
              <h2 className="text-xl font-bold text-bt-ink sm:text-2xl">{monthLabel}</h2>
              {message ? (
                <p className="mb-4 mt-2 text-sm text-bt-subtle sm:text-base">{message}</p>
              ) : null}
              <ProductResultCardsClient items={products} layout="scroll" />
            </div>
          )
        })}
      </div>
    </section>
  )
}
