/**
 * 참좋은여행(verygoodtour) 관리자 등록: `O 포함사항` / `O 불포함사항` 2컬럼(탭·복수공백) + 단일열 순차 모드.
 * `detail-body-parser-verygoodtour` 전용 — 탭은 `normalizeDetailRawText`에서 보존되어야 2컬럼 분리가 된다.
 */
import type { IncludedExcludedStructured } from '@/lib/detail-body-parser-types'
import { sanitizeIncludedExcludedItemsLines } from '@/lib/included-excluded-postprocess'

function norm(s: string): string {
  return s.replace(/\s+/g, ' ').trim()
}

function isNumberedOrBulletLine(s: string): boolean {
  const t = norm(s)
  if (!t) return false
  return (
    /^\d+[.)]\s+\S/.test(t) ||
    /^[\s·•‧∙‣⁃*\-･・\u00B7\u2022\u2023\u30FB\uFF65]+\s*\S/.test(t) ||
    /^\s*ㄴ\s/.test(t) ||
    /^ㄴ\s/.test(t)
  )
}

/** 탭 우선, 없으면 동일 줄에 `1. …  2.` 형태의 복수 공백(2칸+) 구분만 2컬럼으로 취급 */
function splitTwoColumnLine(raw: string): [string, string] | null {
  const line = raw.trim()
  if (!line) return null
  if (line.includes('\t')) {
    const parts = line.split('\t').map((c) => c.trim()).filter(Boolean)
    if (parts.length >= 2) {
      const left = parts[0]!
      const right = parts.slice(1).join('\t').trim()
      if (right) return [left, right]
    }
    return null
  }
  const byWide = line.split(/\s{2,}/).map((c) => c.trim()).filter(Boolean)
  if (
    byWide.length >= 2 &&
    isNumberedOrBulletLine(byWide[0]!) &&
    isNumberedOrBulletLine(byWide[1]!)
  ) {
    return [byWide[0]!, byWide[1]!]
  }
  /** 탭 없이 `1. …   1. …` 처럼 3칸 이상 공백으로 나뉜 2컬럼(복사 시 탭 유실) */
  const wideNum = line.split(/\s{3,}/).map((c) => c.trim()).filter(Boolean)
  if (
    wideNum.length >= 2 &&
    /^\d+[.)]/.test(wideNum[0]!) &&
    /^\d+[.)]/.test(wideNum[1]!)
  ) {
    return [wideNum[0]!, wideNum.slice(1).join('  ').trim()]
  }
  return null
}

function isIncExcHeaderLine(line: string): boolean {
  const t = norm(line)
  return (
    (/O\s*포함사항/i.test(t) && /O\s*불포함사항/i.test(t)) ||
    /^O\s*포함사항/i.test(t) ||
    /^O\s*불포함사항/i.test(t) ||
    /^포함사항\s*$/.test(t) ||
    /^불포함사항\s*$/.test(t)
  )
}

/**
 * 동일 줄 `O 포함사항 … O 불포함사항` 또는 별도 줄 헤더. `상품평점`에서 파싱 종료.
 */
export function parseVerygoodtourIncludedExcludedSection(section: string): IncludedExcludedStructured {
  const lines = section.split(/\r?\n/)
  let mode: 'idle' | 'inc' | 'exc' = 'idle'
  const includedItems: string[] = []
  const excludedItems: string[] = []
  /** `※ …`↔`1. 가이드…` 같이 탭 2컬럼이 한 번이라도 나오면, 이후 단일열 번호 줄은 우측(불포함) 열로 본다. */
  let afterFirstTwoColumnRow = false

  for (const raw of lines) {
    const line = raw.trimEnd()
    const trimmed = norm(line)
    if (!trimmed) continue
    if (/상품평점|^고객상품평/i.test(trimmed)) break
    if (/미팅장소|미팅장소보기/i.test(trimmed)) continue
    if (/예약\s*안내|유의\s*사항|쇼핑\s*안내|■\s*예약|■\s*약관|상품\s*약관/i.test(trimmed)) {
      if (mode !== 'idle') break
      continue
    }

    if (isIncExcHeaderLine(line)) {
      if (/O\s*포함사항/i.test(trimmed) && /O\s*불포함사항/i.test(trimmed)) {
        mode = 'inc'
      } else if (/^O\s*포함사항/i.test(trimmed) || /^포함사항\s*$/i.test(trimmed)) {
        mode = 'inc'
      } else if (/^O\s*불포함사항/i.test(trimmed) || /^불포함사항\s*$/i.test(trimmed)) {
        mode = 'exc'
      }
      continue
    }

    if (mode === 'idle') continue

    const pair = splitTwoColumnLine(line)
    if (pair) {
      afterFirstTwoColumnRow = true
      const [left, right] = pair
      if (isNumberedOrBulletLine(left) || left.length > 3) {
        includedItems.push(left.slice(0, 280))
      }
      if (isNumberedOrBulletLine(right) || right.length > 3) {
        excludedItems.push(right.slice(0, 280))
      }
      continue
    }

    if (mode === 'inc') {
      if (afterFirstTwoColumnRow && /^\(/.test(trimmed) && excludedItems.length > 0) {
        const i = excludedItems.length - 1
        excludedItems[i] = `${excludedItems[i]} ${trimmed}`.replace(/\s+/g, ' ').trim().slice(0, 280)
        continue
      }
      if (afterFirstTwoColumnRow && /^-\s+/.test(trimmed) && excludedItems.length > 0) {
        const last = excludedItems[excludedItems.length - 1]!
        if (/ETA|영국/i.test(last)) {
          const i = excludedItems.length - 1
          excludedItems[i] = `${last} · ${trimmed.replace(/^-\s+/, '').trim()}`.slice(0, 280)
        } else {
          excludedItems.push(trimmed.slice(0, 280))
        }
        continue
      }
      if (afterFirstTwoColumnRow && isNumberedOrBulletLine(trimmed)) {
        excludedItems.push(trimmed.slice(0, 280))
        continue
      }
      if (/^\d+[.)]\s*개인\s*경비/i.test(trimmed)) {
        mode = 'exc'
        excludedItems.push(trimmed.slice(0, 280))
        continue
      }
      if (isNumberedOrBulletLine(trimmed)) {
        includedItems.push(trimmed.slice(0, 280))
      }
    } else if (mode === 'exc') {
      if (isNumberedOrBulletLine(trimmed)) {
        excludedItems.push(trimmed.slice(0, 280))
      }
    }
  }

  const inc = sanitizeIncludedExcludedItemsLines(includedItems.slice(0, 40))
  const exc = sanitizeIncludedExcludedItemsLines(excludedItems.slice(0, 40))
  const reviewNeeded = inc.length === 0 && exc.length === 0 && section.trim().length > 40
  return {
    includedItems: inc,
    excludedItems: exc,
    noteText: '',
    reviewNeeded,
    reviewReasons: reviewNeeded ? ['verygoodtour_include_exclude_bullet_parse_empty'] : [],
  }
}
