/**
 * 국외연수 부가 메타 — DB 마이그레이션 없이 Product.summary JSON SSOT.
 * (목록 카드는 summary 미사용)
 */

export type TrainingHeroImageSlot = {
  url: string
  /** 사진 우하단 출처 (필수 권장) */
  credit: string
  isGenerated?: boolean
}

export type TrainingProgramMetaJson = {
  airline?: string | null
  heroGallery?: TrainingHeroImageSlot[]
  /** 관리자용: 마지막 자동 생성 이미지 프롬프트 */
  imagePromptDraft?: string | null
}

export function parseTrainingProgramMetaJson(summary: string | null | undefined): TrainingProgramMetaJson {
  const raw = summary?.trim()
  if (!raw || !raw.startsWith('{')) return {}
  try {
    const o = JSON.parse(raw) as Record<string, unknown>
    const airline = typeof o.airline === 'string' ? o.airline.trim() : null
    const imagePromptDraft =
      typeof o.imagePromptDraft === 'string' ? o.imagePromptDraft.trim() : null
    const heroGallery: TrainingHeroImageSlot[] = []
    if (Array.isArray(o.heroGallery)) {
      for (const item of o.heroGallery) {
        if (!item || typeof item !== 'object') continue
        const rec = item as Record<string, unknown>
        const url = typeof rec.url === 'string' ? rec.url.trim() : ''
        if (!url) continue
        heroGallery.push({
          url,
          credit: typeof rec.credit === 'string' ? rec.credit.trim() : '',
          isGenerated: rec.isGenerated === true,
        })
      }
    }
    return {
      airline: airline || null,
      heroGallery: heroGallery.length > 0 ? heroGallery.slice(0, 4) : undefined,
      imagePromptDraft: imagePromptDraft || null,
    }
  } catch {
    return {}
  }
}

export function serializeTrainingProgramMetaJson(meta: TrainingProgramMetaJson): string | null {
  const airline = meta.airline?.trim()
  const gallery = (meta.heroGallery ?? []).filter((g) => g.url?.trim()).slice(0, 4)
  const imagePromptDraft = meta.imagePromptDraft?.trim()
  if (!airline && gallery.length === 0 && !imagePromptDraft) return null
  return JSON.stringify({
    ...(airline ? { airline } : {}),
    ...(gallery.length > 0 ? { heroGallery: gallery } : {}),
    ...(imagePromptDraft ? { imagePromptDraft } : {}),
  })
}

export function mergeTrainingHeroWithLegacy(
  meta: TrainingProgramMetaJson,
  legacy: {
    bgImageUrl: string | null
    bgImageIsGenerated?: boolean
    bgImageSource?: string | null
    bgImagePhotographer?: string | null
  }
): TrainingHeroImageSlot[] {
  const fromMeta = meta.heroGallery ?? []
  if (fromMeta.length > 0) return fromMeta.slice(0, 4)
  const url = legacy.bgImageUrl?.trim()
  if (!url) return []
  const credit =
    legacy.bgImageIsGenerated
      ? 'AI 생성 참고 이미지'
      : legacy.bgImagePhotographer?.trim()
        ? `${legacy.bgImagePhotographer}${legacy.bgImageSource ? ` · ${legacy.bgImageSource}` : ''}`
        : legacy.bgImageSource?.trim() || ''
  return [{ url, credit, isGenerated: legacy.bgImageIsGenerated }]
}
