/**
 * 하나투어 등록: 싱글·객실추가·룸차지는 옵션 행에서 제외.
 * 선택관광 전용 붙여넣기: `이용요금 성인 (USD n) 아동 (USD n) 소요시간 … 대체일정 … 미선택시 가이드동행 …`
 */
import type { OptionalToursStructured } from '@/lib/detail-body-parser-types'

type HanatourOptionalRows = OptionalToursStructured['rows']

const HANATOUR_OPTION_ROOM_SURCHARGE =
  /(싱글\s*차지|싱글차지|1인실\s*객실|객실\s*추가\s*요금|객실추가|룸\s*차지|룸차지|싱글\s*룸|single\s*supplement|1인\s*사용|객실\s*차지)/i

const HANATOUR_OPTION_PURE_HOTEL_POLICY =
  /^(?:※|▶|\*|•|-)?\s*(?:2인\s*1실|객실\s*기준|엑스트라\s*베드|유럽\s*호텔\s*특성)/i

export function filterHanatourOptionalTourRows(
  rows: OptionalToursStructured['rows']
): OptionalToursStructured['rows'] {
  return rows
    .filter((r) => {
      const blob = `${r.tourName} ${r.descriptionText ?? ''} ${r.waitingPlaceText ?? ''}`
      if (HANATOUR_OPTION_ROOM_SURCHARGE.test(blob)) return false
      if (HANATOUR_OPTION_PURE_HOTEL_POLICY.test(r.tourName.trim()) && !/\$|USD|원|€|£/i.test(blob)) return false
      return true
    })
    .map((r) => ({
      ...r,
      /** 운영 SSOT: 소개·장문 설명은 노출/저장 축에서 제외(상품명·요금·소요·대체일정·미선택시 동행만). */
      descriptionText: '',
    }))
}

function normTourKey(s: string): string {
  return s.replace(/\s+/g, ' ').trim().toLowerCase()
}

/** 제목 후보가 아닌 줄(설명·헤더·일정·메타) */
function isHanatourNonOptionTitleLine(line: string): boolean {
  const t = line.replace(/\s+/g, ' ').trim()
  if (!t) return true
  if (/^참고\s*사항$/i.test(t)) return true
  if (/^간단\s*일정$/i.test(t)) return true
  if (/^세부\s*일정$/i.test(t)) return true
  if (/^더보기$/i.test(t)) return true
  if (/^※/.test(t)) return true
  if (/^\[\d{1,2}:\d{2}\]/.test(t)) return true
  if (/^[\u{1F300}-\u{1FAFF}\u2600-\u26FF]/u.test(t)) return true
  if (/^MD\s*추천$/i.test(t) || /^MD추천$/i.test(t)) return true
  if (/^스페셜\s*포함$/i.test(t) || /^스페셜포함$/i.test(t)) return true
  if (/이용요금\s*성인/i.test(t)) return true
  if (t.length > 160) return true
  return false
}

function pickHanatourOptionTitleFromContentLines(contentLines: string[]): string {
  for (const line of contentLines) {
    if (isHanatourNonOptionTitleLine(line)) continue
    const t = line.replace(/\s+/g, ' ').trim()
    if (t.length < 2 || t.length > 100) continue
    return t.slice(0, 200)
  }
  return '선택관광'
}

function parseHanatourFeeMetaBlob(metaBlob: string): {
  currency: string
  adultPrice: number | null
  childPrice: number | null
  priceText: string
} | null {
  const flat = metaBlob.replace(/\s+/g, ' ').trim()
  let cur = ''
  let adultN: number | null = null
  let childN: number | null = null
  const a1 = /이용요금\s*성인\s*\(\s*([A-Z]{3})\s*(\d+)\s*\)/i.exec(flat)
  const a2 = /이용요금\s*성인\s*\(\s*USD\s*(\d+)\s*\)/i.exec(flat)
  const a3 = /이용요금\s*성인\s*\(\s*([\d,]+)\s*원\s*\)/i.exec(flat)
  if (a1) {
    cur = a1[1]!.toUpperCase()
    adultN = Number(a1[2])
  } else if (a2) {
    cur = 'USD'
    adultN = Number(a2[1])
  } else if (a3) {
    cur = 'KRW'
    adultN = Number(a3[1]!.replace(/,/g, ''))
  } else return null
  if (!Number.isFinite(adultN as number)) return null
  const c1 = /아동\s*\(\s*([A-Z]{3})\s*(\d+)\s*\)/i.exec(flat)
  const c2 = /아동\s*\(\s*USD\s*(\d+)\s*\)/i.exec(flat)
  const c3 = /아동\s*\(\s*([\d,]+)\s*원\s*\)/i.exec(flat)
  if (c1 && c1[1]!.toUpperCase() === cur) childN = Number(c1[2])
  else if (c2 && cur === 'USD') childN = Number(c2[1])
  else if (c3 && cur === 'KRW') childN = Number(c3[1]!.replace(/,/g, ''))
  const parts: string[] = []
  parts.push(`성인 ${cur} ${adultN}`)
  if (childN != null && Number.isFinite(childN)) parts.push(`아동 ${cur} ${childN}`)
  return { currency: cur, adultPrice: adultN, childPrice: childN, priceText: parts.join(' / ') }
}

function parseHanatourDurationAltGuide(metaBlob: string): {
  durationText: string
  altText: string
  guide同行Text: string
} {
  const flat = metaBlob.replace(/\s+/g, ' ').trim()
  let durationText = ''
  const durRe = new RegExp(
    String.raw`소요시간\s+(.+?)(?=\s*\|\s*|\s+대체일정\b|\s+미선택시\s*가이드\b|$)`,
    'i'
  )
  const durM = durRe.exec(flat)
  if (durM) {
    durationText = durM[1]!
      .replace(/\s*\|\s*이동시간\s*포함\s*$/i, '')
      .replace(/\s+이동시간\s*포함$/i, '')
      .trim()
  }
  let altText = ''
  const altRe = new RegExp(
    String.raw`대체일정\s+(.+?)(?=\s+미선택시\s*가이드동행\b|$)`,
    'i'
  )
  const altM = altRe.exec(flat)
  if (altM) altText = altM[1]!.trim()
  let guide同行Text = ''
  const gM = new RegExp(String.raw`미선택시\s*가이드동행\s+(.+?)$`, 'i').exec(flat)
  if (gM) guide同行Text = gM[1]!.replace(/\s+/g, ' ').trim().slice(0, 120)
  return {
    durationText: durationText.slice(0, 120),
    altText: altText.slice(0, 500),
    guide同行Text,
  }
}

function prevLineCompletesHanatourOption(prev: string): boolean {
  const p = prev.replace(/\s+/g, ' ').trim()
  if (!p) return false
  return /소요시간/i.test(p) && (/미선택시/i.test(p) || /미동행/i.test(p))
}

/** 태그 단독 줄은 새 스트립을 만들지 않는다. `[하나팩…]` 또는 `스페셜포함 이름` 같은 줄만 헤드로 본다. */
function isHanatourOptionalTourHeadLine(line: string): boolean {
  const s = line.replace(/^\s+/, '').replace(/\s+/g, ' ').trim()
  if (/^\[하나팩/.test(s)) return true
  if (/^(?:스페셜\s*포함|스페셜포함|MD\s*추천|MD추천)$/i.test(s)) return false
  if (/^(?:스페셜\s*포함|스페셜포함|MD\s*추천|MD추천)\s+\S/i.test(s)) return true
  return false
}

function extractLeadingHanatourOptionalSupplierTagsFromBuffer(buf: string[]): string[] {
  const lines = buf.map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean)
  const tags: string[] = []
  let i = 0
  while (i < lines.length) {
    const L = lines[i]!
    if (/^스페셜\s*포함$/i.test(L) || /^스페셜포함$/i.test(L)) {
      tags.push('스페셜포함')
      i++
      continue
    }
    if (/^MD\s*추천$/i.test(L) || /^MD추천$/i.test(L)) {
      tags.push('MD추천')
      i++
      continue
    }
    const packM = L.match(/^(\[하나팩[^\]]*\])/i)
    if (packM?.[1]) {
      tags.push(packM[1]!.trim())
      i++
      continue
    }
    break
  }
  return tags
}

function hanatourSupplierTagToReplayLine(tag: string): string {
  if (tag === '스페셜포함') return '스페셜포함'
  if (tag === 'MD추천') return 'MD추천'
  return tag
}

/** 공통 안내·※ 정책문·장문 설명이 옵션명으로 승격된 경우 제거 */
function isHanatourJunkOptionalTitle(tourName: string): boolean {
  const t = tourName.replace(/\s+/g, ' ').trim()
  if (!t) return true
  if (/^[※▶◎◇*•\-]\s*/.test(t) && (/(합리적|제공합니다|선택관광)/.test(t) || t.length > 35)) return true
  if (/하나팩\s*2[.,]?\s*0?\s*은/.test(t)) return true
  if (/선택관광을\s*제공/.test(t)) return true
  if (t.length > 120) return true
  return false
}

function isHanatourMetaOnlyOptionTitle(name: string): boolean {
  const t = name.replace(/\s+/g, ' ').trim()
  return (
    /^소요시간\b/i.test(t) ||
    /^미선택시\s*가이드/i.test(t) ||
    /^대체일정\b/i.test(t)
  )
}

/** 소요시간·미선택시·대체일정 단독 줄을 직전 옵션 메타로 귀속 */
function mergeHanatourOptionalMetaOnlyRows(rows: HanatourOptionalRows): HanatourOptionalRows {
  const out: OptionalToursStructured['rows'] = []
  for (const r of rows) {
    const name = (r.tourName || '').replace(/\s+/g, ' ').trim()
    if (!out.length) {
      if (!isHanatourMetaOnlyOptionTitle(name)) out.push(r)
      continue
    }
    if (isHanatourMetaOnlyOptionTitle(name)) {
      const prev = out[out.length - 1]!
      if (/^소요시간\b/i.test(name)) {
        const extra = name.replace(/^소요시간\s*/i, '').trim()
        prev.durationText = [prev.durationText, extra].filter(Boolean).join(' ').trim().slice(0, 200)
      } else if (/^미선택시\b/i.test(name)) {
        prev.guide同行Text = [prev.guide同行Text, name].filter(Boolean).join(' ').trim().slice(0, 300)
      } else if (/^대체일정\b/i.test(name)) {
        const note = name.replace(/^대체일정\s*/i, '').trim()
        prev.alternateScheduleText = [prev.alternateScheduleText, note].filter(Boolean).join(' | ').trim().slice(0, 500) || undefined
      } else {
        prev.descriptionText = [prev.descriptionText, name].filter(Boolean).join('\n').trim().slice(0, 4000)
      }
      continue
    }
    out.push(r)
  }
  return out
}

/** 제목 줄 앞에 붙은 하나투어 태그를 배지와 순수 옵션명으로 분리 */
function peelHanatourOptionalTagsFromTitle(tourNameRaw: string): { supplierTags: string[]; tourName: string } {
  const supplierTags: string[] = []
  let rest = tourNameRaw.replace(/\s+/g, ' ').trim()
  for (let guard = 0; guard < 12; guard++) {
    let hit = false
    if (/^스페셜\s*포함\s*/i.test(rest)) {
      supplierTags.push('스페셜포함')
      rest = rest.replace(/^스페셜\s*포함\s*/i, '').trim()
      hit = true
    } else if (/^스페셜포함\s*/i.test(rest)) {
      supplierTags.push('스페셜포함')
      rest = rest.replace(/^스페셜포함\s*/i, '').trim()
      hit = true
    } else if (/^MD\s*추천\s*/i.test(rest)) {
      supplierTags.push('MD추천')
      rest = rest.replace(/^MD\s*추천\s*/i, '').trim()
      hit = true
    } else if (/^MD추천\s*/i.test(rest)) {
      supplierTags.push('MD추천')
      rest = rest.replace(/^MD추천\s*/i, '').trim()
      hit = true
    } else {
      const m = rest.match(/^(\[하나팩[^\]]*\])\s*/i)
      if (m?.[1]) {
        supplierTags.push(m[1]!.trim())
        rest = rest.slice(m[0]!.length).trim()
        hit = true
      }
    }
    if (!hit) break
  }
  const tourName = rest.slice(0, 200).trim() || tourNameRaw.replace(/\s+/g, ' ').trim().slice(0, 200)
  return { supplierTags, tourName }
}

/**
 * 한 패키지 안에서 `[하나팩]` / `스페셜포함 이름` / (소요시간+미선택시 완료 후) 짧은 다음 줄(실제 옵션명) 기준으로 스트립 분리.
 * 태그 단독 줄로는 분리하지 않아 `[하나팩]` 다음 `스페셜 포함`이 잘리지 않게 한다.
 */
function splitHanatourOptionalLinesIntoStrips(lines: string[]): string[][] {
  if (lines.length <= 1) return [lines]
  const strips: string[][] = []
  let buf: string[] = []
  let lastLeadingTags: string[] = []

  const flushBuf = () => {
    if (!buf.length) return
    const tags = extractLeadingHanatourOptionalSupplierTagsFromBuffer(buf)
    if (tags.length) lastLeadingTags = tags
    strips.push(buf)
    buf = []
  }

  for (const line of lines) {
    const trimmed = line.replace(/\s+/g, ' ').trim()
    const prev = buf.length ? buf[buf.length - 1]!.replace(/\s+/g, ' ').trim() : ''
    const newAfterComplete =
      buf.length > 0 &&
      prevLineCompletesHanatourOption(prev) &&
      trimmed.length > 0 &&
      trimmed.length <= 72 &&
      !/^(?:소요시간|대체일정|미선택시\s*가이드|※|▶|\[하나팩)/i.test(trimmed)

    const tourHead = isHanatourOptionalTourHeadLine(line)

    if ((tourHead || newAfterComplete) && buf.length) {
      flushBuf()
      if (tourHead && /^\[하나팩/.test(trimmed)) {
        lastLeadingTags = []
        buf = [line]
      } else if (newAfterComplete && lastLeadingTags.length) {
        buf = [...lastLeadingTags.map(hanatourSupplierTagToReplayLine), line]
      } else {
        buf = [line]
      }
    } else {
      buf.push(line)
    }
  }
  if (buf.length) strips.push(buf)
  return strips.length > 1 ? strips : [lines]
}

/**
 * USD 이용요금 줄이 없는 하나투어 정형 블록(스페셜포함·MD추천·하나팩·소요/대체/미선택시).
 */
function parseHanatourNonUsdOptionBlocks(section: string): HanatourOptionalRows {
  if (!/스페셜|MD\s*추천|MD추천|\[하나팩|소요시간|대체일정|미선택시\s*가이드/i.test(section)) {
    return []
  }
  const parts = section.split(/\n\s*\n+/).map((p) => p.trim()).filter(Boolean)
  const out: OptionalToursStructured['rows'] = []
  for (const part of parts) {
    if (/이용요금\s*성인/i.test(part)) continue
    const allLines = part.split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean)
    if (allLines.length === 0) continue
    const lineStrips = splitHanatourOptionalLinesIntoStrips(allLines)
    for (const lines of lineStrips) {
      if (lines.length === 0) continue
      const supplierTags: string[] = []
      let i = 0
      while (i < lines.length) {
        const L = lines[i]!
        if (/^스페셜\s*포함$/i.test(L) || /^스페셜포함$/i.test(L)) {
          supplierTags.push('스페셜포함')
          i++
          continue
        }
        if (/^MD\s*추천$/i.test(L) || /^MD추천$/i.test(L)) {
          supplierTags.push('MD추천')
          i++
          continue
        }
        const packM = L.match(/^(\[하나팩[^\]]*\])/i)
        if (packM?.[1]) {
          supplierTags.push(packM[1]!.trim())
          i++
          continue
        }
        break
      }
      const blob = lines.join(' ')
      const hasHanatourOptionCue =
        supplierTags.length > 0 ||
        /소요시간|대체일정|미선택시\s*가이드/i.test(blob) ||
        /스페셜|MD\s*추천|MD추천|\[하나팩/i.test(blob)
      if (!hasHanatourOptionCue) continue
      if (i >= lines.length) continue
      const titlePeeled = peelHanatourOptionalTagsFromTitle(lines[i]!.slice(0, 200) || '선택관광')
      i++
      const allTags = Array.from(new Set([...supplierTags, ...titlePeeled.supplierTags]))
      const tourName = titlePeeled.tourName
      const tailLines = lines.slice(i)
      const tailBlob = tailLines.join(' ')
      const metaStart = tailBlob.search(/이용요금\s*성인/i)
      const metaSlice =
        metaStart >= 0 ? tailLines.join('\n').slice(metaStart).replace(/\s+/g, ' ').trim() : tailBlob
      const durM = /소요시간\s*(.+?)(?=\s*대체일정\b|\s*미선택시\b|$)/i.exec(tailBlob)
      let durationText = (durM?.[1] ?? '').replace(/\s+미선택시.*$/i, '').trim().slice(0, 120)
      const altM = /대체일정\s*(.+?)(?=\s*미선택시\b|$)/i.exec(tailBlob)
      const altPart = (altM?.[1] ?? '').trim().slice(0, 500)
      const gM = new RegExp(String.raw`미선택시\s*가이드동행\s*(.+?)(?:\s{2,}|$)`, 'i').exec(tailBlob)
      const guide同行Text = (gM?.[1] ?? '').trim().slice(0, 200)
      const { durationText: d2, altText: a2, guide同行Text: g2 } = parseHanatourDurationAltGuide(metaSlice)
      if (d2) durationText = d2
      const altFinal = a2 || altPart
      const guideFinal = g2 || guide同行Text
      const hasSpecialIncluded = allTags.some((t) => /스페셜/i.test(t))
      if (isHanatourJunkOptionalTitle(tourName)) continue
      out.push({
        tourName,
        currency: '',
        adultPrice: null,
        childPrice: null,
        durationText,
        minPeopleText: '',
        guide同行Text: guideFinal,
        waitingPlaceText: '',
        descriptionText: '',
        alternateScheduleText: altFinal || undefined,
        supplierTags: allTags.length ? allTags : undefined,
        includedNoExtraCharge: hasSpecialIncluded ? true : undefined,
      })
    }
  }
  return mergeHanatourOptionalMetaOnlyRows(out)
}

function extractHanatourUsdOptionalRows(raw: string): HanatourOptionalRows {
  const lines = raw.split('\n')
  const feeIndices: number[] = []
  for (let i = 0; i < lines.length; i++) {
    if (/이용요금\s*성인/i.test(lines[i]!)) feeIndices.push(i)
  }
  const rows: HanatourOptionalRows = []
  let prevEnd = -1

  for (const feeIdx of feeIndices) {
    let metaEnd = feeIdx
    let metaBlob = lines.slice(feeIdx, metaEnd + 1).join(' ').replace(/\s+/g, ' ').trim()
    while (metaEnd + 1 < lines.length && !/미선택시\s*가이드동행/i.test(metaBlob)) {
      metaEnd++
      metaBlob = lines.slice(feeIdx, metaEnd + 1).join(' ').replace(/\s+/g, ' ').trim()
      if (metaEnd - feeIdx > 10) break
    }

    const feeParsed = parseHanatourFeeMetaBlob(metaBlob)
    if (!feeParsed) {
      prevEnd = metaEnd
      continue
    }

    const { durationText, altText, guide同行Text } = parseHanatourDurationAltGuide(metaBlob)
    const contentLines = lines
      .slice(prevEnd + 1, feeIdx)
      .map((l) => l.replace(/\s+/g, ' ').trim())
      .filter(Boolean)
    const blockText = contentLines.join('\n')
    const minM = /(?:최소출발인원|최소\s*인원)\s*[:：]?\s*(\d+)\s*명/i.exec(blockText)
    const minPeopleText = minM ? `${minM[1]}명` : ''

    const titleRaw = pickHanatourOptionTitleFromContentLines(contentLines)
    const peeled = peelHanatourOptionalTagsFromTitle(titleRaw)
    const hasSpecialTag = peeled.supplierTags.some((t) => /스페셜/i.test(t))

    rows.push({
      tourName: peeled.tourName,
      currency: feeParsed.currency,
      adultPrice: feeParsed.adultPrice,
      childPrice: feeParsed.childPrice != null && Number.isFinite(feeParsed.childPrice) ? feeParsed.childPrice : null,
      durationText,
      minPeopleText,
      guide同行Text,
      waitingPlaceText: '',
      descriptionText: '',
      alternateScheduleText: altText || undefined,
      priceText: feeParsed.priceText,
      supplierTags: peeled.supplierTags.length ? peeled.supplierTags : undefined,
      includedNoExtraCharge:
        hasSpecialTag && feeParsed.adultPrice === 0 ? true : undefined,
    })
    prevEnd = metaEnd
  }
  return rows
}

/** 하나투어 관리자 선택관광 칸 붙여넣기 전용 — USD 이용요금 블록 + 스페셜포함 등 비USD 블록. */
export function parseHanatourOptionalTourPasteSection(section: string): OptionalToursStructured {
  const raw = section.replace(/\r/g, '\n')
  const usdRows = /이용요금\s*성인/i.test(raw) ? extractHanatourUsdOptionalRows(raw) : []
  const extraRows = parseHanatourNonUsdOptionBlocks(raw)
  const seen = new Set(usdRows.map((r) => normTourKey(r.tourName)))
  const rows: OptionalToursStructured['rows'] = [...usdRows]
  for (const r of extraRows) {
    const k = normTourKey(r.tourName)
    if (seen.has(k)) continue
    seen.add(k)
    rows.push(r)
  }
  if (rows.length === 0) {
    return { rows: [], reviewNeeded: false, reviewReasons: [] }
  }
  const genericTitle = rows.filter((r) => (r.tourName || '').trim() === '선택관광').length
  return {
    rows,
    reviewNeeded: rows.length > 0 && genericTitle > 1,
    reviewReasons: genericTitle > 1 ? ['선택관광명 일부 복원 실패 가능'] : [],
  }
}
