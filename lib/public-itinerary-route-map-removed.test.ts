import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

function src(path: string) {
  return readFileSync(path, 'utf8')
}

describe('공개 상세 동선지도 제거', () => {
  it('데스크톱·모바일 상세가 쓰는 일정 본문에 동선지도 칸이 없다', () => {
    const view = src('components/itinerary/ItineraryViewPackageMain.tsx')
    expect(view).not.toContain('ProductRouteMapSection')
    expect(view).not.toContain('itineraryRouteMapUrl')
    expect(view).not.toContain('>동선지도<')
    const model = src('lib/product-public-detail/build-render-model.ts')
    const types = src('app/components/travel/travel-product-detail-types.ts')
    const extras = src('lib/public-product-extras.ts')
    expect(model).not.toContain('itineraryRouteMap')
    expect(types).not.toContain('itineraryRouteMap')
    expect(extras).not.toContain('itineraryRouteMap')
  })

  it('이미지 처리·등록 확인·등록 전환이 일정 동선 지도를 자동 생성하지 않는다', () => {
    const images = src('app/api/travel/process-images/route.ts')
    const confirm = src('lib/register-confirm-after-save.ts')
    const admin = src('app/api/admin/products/[id]/route.ts')
    expect(images).not.toContain('ensureItineraryRouteMapForProduct')
    expect(images).not.toContain('runItineraryRouteMapAfterImages')
    expect(confirm).not.toContain('scheduleItineraryRouteMapGeneration')
    expect(admin).not.toContain('scheduleItineraryRouteMapGeneration')
    expect(confirm).toContain('ensureBongtourRouteMapPersisted')
    expect(existsSync('lib/itinerary-route-map-ensure.ts')).toBe(false)
    expect(existsSync('app/components/detail/ProductRouteMapSection.tsx')).toBe(false)
    expect(existsSync('app/api/admin/products/[id]/itinerary-route-map/route.ts')).toBe(false)
    expect(existsSync('scripts/generate-itinerary-route-maps.ts')).toBe(false)
    expect(existsSync('lib/itinerary-route-map-nominatim.ts')).toBe(false)
  })
})
