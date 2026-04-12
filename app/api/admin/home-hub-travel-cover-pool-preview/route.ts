import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'
import { pickHomeHubTravelCardCover } from '@/lib/home-hub-travel-card-cover'

/**
 * 관리자 미리보기용: 메인과 동일 `pickHomeHubTravelCardCover` 로 해외/국내 각 1장 무작위.
 * JSON을 바꾸지 않으며, 클라이언트에서 “다시 뽑기” 시에만 호출한다.
 */
export async function GET() {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ ok: false, error: '인증이 필요합니다.' }, { status: 401 })
  }

  try {
    const overseas = await pickHomeHubTravelCardCover('overseas')
    const domestic = await pickHomeHubTravelCardCover('domestic')
    return NextResponse.json({
      ok: true,
      overseas: overseas?.imageSrc ?? null,
      domestic: domestic?.imageSrc ?? null,
    })
  } catch (e) {
    console.error('[home-hub-travel-cover-pool-preview]', e)
    return NextResponse.json({ ok: false, error: '상품 풀 미리보기를 불러오지 못했습니다.' }, { status: 500 })
  }
}
