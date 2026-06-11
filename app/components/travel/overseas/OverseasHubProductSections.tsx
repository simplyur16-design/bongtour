'use client'

import { useMemo } from 'react'
import ProductHubSectionGallery from '@/components/products/ProductHubSectionGallery'
import type { ResultItem } from '@/components/products/ProductResultsList'
import { interleaveProductsBySupplier } from '@/lib/interleave-products-by-supplier'
import { koreanCountryLabelFromBrowseSlug } from '@/lib/location-url-slugs'
import {
  OVERSEAS_DISPLAY_BUCKET_LABEL,
  OVERSEAS_DISPLAY_BUCKET_ORDER,
  type OverseasDisplayBucketId,
} from '@/lib/overseas-display-buckets'
import {
  megaMenuSubgroupLabelsInOrder,
  resolveOverseasHubMegaSubgroupDisplayLabel,
} from '@/lib/overseas-mega-region-city-group'

export type OverseasHubDisplayMode = 'buckets' | 'megaSubgroups' | 'countryFlat' | 'focusedFlat'

type Props = {
  items: ResultItem[]
  formatWon: (n: number | null) => string
  seasonalPickIds?: ReadonlySet<string> | null
  hubGalleryRotationSeed: number
  mode: OverseasHubDisplayMode
  megaRegionId?: string | null
  countrySlug?: string | null
}

function sortWithSeasonalPicks(
  items: ResultItem[],
  seasonalPickIds: ReadonlySet<string> | null | undefined,
): ResultItem[] {
  if (!seasonalPickIds || seasonalPickIds.size === 0) return items
  return [
    ...items.filter((p) => seasonalPickIds.has(p.id)),
    ...items.filter((p) => !seasonalPickIds.has(p.id)),
  ]
}

type Section = {
  key: string
  label: string
  items: ResultItem[]
}

export default function OverseasHubProductSections({
  items,
  formatWon,
  seasonalPickIds,
  hubGalleryRotationSeed,
  mode,
  megaRegionId,
  countrySlug,
}: Props) {
  const sections = useMemo((): Section[] => {
    if (items.length === 0) return []

    if (mode === 'megaSubgroups' && megaRegionId) {
      const regionId = megaRegionId.trim()
      const subgroupOrder = megaMenuSubgroupLabelsInOrder(regionId)
      const bySubgroup = new Map<string, ResultItem[]>()

      for (const item of items) {
        const key = resolveOverseasHubMegaSubgroupDisplayLabel(item, regionId)
        const list = bySubgroup.get(key) ?? []
        list.push(item)
        bySubgroup.set(key, list)
      }

      const orderedLabels = [
        ...subgroupOrder.filter((label) => (bySubgroup.get(label)?.length ?? 0) > 0),
        ...[...bySubgroup.keys()]
          .filter((label) => !subgroupOrder.includes(label))
          .sort((a, b) => a.localeCompare(b, 'ko')),
      ]

      return orderedLabels.map((label) => ({
        key: `mega:${regionId}:${label}`,
        label,
        items: interleaveProductsBySupplier(sortWithSeasonalPicks(bySubgroup.get(label) ?? [], seasonalPickIds)),
      }))
    }

    if (mode === 'countryFlat' && countrySlug) {
      const slug = countrySlug.trim().toLowerCase()
      const heading = koreanCountryLabelFromBrowseSlug(slug) ?? slug
      return [
        {
          key: `country:${slug}`,
          label: heading,
          items: interleaveProductsBySupplier(sortWithSeasonalPicks(items, seasonalPickIds)),
        },
      ]
    }

    if (mode === 'focusedFlat') {
      return [
        {
          key: 'focused',
          label: '',
          items: interleaveProductsBySupplier(sortWithSeasonalPicks(items, seasonalPickIds)),
        },
      ]
    }

    const byBucket = new Map<OverseasDisplayBucketId, ResultItem[]>()
    for (const id of OVERSEAS_DISPLAY_BUCKET_ORDER) byBucket.set(id, [])
    for (const item of items) {
      const bucket: OverseasDisplayBucketId = item.overseasBucket ?? 'other'
      if (!byBucket.has(bucket)) byBucket.set(bucket, [])
      byBucket.get(bucket)!.push(item)
    }

    return OVERSEAS_DISPLAY_BUCKET_ORDER.map((bucketId) => ({
      key: `bucket:${bucketId}`,
      label: OVERSEAS_DISPLAY_BUCKET_LABEL[bucketId],
      items: interleaveProductsBySupplier(
        sortWithSeasonalPicks(byBucket.get(bucketId) ?? [], seasonalPickIds),
      ),
    })).filter((section) => section.items.length > 0)
  }, [countrySlug, items, megaRegionId, mode, seasonalPickIds])

  if (sections.length === 0) return null

  return (
    <div className="mt-4 space-y-8">
      {sections.map((section) => (
        <section key={section.key} className="scroll-mt-4">
          {section.label ? (
            <h2 className="border-b border-slate-200 pb-2 text-lg font-bold tracking-tight text-slate-900">
              {section.label}
            </h2>
          ) : null}
          <ProductHubSectionGallery
            items={section.items}
            formatWon={formatWon}
            seasonalPickIds={seasonalPickIds}
            rotationSeed={hubGalleryRotationSeed}
            scopeKey={section.key}
          />
        </section>
      ))}
    </div>
  )
}
