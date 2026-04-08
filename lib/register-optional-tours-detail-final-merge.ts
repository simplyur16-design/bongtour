/**
 * 관리자 등록: detailBody 옵션 행 vs mergeOptionalToursStructured final JSON 병합.
 * 기존 canonical JSON 키 구조 유지, 새 필드 없음.
 */

export type OptionalTourDetailRowInput = {
  tourName: string
  currency: string
  adultPrice: number | null
  childPrice: number | null
  durationText: string
  minPeopleText: string
  guide同行Text: string
  waitingPlaceText: string
  descriptionText: string
  noteText?: string
  priceText?: string
  alternateScheduleText?: string
  supplierTags?: string[]
  includedNoExtraCharge?: boolean
}

export type RegisterOptionalTourPersistRow = {
  name: string
  currency: string | null
  adultPrice: number | null
  childPrice: number | null
  durationText: string | null
  minPaxText: string | null
  guide同行Text: string | null
  waitingPlaceText: string | null
  raw: string
  /** 하나투어 옵션칸 배지 등 — 공개 UI strict gate·표시용 */
  supplierTags?: string[]
  includedNoExtraCharge?: boolean
  noteText?: string | null
  descriptionText?: string | null
  priceText?: string | null
  alternateScheduleText?: string | null
}

function numOrNull(v: unknown): number | null {
  if (v == null) return null
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') {
    const t = v.replace(/,/g, '').trim()
    if (!t) return null
    const n = Number(t)
    return Number.isFinite(n) ? n : null
  }
  return null
}

/** 가격 칼럼이 durationText로 밀린 전형: 숫자만·시간 단위 없음 */
export function optionalTourDurationTextLooksLikeLeakedPrice(
  durationText: string | null | undefined,
  adultPrice: number | null,
  childPrice: number | null
): boolean {
  const d = (durationText ?? '').replace(/\s+/g, ' ').trim()
  if (!d) return false
  if (/분|시간|hr|min|약\s*\d|^\d+\s*~\s*\d+/i.test(d)) return false
  if (!/^\d{1,6}$/.test(d)) return false
  return adultPrice == null && childPrice == null
}

function detailToPersist(r: OptionalTourDetailRowInput): RegisterOptionalTourPersistRow {
  const tags = Array.isArray(r.supplierTags)
    ? r.supplierTags.map((t) => String(t).trim()).filter(Boolean)
    : []
  return {
    name: r.tourName.trim(),
    currency: r.currency?.trim() || null,
    adultPrice: r.adultPrice,
    childPrice: r.childPrice,
    durationText: r.durationText?.replace(/\s+/g, ' ').trim() || null,
    minPaxText: r.minPeopleText?.replace(/\s+/g, ' ').trim() || null,
    guide同行Text: r.guide同行Text?.replace(/\s+/g, ' ').trim() || null,
    waitingPlaceText: r.waitingPlaceText?.replace(/\s+/g, ' ').trim() || null,
    raw: r.descriptionText?.trim() || r.priceText?.trim() || r.tourName.trim(),
    supplierTags: tags.length ? tags : undefined,
    includedNoExtraCharge: r.includedNoExtraCharge === true ? true : undefined,
    noteText: r.noteText?.replace(/\s+/g, ' ').trim() || null,
    descriptionText: r.descriptionText?.replace(/\s+/g, ' ').trim() || null,
    priceText: r.priceText?.replace(/\s+/g, ' ').trim() || null,
    alternateScheduleText: r.alternateScheduleText?.replace(/\s+/g, ' ').trim() || null,
  }
}

function parseFinalPersistRows(finalJson: string | null): RegisterOptionalTourPersistRow[] {
  if (!finalJson?.trim()) return []
  try {
    const arr = JSON.parse(finalJson) as unknown[]
    if (!Array.isArray(arr)) return []
    const out: RegisterOptionalTourPersistRow[] = []
    for (const el of arr) {
      if (!el || typeof el !== 'object') continue
      const r = el as Record<string, unknown>
      const name = typeof r.name === 'string' ? r.name.trim() : ''
      if (!name) continue
      const st = Array.isArray(r.supplierTags)
        ? r.supplierTags.map((t) => String(t).trim()).filter(Boolean)
        : []
      const descPersist =
        typeof r.descriptionText === 'string'
          ? r.descriptionText.trim()
          : typeof r.description === 'string'
            ? r.description.trim()
            : ''
      out.push({
        name,
        currency: typeof r.currency === 'string' && r.currency.trim() ? r.currency.trim() : null,
        adultPrice: numOrNull(r.adultPrice ?? r.priceValue),
        childPrice: numOrNull(r.childPrice),
        durationText: typeof r.durationText === 'string' ? r.durationText.trim() || null : null,
        minPaxText: typeof r.minPaxText === 'string' ? r.minPaxText.trim() || null : null,
        guide同行Text:
          (typeof r.guide同行Text === 'string' ? r.guide同行Text : typeof r.guideText === 'string' ? r.guideText : null)?.trim() ||
          null,
        waitingPlaceText:
          typeof r.waitingPlaceText === 'string'
            ? r.waitingPlaceText.trim()
            : typeof r.waitPlaceIfNotJoined === 'string'
              ? r.waitPlaceIfNotJoined.trim()
              : null,
        raw:
          typeof r.raw === 'string'
            ? r.raw
            : typeof r.rawText === 'string'
              ? r.rawText
              : name,
        supplierTags: st.length ? st : undefined,
        includedNoExtraCharge: r.includedNoExtraCharge === true ? true : undefined,
        noteText:
          (typeof r.noteText === 'string' ? r.noteText : typeof r.alternateScheduleText === 'string' ? r.alternateScheduleText : null)
            ?.trim() || null,
        descriptionText: descPersist || null,
        priceText: typeof r.priceText === 'string' && r.priceText.trim() ? r.priceText.trim() : null,
        alternateScheduleText:
          typeof r.alternateScheduleText === 'string' && r.alternateScheduleText.trim()
            ? r.alternateScheduleText.trim()
            : null,
      })
    }
    return out
  } catch {
    return []
  }
}

function optionalSetQuality(rows: RegisterOptionalTourPersistRow[]): { priceFilled: number; badDuration: number } {
  let priceFilled = 0
  let badDuration = 0
  for (const r of rows) {
    if (r.adultPrice != null || r.childPrice != null) priceFilled++
    if (optionalTourDurationTextLooksLikeLeakedPrice(r.durationText, r.adultPrice, r.childPrice)) badDuration++
  }
  return { priceFilled, badDuration }
}

function finalSetClearlyBetterThanDetail(
  d: RegisterOptionalTourPersistRow[],
  f: RegisterOptionalTourPersistRow[]
): boolean {
  if (f.length === 0 || d.length === 0) return false
  const qd = optionalSetQuality(d)
  const qf = optionalSetQuality(f)
  /** detail에 채워진 가격이 하나도 없을 때만(또는 duration 오염 행이 2개 이상일 때 final이 더 깨끗하면) 세트 전체 교체 — 1행만 오염이면 행 단위 병합으로 충분 */
  if (qd.priceFilled === 0 && qf.priceFilled > 0) return true
  if (
    qd.badDuration >= 2 &&
    qf.badDuration < qd.badDuration &&
    qf.priceFilled >= qd.priceFilled
  )
    return true
  return false
}

function normTourName(s: string): string {
  return s.replace(/\s+/g, ' ').trim().toLowerCase()
}

/** 인덱스 불일치·행 순서 흔들림 시 같은 관광명으로 final 행 매칭 */
function alignedFinalRow(
  i: number,
  d: RegisterOptionalTourPersistRow | undefined,
  F: RegisterOptionalTourPersistRow[]
): RegisterOptionalTourPersistRow | null {
  if (!d) return F[i] ?? null
  const cand = F[i]
  const nd = normTourName(d.name)
  if (cand && normTourName(cand.name) === nd) return cand
  const byName = F.find((r) => normTourName(r.name) === nd)
  return byName ?? cand ?? null
}

function mergeDetailWithFinalRow(
  d: RegisterOptionalTourPersistRow,
  f: RegisterOptionalTourPersistRow | null | undefined
): RegisterOptionalTourPersistRow {
  if (!f) return { ...d }
  const out = { ...d }
  const dLeak = optionalTourDurationTextLooksLikeLeakedPrice(d.durationText, d.adultPrice, d.childPrice)

  if (d.adultPrice == null && f.adultPrice != null) out.adultPrice = f.adultPrice
  if (d.childPrice == null && f.childPrice != null) out.childPrice = f.childPrice

  const fDurOk =
    Boolean(f.durationText) &&
    !optionalTourDurationTextLooksLikeLeakedPrice(
      f.durationText,
      f.adultPrice ?? out.adultPrice,
      f.childPrice ?? out.childPrice
    )
  if (dLeak && fDurOk) out.durationText = f.durationText

  if (f.supplierTags?.length && !out.supplierTags?.length) out.supplierTags = f.supplierTags
  if (f.includedNoExtraCharge === true && out.includedNoExtraCharge !== true) {
    out.includedNoExtraCharge = true
  }
  if (!out.noteText?.trim() && f.noteText?.trim()) out.noteText = f.noteText
  if (!out.descriptionText?.trim() && f.descriptionText?.trim()) out.descriptionText = f.descriptionText
  if (!out.priceText?.trim() && f.priceText?.trim()) out.priceText = f.priceText
  if (!out.alternateScheduleText?.trim() && f.alternateScheduleText?.trim()) {
    out.alternateScheduleText = f.alternateScheduleText
  }

  return out
}

/**
 * detail 행이 있을 때 저장용 JSON 문자열.
 * - final이 세트 품질에서 명백히 나으면 final 전체 채택
 * - 아니면 행 단위로 final에서 가격·정상 duration 보강, 행 수는 양쪽 max
 */
export function buildOptionalToursStructuredForRegisterJson(
  detailRows: OptionalTourDetailRowInput[],
  finalJson: string | null
): string {
  const D = detailRows.map(detailToPersist)
  const F = parseFinalPersistRows(finalJson)
  if (F.length === 0) return JSON.stringify(D)
  if (finalSetClearlyBetterThanDetail(D, F)) return JSON.stringify(F)

  const n = Math.max(D.length, F.length)
  const merged: RegisterOptionalTourPersistRow[] = []
  for (let i = 0; i < n; i++) {
    const d = D[i]
    const f = d ? alignedFinalRow(i, d, F) : F[i] ?? null
    if (d && f) merged.push(mergeDetailWithFinalRow(d, f))
    else if (d) merged.push({ ...d })
    else if (f) merged.push({ ...f })
  }
  return JSON.stringify(merged)
}
