import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

function mustContain(label: string, haystack: string, needle: string) {
  assert.ok(haystack.includes(needle), `${label} must include: ${needle}`)
}

function run() {
  const root = process.cwd()
  const sql = readFileSync(join(root, 'supabase/sql/image_assets.sql'), 'utf8')
  mustContain('sql', sql, 'source_type')
  mustContain('sql', sql, 'source_name')
  mustContain('sql', sql, 'is_generated')
  mustContain('sql', sql, 'seo_title_kr')
  mustContain('sql', sql, 'seo_title_en')
  mustContain('sql', sql, "check (source_type in ('pexels', 'gemini_auto', 'gemini_manual', 'photo_owned', 'istock'))")

  const service = readFileSync(join(root, 'lib/image-asset-upload-service.ts'), 'utf8')
  mustContain('service', service, 'source_name: sourceName')
  mustContain('service', service, 'seo_title_kr')
  mustContain('service', service, 'seo_title_en')
  mustContain('service', service, "existing.source_type === 'istock'")
  mustContain('service', service, 'await removeNcloudObject')

  const mapper = readFileSync(join(root, 'lib/image-asset-api-mapper.ts'), 'utf8')
  mustContain('mapper', mapper, 'sourceName: row.source_name')
  mustContain('mapper', mapper, 'isGenerated: row.is_generated')
  mustContain('mapper', mapper, 'seoTitleKr: row.seo_title_kr')
  mustContain('mapper', mapper, 'seoTitleEn: row.seo_title_en')

  const ui = readFileSync(join(root, 'app/admin/image-assets-upload/page.tsx'), 'utf8')
  mustContain('ui', ui, 'source_type (수동 업로드)')
  mustContain('ui', ui, '파일명이 iStock-으로 시작하여 원천이 iStock으로 자동 고정되었습니다.')
  mustContain('ui', ui, 'seo_title_kr')
  mustContain('ui', ui, 'seo_title_en')
  mustContain('ui', ui, 'sourceTypeBadgeLabelKo')

  const drawer = readFileSync(join(root, 'app/admin/image-assets-upload/ImageAssetEditDrawer.tsx'), 'utf8')
  mustContain('drawer', drawer, "current.sourceType === 'istock'")
  mustContain('drawer', drawer, '자동 파이프라인 자산입니다. 변경 전 원천을 확인하세요.')

  console.log('[verify-image-assets-contract] ok')
}

run()

