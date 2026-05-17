/**
 * 모두투어 붙여넣기 본문 전처리·LLM 입력 토큰 진단.
 *
 *   npx tsx scripts/diagnose-modetour-preprocess.ts
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { buildRegisterLlmInputBlocks } from '../lib/register-llm-blocks-modetour'
import {
  normalizeDetailRawText,
  splitDetailSections,
} from '../lib/detail-body-parser-utils-modetour'
import { segmentSupplierPasteForLlm } from '../lib/register-llm-blocks-modetour'
import { parseDetailBodyStructuredModetour } from '../lib/detail-body-parser-modetour'

const FIXTURE = join(
  process.cwd(),
  'tools/fixtures/modetour-package-seoyooreop-3guk-10il.txt'
)

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

/** 1차 전처리 이전 baseline (진단 비교용) */
function normalizeDetailRawTextBaseline(raw: string): string {
  const drop =
    /(더보기|크게보기|후기|리뷰|좋아요|공유|배너|이벤트|버튼|^[-_=]{3,}$|모두투어\s*예약|상담\s*문의|고객\s*만족)/i
  const isArtifact = (line: string) => {
    const t = line.replace(/\s+/g, ' ').trim()
    return /^Image$/i.test(t) || /^logo$/i.test(t) || /^logo-koreanair$/i.test(t)
  }
  return raw
    .replace(/\r/g, '\n')
    .split('\n')
    .map((l) => l.replace(/\t/g, ' ').trim())
    .filter((l) => l && !drop.test(l) && !isArtifact(l))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
}

function headTail(text: string, n = 50): { head: string; tail: string } {
  const lines = text.split('\n')
  const head = lines.slice(0, n).join('\n')
  const tail = lines.slice(Math.max(0, lines.length - n)).join('\n')
  return { head, tail }
}

function reportStage(name: string, text: string) {
  const { head, tail } = headTail(text)
  const tokens = estimateTokens(text)
  const lines = text.split('\n').length
  console.log(`\n## ${name}`)
  console.log(`- chars: ${text.length}`)
  console.log(`- lines: ${lines}`)
  console.log(`- est. tokens (chars/4): ${tokens}`)
  console.log('\n### First 50 lines\n```')
  console.log(head)
  console.log('```')
  console.log('\n### Last 50 lines\n```')
  console.log(tail)
  console.log('```')
  return tokens
}

function main() {
  const raw = readFileSync(FIXTURE, 'utf8')
  console.log('# Modetour preprocess diagnose')
  console.log(`\nFixture: ${FIXTURE}`)

  const t0 = reportStage('0. raw fixture', raw)
  const baselineNorm = normalizeDetailRawTextBaseline(raw)
  const tBaseline = reportStage('1. normalizeDetailRawText (baseline / pre-phase1)', baselineNorm)
  const normalized = normalizeDetailRawText(raw)
  const t1 = reportStage('2. normalizeDetailRawText (phase1)', normalized)
  const sections = splitDetailSections(normalized)
  const t2 = reportStage(
    '3. splitDetailSections (joined section count)',
    sections.map((s) => `[${s.type}]\n${s.text}`).join('\n\n---\n\n')
  )
  const seg = segmentSupplierPasteForLlm(normalized)
  const segJoined = [
    seg.priceTable,
    seg.airlineMeeting,
    seg.optionalTour,
    seg.shopping,
    seg.includedExcluded,
    seg.hotel,
    seg.requiredChecks,
  ].join('\n\n')
  const t3 = reportStage('4. segmentSupplierPasteForLlm (non-image slices)', segJoined)
  const llmBlocks = buildRegisterLlmInputBlocks({ pastedBody: raw })
  const t4 = reportStage('5. buildRegisterLlmInputBlocks (full LLM user payload)', llmBlocks)
  const detailSnap = parseDetailBodyStructuredModetour({ rawText: raw })
  const t5 = reportStage('6. parseDetailBodyStructuredModetour.normalizedRaw', detailSnap.normalizedRaw)

  const pctBaselineToPhase1 = tBaseline > 0 ? ((1 - t1 / tBaseline) * 100).toFixed(1) : '0'
  const pctRawToLlm = t0 > 0 ? ((1 - t4 / t0) * 100).toFixed(1) : '0'
  const pctBaselineToLlm = tBaseline > 0 ? ((1 - t4 / tBaseline) * 100).toFixed(1) : '0'

  console.log('\n## Summary (est. tokens)')
  console.log('| Stage | Tokens |')
  console.log('|-------|--------|')
  console.log(`| raw | ${t0} |`)
  console.log(`| baseline normalize | ${tBaseline} |`)
  console.log(`| phase1 normalize | ${t1} |`)
  console.log(`| LLM blocks (from raw via pipeline) | ${t4} |`)
  console.log(`| detailBody normalizedRaw | ${t5} |`)
  console.log(`\n- phase1 vs baseline normalize: **${pctBaselineToPhase1}%** reduction`)
  console.log(`- raw → LLM blocks: **${pctRawToLlm}%** reduction`)
  console.log(`- baseline normalize → LLM blocks: **${pctBaselineToLlm}%** reduction`)
}

main()
