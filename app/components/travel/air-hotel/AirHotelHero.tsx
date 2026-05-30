import SafeImage from '@/app/components/SafeImage'

type Props = {
  heroImageUrl: string | null
}

export default function AirHotelHero({ heroImageUrl }: Props) {
  return (
    <section className="relative border-b border-bt-border">
      <div className="relative w-full overflow-hidden min-h-[min(280px,46vh)] sm:min-h-[min(340px,50vh)]">
        {heroImageUrl ? (
          <SafeImage
            src={heroImageUrl}
            alt="항공+호텔 자유여행"
            fill
            sizes="100vw"
            className="object-cover"
            priority
          />
        ) : (
          <div className="absolute inset-0 bg-bt-surface-soft" aria-hidden />
        )}
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-black/30 to-transparent"
          aria-hidden
        />
        <div className="absolute inset-0 flex flex-col justify-end p-6 sm:p-10">
          <h1 className="text-2xl font-bold text-bt-bg drop-shadow-md sm:text-4xl">항공+호텔 (자유여행)</h1>
          <p className="mt-2 text-sm text-bt-bg/90 drop-shadow sm:text-base">
            등록된 항공권+호텔(자유여행) 상품입니다. 세부는 상담에서 확인해 주세요.
          </p>
        </div>
      </div>
    </section>
  )
}
