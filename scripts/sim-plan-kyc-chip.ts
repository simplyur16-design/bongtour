/**
 * PlanCard KYC chip SSOT 시뮬 (read-only)
 * Usage: npx tsx scripts/sim-plan-kyc-chip.ts
 */
import { config } from 'dotenv'
config({ path: '.env.local' })
config({ path: '.env' })

import {
  getKycLabelDistribution,
  shouldShowBadge,
} from '../lib/bongsim/esim/kyc-required'
import type { ProductOption } from '../lib/bongsim/recommend/product-option'

const CASES = [
  { label: '일본 5일', q: 'country=jp&days=5' },
  { label: '베트남 5일', q: 'country=vn&days=5' },
  { label: '중국 단독 5일', q: 'country=cn&days=5' },
  { label: '대만 3일', q: 'country=tw&days=3' },
  { label: '홍콩+마카오 8일', q: 'country=hk&days=8&codes=hk,mo' },
]

async function main() {
  const base = process.env.SIM_BASE_URL ?? 'http://localhost:3000'
  for (const c of CASES) {
    const res = await fetch(`${base}/api/bongsim/products/plans?${c.q}`)
    if (!res.ok) {
      console.log(`\n=== ${c.label} === HTTP ${res.status}`)
      continue
    }
    const json = (await res.json()) as {
      kyc_distribution?: string
      groups?: { unlimited?: ProductOption[]; daily?: ProductOption[]; fixed?: ProductOption[] }
    }
    const dist = getKycLabelDistribution([
      ...(json.groups?.unlimited ?? []),
      ...(json.groups?.daily ?? []),
      ...(json.groups?.fixed ?? []),
    ])
    const sample = [
      ...(json.groups?.unlimited ?? []).slice(0, 2),
      ...(json.groups?.daily ?? []).slice(0, 2),
    ]
    const badges = sample.map((p) => shouldShowBadge(p, dist))
    const anyChip = badges.some((b) => b != null)
    console.log(`\n=== ${c.label} ===`)
    console.log(`  distribution=${dist} | sample chips=${badges.join(',') || '(none)'}`)
    console.log(`  anyChip=${anyChip ? 'O' : 'X'} (expect ${dist === 'binary' ? 'O' : 'X'})`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
