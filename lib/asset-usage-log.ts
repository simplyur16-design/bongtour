import { prisma } from '@/lib/prisma'

export type AssetUsageInput = {
  assetId?: string | null
  assetPath?: string | null
  productId: string
  day: number
  selectionMode: string
  sourceType: string
  actorType: 'admin' | 'system'
  actorId?: string | null
  notes?: string | null
}

export function normalizeSelectionMode(mode: string | null | undefined, sourceType: string | null | undefined): string {
  const m = String(mode ?? '').trim().toLowerCase()
  const s = String(sourceType ?? '').trim().toLowerCase()
  if (m === 'library-reuse') return 'library-reuse'
  if (m === 'manual-upload') return 'manual-upload'
  if (m === 'auto' || m === 'auto-revert') return m
  if (m === 'manual-pick' && s === 'pexels') return 'pexels-pick'
  if (m === 'manual-pick' && s === 'gemini') return 'gemini-pick'
  return m || 'manual-pick'
}

export async function recordAssetUsage(input: AssetUsageInput) {
  const day = Number(input.day)
  if (!Number.isInteger(day) || day < 1) return
  await prisma.assetUsageLog.create({
    data: {
      assetId: input.assetId ?? null,
      assetPath: input.assetPath ?? null,
      productId: input.productId,
      day,
      selectionMode: normalizeSelectionMode(input.selectionMode, input.sourceType),
      sourceType: String(input.sourceType || 'unknown').trim().slice(0, 64),
      actorType: input.actorType,
      actorId: input.actorId ?? null,
      notes: input.notes ?? null,
    },
  })
}
