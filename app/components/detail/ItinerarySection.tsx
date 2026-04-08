import { DISCLAIMER_ITINERARY } from '../../data/productDetail'
import type { ItineraryDay } from '../../data/productDetail'

type Props = { days: ItineraryDay[] }

export default function ItinerarySection({ days }: Props) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="text-lg font-bold text-gray-900">일정</h2>
      <ul className="mt-6 space-y-6">
        {days.map((d) => (
          <li key={d.day} className="border-l-2 border-bong-orange/40 pl-4">
            <p className="font-semibold text-gray-900">Day {d.day}. {d.title}</p>
            <ul className="mt-2 space-y-1 text-sm text-gray-700">
              {d.items.map((item, i) => (
                <li key={i}>· {item}</li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
      <p className="mt-6 border-t border-gray-200 pt-4 text-sm font-medium text-red-600">
        {DISCLAIMER_ITINERARY}
      </p>
      <p className="mt-2 text-center text-xs text-gray-600">
        본 정보는 참고용이며, 현지 사정에 따라 변경될 수 있음.
      </p>
    </section>
  )
}
