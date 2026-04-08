/**
 * 노랑풍선(ybtour) 등록 API — HTTP 진입점 SSOT.
 * 레거시 별칭 URL: `parse-and-register-yellowballoon`(동일 핸들러, deprecated).
 */
import { handleParseAndRegisterYbtourRequest } from '@/lib/parse-and-register-ybtour-handler'

export const maxDuration = 300
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  console.log(
    '[ybtour] phase=register-api entry route=parse-and-register-ybtour forcedBrandKey=ybtour'
  )
  return handleParseAndRegisterYbtourRequest(request)
}
