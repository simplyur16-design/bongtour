import PexelsSourceCaption from './PexelsSourceCaption'

const GALLERY_DISCLAIMER =
  '본 이미지는 여행지의 이해를 돕기 위한 참고용 스톡 이미지입니다.'

type Props = {
  imageUrls: string[]
  destinationName?: string
}

/**
 * 메인 1장 크게 + 나머지 4장 작게. 5장 고화질 스톡 이미지 갤러리.
 * 각 이미지 우측 하단에 Source: Pexels 표기.
 */
export default function DestinationGallery({ imageUrls, destinationName }: Props) {
  const valid = imageUrls.filter(Boolean)
  if (valid.length === 0) return null

  const [main, ...rest] = imageUrls
  const restFour = rest.slice(0, 4)

  return (
    <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="grid grid-cols-2 gap-1.5 sm:gap-2 md:grid-cols-4">
        <div className="relative col-span-2 aspect-[21/9] w-full bg-gray-100 md:col-span-4">
          {main ? (
            <PexelsSourceCaption className="h-full w-full" showCaption>
              <img
                src={main}
                alt={destinationName ? `${destinationName} 대표` : '여행지'}
                className="h-full w-full object-cover"
                sizes="(max-width: 768px) 100vw, 800px"
              />
            </PexelsSourceCaption>
          ) : null}
        </div>
        {restFour.map((url, i) => (
          <div
            key={i}
            className="relative aspect-[4/3] w-full bg-gray-100"
          >
            {url ? (
              <PexelsSourceCaption className="h-full w-full" showCaption>
                <img
                  src={url}
                  alt={destinationName ? `${destinationName} ${i + 2}` : `갤러리 ${i + 2}`}
                  className="h-full w-full object-cover"
                  sizes="(max-width: 768px) 50vw, 25vw"
                />
              </PexelsSourceCaption>
            ) : null}
          </div>
        ))}
      </div>
      <p className="border-t border-gray-100 bg-gray-50 px-4 py-2.5 text-center text-xs text-gray-600">
        {GALLERY_DISCLAIMER}
      </p>
    </section>
  )
}
