import SafeImage from '@/app/components/SafeImage'
import PexelsSourceCaption from './PexelsSourceCaption'

const REFERENCE_DISCLAIMER =
  '본 정보는 참고용이며, 현지 사정에 따라 변경될 수 있음.'

type Props = {
  destinationName: string
  imageUrl: string | null
}

/**
 * 상품 상세 상단: 여행지 대표 이미지 또는 플레이스홀더. 이미지 하단에 면피 문구 고정.
 * Pexels 소스 이미지 시 우측 하단에 Source: Pexels 표기.
 */
export default function DestinationHero({ destinationName, imageUrl }: Props) {
  const displayName = destinationName?.trim() || '여행지'

  return (
    <section className="overflow-hidden border border-gray-200 bg-white">
      <div className="relative aspect-[21/9] w-full bg-gradient-to-br from-amber-100 to-orange-50">
        {imageUrl ? (
          <PexelsSourceCaption className="absolute inset-0 h-full w-full" showCaption>
            <SafeImage
              src={imageUrl}
              alt={displayName}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 960px"
              loading="lazy"
            />
          </PexelsSourceCaption>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center">
            <p className="text-lg font-bold text-[#0f172a]">
              [여행지: {displayName}]
            </p>
            <p className="text-sm text-gray-500">대표 이미지 준비 중</p>
          </div>
        )}
      </div>
      <p className="border-t border-gray-100 bg-gray-50 px-4 py-2 text-center text-xs text-gray-600">
        {REFERENCE_DISCLAIMER}
      </p>
    </section>
  )
}
