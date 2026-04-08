/**
 * 폐기: 관리자 상품등록은 네 공급사 전용 API만 사용.
 * - modetour → `/api/travel/parse-and-register-modetour`
 * - verygoodtour → `…-verygoodtour`
 * - ybtour → `…-ybtour` (관리자 메뉴는 canonical `ybtour`만; 레거시 별도 URL은 비관리자 호환용)
 * - hanatour → `…-hanatour`
 */
import { NextResponse } from 'next/server'

export const maxDuration = 300
export const dynamic = 'force-dynamic'

export async function POST() {
  return NextResponse.json(
    {
      success: false,
      error:
        '이 엔드포인트는 사용하지 않습니다. 전용 등록 API(parse-and-register-modetour|verygoodtour|ybtour|hanatour)를 호출하세요.',
    },
    { status: 410 }
  )
}
