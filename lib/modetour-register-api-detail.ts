/**
 * 모두투어 등록 상세카드 — GetProductDetailInfo·GetPackageInfo·GetProductKeyPointInfo B2C API.
 *
 * REGRESSION-FREEZE[modetour-register-detail-collect]: includedNote·unincludedNote·specialBenefits — manifest
 */
import { decodeBasicHtmlEntities } from '@/lib/departure-option-modetour'
import { fetchModetourGroupDetailInfo, parseModetourPackageProductNoFromUrl } from '@/lib/modetour-departures'

const MODETOUR_API_BASE = process.env.MODETOUR_API_BASE_URL ?? 'https://b2c-api.modetour.com'
const MODETOUR_WEB_API_REQ_HEADER =
  process.env.MODETOUR_WEB_API_REQ_HEADER ??
  '{"WebSiteNo":2,"CompanyNo":81202,"DeviceType":"DVTPC","ApiKey":"jm9i5RUzKPMPdklHzDKqNzwZYy0IGV5hTyKkCcpxO0IGIgVS+8Z7NnbzbARv5w7Bn90KT13Gq79XZMow6TYvwQ=="}'

export type ModetourRegisterDetailBundle = {
  detailInfo: Record<string, unknown> | null
  packageInfo: Record<string, unknown> | null
  keyPointInfo: Record<string, unknown> | null
}

function modetourB2cHeaders(referer: string, productNo: string): HeadersInit {
  return {
    accept: 'application/json, text/plain, */*',
    'accept-language': 'ko-KR',
    referer,
    'x-platform': 'ModeEcommerce',
    'x-salespartner': '2',
    'x-userdepartment': 'ModeEcommerce',
    'x-incomming-pathname': `/package/${productNo}`,
    modewebapireqheader: MODETOUR_WEB_API_REQ_HEADER,
  }
}

async function fetchModetourJson<T>(url: string, headers: HeadersInit): Promise<T | null> {
  try {
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(20_000) })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

export function modetourHtmlNoteToPlainText(html: string | null | undefined): string | null {
  const raw = String(html ?? '').trim()
  if (!raw) return null
  const text = decodeBasicHtmlEntities(raw)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\u00a0/g, ' ')
    .replace(/\r/g, '')
  const lines = text
    .split('\n')
    .map((l) => l.replace(/^[\s\-•·▪–—]+/, '').replace(/^\d+[.)]\s*/, '').trim())
    .filter((l) => l.length > 1)
  return lines.length > 0 ? lines.join('\n') : null
}

export function modetourPlainTextToBullets(raw: string | null | undefined): string[] {
  const t = (raw ?? '').trim()
  if (!t) return []
  return t
    .split(/\n/)
    .flatMap((line) => {
      const trimmed = line.trim()
      if (!trimmed) return []
      const numbered = trimmed.split(/(?=\d+[.)]\s)/).map((p) => p.replace(/^\d+[.)]\s*/, '').trim()).filter(Boolean)
      return numbered.length > 1 ? numbered : [trimmed.replace(/^[\s\-•·▪–—]+/, '').trim()]
    })
    .filter((l) => l.length > 1 && l.length < 400)
}

export function extractModetourIncludedExcludedFromDetailInfo(detail: Record<string, unknown> | null | undefined): {
  includedText: string | null
  excludedText: string | null
  includedItems: string[]
  excludedItems: string[]
} {
  const includedText = modetourHtmlNoteToPlainText(String(detail?.includedNote ?? ''))
  const excludedText = modetourHtmlNoteToPlainText(String(detail?.unincludedNote ?? ''))
  return {
    includedText,
    excludedText,
    includedItems: modetourPlainTextToBullets(includedText),
    excludedItems: modetourPlainTextToBullets(excludedText),
  }
}

export function extractModetourShoppingFromDetailBundle(
  detail: Record<string, unknown> | null | undefined,
  packageInfo: Record<string, unknown> | null | undefined,
): { shoppingVisitCount: number | null; noShoppingFlag: boolean | null } {
  const shoppingTimes = Number(detail?.shoppingTimes)
  const shoppingCount = Number(packageInfo?.shoppingCount)
  let shoppingVisitCount: number | null = null
  if (Number.isFinite(shoppingTimes) && shoppingTimes >= 0) shoppingVisitCount = shoppingTimes
  else if (Number.isFinite(shoppingCount) && shoppingCount >= 0) shoppingVisitCount = shoppingCount

  const noteHay = `${String(detail?.shoppingNote ?? '')} ${String(detail?.notesWhenShopping ?? '')}`
  const noShoppingFlag = /노쇼핑|쇼핑\s*없음/i.test(noteHay)
    ? true
    : shoppingVisitCount === 0
      ? true
      : shoppingVisitCount != null && shoppingVisitCount > 0
        ? false
        : null

  return { shoppingVisitCount, noShoppingFlag }
}

export function extractModetourMustKnowFromKeyPointInfo(
  keyPoint: Record<string, unknown> | null | undefined,
): Array<{ category: '안전/유의' | '현지준비' | '입국/비자'; title: string; body: string; raw: string }> {
  if (!keyPoint) return []
  const items: Array<{ category: '안전/유의' | '현지준비' | '입국/비자'; title: string; body: string; raw: string }> = []
  const push = (category: '안전/유의' | '현지준비' | '입국/비자', title: string, body: string) => {
    const b = body.trim()
    if (!b || b === '상품 핵심 포인트') return
    items.push({ category, title, body: b, raw: b })
  }

  const asRows = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])

  for (const row of asRows(keyPoint.specialBenefits)) {
    const b = String(row ?? '').trim()
    if (b) push('현지준비', '특별 혜택', b)
  }
  for (const row of asRows(keyPoint.sightseeings)) {
    const b = String(row ?? '').trim()
    if (b) push('현지준비', '관광 포인트', b)
  }
  for (const row of asRows(keyPoint.hotels)) {
    const b = String(row ?? '').trim()
    if (b) push('현지준비', '숙소', b)
  }
  for (const row of asRows(keyPoint.meals)) {
    const b = String(row ?? '').trim()
    if (b) push('현지준비', '식사', b)
  }

  const leader = String(keyPoint.leaderGuild ?? '').trim()
  const leaderStatus = String(keyPoint.leaderStatus ?? '').trim()
  if (leader && !/정보\s*확인/.test(leader)) {
    push('현지준비', '인솔자/가이드', [leader, leaderStatus].filter(Boolean).join(' · '))
  } else if (leaderStatus && leaderStatus !== '미정') {
    push('현지준비', '인솔자/가이드', leaderStatus)
  }

  const insurance = String(keyPoint.travelerInsuranceInfo ?? '').trim()
  if (insurance) push('안전/유의', '여행자 보험', insurance)
  const guarantee = String(keyPoint.businessGuarantee ?? '').trim()
  if (guarantee) push('안전/유의', '공제/보증', guarantee)
  const mile = String(keyPoint.tourMile ?? '').trim()
  if (mile) push('현지준비', '투어 마일리지', mile)

  return items
}

export async function fetchModetourRegisterDetailBundle(originUrl: string): Promise<ModetourRegisterDetailBundle | null> {
  const productNo = parseModetourPackageProductNoFromUrl(originUrl)
  if (!productNo || productNo === '0') return null

  const referer = originUrl.trim() || `https://www.modetour.com/package/${productNo}`
  const headers = modetourB2cHeaders(referer, productNo)
  const base = MODETOUR_API_BASE.replace(/\/$/, '')

  const [detailInfo, packageJson, keyPointJson] = await Promise.all([
    fetchModetourGroupDetailInfo(originUrl),
    fetchModetourJson<{ result?: Record<string, unknown> }>(
      `${base}/Package/GetPackageInfo?productNo=${encodeURIComponent(productNo)}`,
      headers,
    ),
    fetchModetourJson<{ result?: Record<string, unknown> }>(
      `${base}/Package/GetProductKeyPointInfo?productNo=${encodeURIComponent(productNo)}`,
      headers,
    ),
  ])

  return {
    detailInfo,
    packageInfo: packageJson?.result ?? null,
    keyPointInfo: keyPointJson?.result ?? null,
  }
}
