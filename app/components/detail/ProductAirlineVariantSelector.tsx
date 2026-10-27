import Link from 'next/link'
import { loadAirlineVariantOptionsForProduct } from '@/lib/airline-variant-siblings'
import { airlineVariantOptionText } from '@/lib/airline-variant-group'

/**
 * 상품 상세 — 같은 상품의 항공사·출발일 변형 선택 (형제 2개 이상일 때만).
 * REGRESSION-FREEZE[airline-variant-group]: 상세 항공사 선택 — manifest
 */
export default async function ProductAirlineVariantSelector({ productId }: { productId: string }) {
  let options: Awaited<ReturnType<typeof loadAirlineVariantOptionsForProduct>> = []
  try {
    options = await loadAirlineVariantOptionsForProduct(productId)
  } catch {
    options = []
  }
  if (options.length < 2) return null
  return (
    <nav aria-label="항공사 선택" className="mx-auto w-full max-w-6xl px-4 pt-3" data-airline-variant-selector>
      <p className="text-xs font-semibold text-slate-600">항공사·출발일 선택</p>
      <ul className="mt-1.5 flex flex-wrap gap-2">
        {options.map((o) => {
          const current = o.productId === productId
          return (
            <li key={o.productId}>
              <Link
                href={`/products/${o.slug?.trim() || o.productId}`}
                aria-current={current ? 'page' : undefined}
                prefetch={false}
                className={
                  current
                    ? 'inline-block rounded-full border border-teal-600 bg-teal-600 px-3 py-1 text-xs font-medium text-white'
                    : 'inline-block rounded-full border border-slate-300 bg-white px-3 py-1 text-xs text-slate-700 hover:border-teal-500 hover:text-teal-700'
                }
              >
                {airlineVariantOptionText(o)}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
