import { handleParseAndRegisterVerygoodtourRequest } from '@/lib/parse-and-register-verygoodtour-handler'

export const maxDuration = 300
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  return handleParseAndRegisterVerygoodtourRequest(request)
}
