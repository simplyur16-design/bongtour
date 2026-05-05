import type { BongContentStatus } from '@prisma/client'

export const BONG_CONTENT_STATUSES: BongContentStatus[] = ['draft', 'approved', 'published']

export function parseContentStatus(raw: unknown): BongContentStatus | undefined {
  if (typeof raw !== 'string') return undefined
  return BONG_CONTENT_STATUSES.includes(raw as BongContentStatus) ? (raw as BongContentStatus) : undefined
}

export function parsePagination(searchParams: URLSearchParams): { page: number; limit: number; skip: number } {
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1)
  const limitRaw = parseInt(searchParams.get('limit') ?? '20', 10) || 20
  const limit = Math.min(100, Math.max(1, limitRaw))
  const skip = (page - 1) * limit
  return { page, limit, skip }
}

export async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json()
  } catch {
    return null
  }
}
