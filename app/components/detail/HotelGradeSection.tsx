import type { PlannedHotel } from '../../data/productDetail'

type Props = { hotels: PlannedHotel[] }

export default function HotelGradeSection({ hotels }: Props) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="text-lg font-bold text-gray-900">숙박 시설 등급 안내</h2>
      <p className="mt-2 text-sm text-gray-700">
        본사 지정 5성급 예정 (호텔명은 출발 전 확정 시점에 안내됩니다).
      </p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[280px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-3 py-2.5 text-left font-semibold text-gray-700">박</th>
              <th className="px-3 py-2.5 text-left font-semibold text-gray-700">지역</th>
              <th className="px-3 py-2.5 text-left font-semibold text-gray-700">등급</th>
              <th className="px-3 py-2.5 text-left font-semibold text-gray-700">비고</th>
            </tr>
          </thead>
          <tbody>
            {hotels.map((row, i) => (
              <tr key={i} className="border-b border-gray-100">
                <td className="px-3 py-2.5 text-gray-800">{row.night}</td>
                <td className="px-3 py-2.5 text-gray-800">{row.area}</td>
                <td className="px-3 py-2.5 text-gray-800">{row.grade}</td>
                <td className="px-3 py-2.5 text-gray-600">{row.note ?? '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-sm font-medium text-red-600">
        현지 사정에 따른 동급 변경 가능성이 있습니다. 출발 2~3일 전 확정 및 동급 변경 가능함.
      </p>
    </section>
  )
}
