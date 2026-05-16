import EsimTravelCrossSellBanner from '@/app/components/travel/EsimTravelCrossSellBanner'

export default function TravelLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <EsimTravelCrossSellBanner />
      {children}
    </>
  )
}
