import { NextResponse } from 'next/server'

import { normalizeBrandKeyToCanonicalSupplierKey } from '@/lib/overseas-supplier-canonical-keys'
import type { CanonicalOverseasSupplierKey } from '@/lib/overseas-supplier-canonical-keys'
import { requireAdmin } from '@/lib/require-admin'
import {
  collectSupplierRegisterFacts,
  registerFactsSupportedSuppliers,
} from '@/lib/register-facts/collect'
import type { SupplierRegisterFactBundle } from '@/lib/register-facts/types'

export type RegisterFetchFactsResponse =
  | { ok: true; bundle: SupplierRegisterFactBundle; supported: CanonicalOverseasSupplierKey[] }
  | { ok: false; error: string; supported?: CanonicalOverseasSupplierKey[] }

/**
 * POST /api/admin/register/fetch-facts
 * REGRESSION-FREEZE[register-facts-foundation]: admin register fact prefetch — manifest
 */
export async function POST(request: Request) {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ ok: false, error: '인증이 필요합니다.' } satisfies RegisterFetchFactsResponse, {
      status: 401,
    })
  }

  try {
    const body = (await request.json()) as Record<string, unknown>
    const originUrl = String(body.originUrl ?? '').trim()
    const brandKey = normalizeBrandKeyToCanonicalSupplierKey(String(body.brandKey ?? ''))
    const originCode = typeof body.originCode === 'string' ? body.originCode.trim() : null

    if (!originUrl) {
      return NextResponse.json({ ok: false, error: 'originUrl이 필요합니다.' } satisfies RegisterFetchFactsResponse, {
        status: 400,
      })
    }

    const supported = registerFactsSupportedSuppliers()
    if (!brandKey || !supported.includes(brandKey)) {
      return NextResponse.json(
        {
          ok: false,
          error: '이 공급사는 아직 사실 가져오기를 지원하지 않습니다.',
          supported,
        } satisfies RegisterFetchFactsResponse,
        { status: 400 },
      )
    }

    const bundle = await collectSupplierRegisterFacts(brandKey, originUrl, {
      originCode,
    })
    if (!bundle) {
      return NextResponse.json(
        { ok: false, error: 'URL에서 사실을 가져오지 못했습니다.', supported } satisfies RegisterFetchFactsResponse,
        { status: 422 },
      )
    }

    return NextResponse.json({ ok: true, bundle, supported } satisfies RegisterFetchFactsResponse)
  } catch (err) {
    console.error('[register/fetch-facts]', err)
    return NextResponse.json({ ok: false, error: '처리 중 오류가 발생했습니다.' } satisfies RegisterFetchFactsResponse, {
      status: 500,
    })
  }
}
