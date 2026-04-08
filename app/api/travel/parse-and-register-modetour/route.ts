import { handleParseAndRegisterModetourRequest } from '@/lib/parse-and-register-modetour-handler'

/** 풀 등록·일정 보강 Gemini 호출이 길어질 수 있음 — 호스팅 한도 내에서 상한 확장 */
export const maxDuration = 300
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  return handleParseAndRegisterModetourRequest(request)
}
