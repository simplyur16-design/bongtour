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
  normalizeDetailRawTextPhase1,
} from '../lib/detail-body-parser-utils-modetour'

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

function main() {
  const raw = readFileSync(FIXTURE, 'utf8')
  console.log('# Modetour preprocess diagnose')
  console.log(`\nFixture: ${FIXTURE}`)

  const t0 = estimateTokens(raw)
  const tBaseline = estimateTokens(normalizeDetailRawTextBaseline(raw))
  const tPhase1 = estimateTokens(normalizeDetailRawTextPhase1(raw))
  const tPhase2 = estimateTokens(normalizeDetailRawText(raw))
  const llmBlocks = buildRegisterLlmInputBlocks({ pastedBody: raw })
  const tLlmBlocks = estimateTokens(llmBlocks)

  const pctRawToPhase2 = t0 > 0 ? ((1 - tPhase2 / t0) * 100).toFixed(1) : '0'
  const pctPhase1ToPhase2 = tPhase1 > 0 ? ((1 - tPhase2 / tPhase1) * 100).toFixed(1) : '0'
  const pctRawToLlm = t0 > 0 ? ((1 - tLlmBlocks / t0) * 100).toFixed(1) : '0'

  console.log('\n## Summary (est. tokens, chars/4)')
  console.log('| Stage | Tokens | Chars |')
  console.log('|-------|--------|-------|')
  console.log(`| 0. raw fixture | ${t0} | ${raw.length} |`)
  console.log(`| 1. baseline normalize | ${tBaseline} | ${normalizeDetailRawTextBaseline(raw).length} |`)
  console.log(`| 2. phase1 normalize | ${tPhase1} | ${normalizeDetailRawTextPhase1(raw).length} |`)
  console.log(`| 3. phase2 normalize (full) | ${tPhase2} | ${normalizeDetailRawText(raw).length} |`)
  console.log(`| 4. buildRegisterLlmInputBlocks | ${tLlmBlocks} | ${llmBlocks.length} |`)
  console.log(`\n- **phase2 vs raw: ${pctRawToPhase2}%** reduction (goal ≥30%)`)
  console.log(`- phase2 vs phase1: ${pctPhase1ToPhase2}% additional reduction`)
  console.log(`- LLM blocks vs raw: ${pctRawToLlm}% (includes block labels; body uses phase2 via pipeline)`)

  if (Number(pctRawToPhase2) < 30) {
    console.error(`\nFAIL: phase2 vs raw ${pctRawToPhase2}% < 30% target`)
    process.exitCode = 1
  } else {
    console.log(`\nOK: phase2 vs raw meets ≥30% target`)
  }
}

main()
