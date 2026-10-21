import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'

describe('pending-open-self-heal-verify', () => {
  // REGRESSION-FREEZE[pending-open-self-heal-verify]: 통과가 목적 · 강등 금지 — manifest
  it('open-heal SSOT heals + remats and does not force-block', () => {
    const src = readFileSync(
      path.join(process.cwd(), 'lib/register-pre-photo-pending-open-heal.ts'),
      'utf8',
    )
    expect(src).toContain('healPendingRegisterPrePhoto')
    expect(src).toContain('rematerializeRegisterPrePhotoByLane')
    expect(src).toContain('ensurePendingNotBlocked')
    expect(src).toContain('REGRESSION-FREEZE[pending-open-self-heal-verify]')
    expect(src).not.toContain('registrationStatusAfterPrePhotoVerify')
    expect(src).toContain('강등이 아니라 통과')
  })

  it('admin route and pending panel wire open heal without demote copy', () => {
    const route = readFileSync(
      path.join(process.cwd(), 'app/api/admin/products/[id]/pre-photo-heal/route.ts'),
      'utf8',
    )
    const panel = readFileSync(
      path.join(process.cwd(), 'app/admin/pending/components/AdminPendingDetailPanel.tsx'),
      'utf8',
    )
    expect(route).toContain('healAndGatePendingProductForOperator')
    expect(panel).toContain('/pre-photo-heal')
    expect(panel).toContain('onQueueGateChanged')
    expect(panel).toContain('셀프힐 다시')
    expect(panel).not.toContain('등록대기에서 내림')
  })
})
