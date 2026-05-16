import TravelEsimCoralStripPc from '@/app/components/travel/TravelEsimCoralStripPc'

export default function TravelLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <TravelEsimCoralStripPc />
      {children}
    </>
  )
}
