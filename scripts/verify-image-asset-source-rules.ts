import assert from 'node:assert/strict'
import {
  detectImageSourceTypeFromFilename,
  isGeneratedImageSourceType,
  resolveImageSourceName,
  resolveImageSourceType,
} from '@/lib/image-asset-source'

function run() {
  // 1) filename detection
  assert.equal(detectImageSourceTypeFromFilename('iStock-123.jpg'), 'istock')
  assert.equal(detectImageSourceTypeFromFilename('test.jpg'), null)

  // 2) resolveImageSourceType cases
  assert.equal(
    resolveImageSourceType({
      isManualUpload: true,
      explicitSourceType: 'gemini_manual',
      originalFileName: 'normal.jpg',
    }),
    'gemini_manual'
  )
  assert.equal(
    resolveImageSourceType({
      isManualUpload: true,
      explicitSourceType: 'photo_owned',
      originalFileName: 'iStock-abc.jpg',
    }),
    'istock'
  )
  assert.equal(
    resolveImageSourceType({
      isManualUpload: false,
      isGeminiAuto: true,
    }),
    'gemini_auto'
  )
  assert.equal(
    resolveImageSourceType({
      isManualUpload: false,
      isPexelsAuto: true,
    }),
    'pexels'
  )

  // 3) generated flags
  assert.equal(isGeneratedImageSourceType('gemini_auto'), true)
  assert.equal(isGeneratedImageSourceType('gemini_manual'), true)
  assert.equal(isGeneratedImageSourceType('istock'), false)
  assert.equal(isGeneratedImageSourceType('photo_owned'), false)
  assert.equal(isGeneratedImageSourceType('pexels'), false)

  // 4) source name
  assert.equal(resolveImageSourceName('istock'), 'iStock')
  assert.equal(resolveImageSourceName('gemini_auto'), 'Gemini Auto')

  console.log('[verify-image-asset-source-rules] ok')
}

run()

