const REFERENCE_DISCLAIMER =
  '본 정보는 참고용이며, 현지 사정에 따라 변경될 수 있음.'

type Props = {
  destinationName: string
}

/**
 * 구글 지도 위젯. 여행지명으로 검색해 임베드. API 키 없으면 링크만 표시.
 */
export default function DestinationMap({ destinationName }: Props) {
  const query = encodeURIComponent(destinationName.trim() || '여행지')
  const embedKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY
  const embedSrc = embedKey
    ? `https://www.google.com/maps/embed/v1/place?key=${embedKey}&q=${query}`
    : null
  const searchUrl = `https://www.google.com/maps/search/?api=1&query=${query}`

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
      <h2 className="text-lg font-bold text-gray-900">여행지 위치</h2>
      <p className="mt-1 text-sm text-gray-600">
        {destinationName.trim() || '여행지'} 주변 안내
      </p>
      {embedSrc ? (
        <div className="mt-4 aspect-video w-full overflow-hidden rounded-lg border border-gray-200">
          <iframe
            title={`${destinationName} 지도`}
            src={embedSrc}
            width="100%"
            height="100%"
            className="h-full w-full"
            allowFullScreen
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      ) : (
        <a
          href={searchUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 flex aspect-video w-full items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50 text-sm font-medium text-bong-orange hover:bg-gray-100"
        >
          구글 지도에서 &quot;{destinationName.trim() || '여행지'}&quot; 보기
        </a>
      )}
      <p className="mt-3 text-center text-xs text-gray-600">
        {REFERENCE_DISCLAIMER}
      </p>
    </section>
  )
}
