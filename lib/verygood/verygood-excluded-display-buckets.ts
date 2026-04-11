export type PartitionedVerygoodExcluded = {
  /** 현지 지불·가이드/기사 경비·통화 등 */
  localPay: string[]
  /** 객실 1인 1실 등 */
  addon: string[]
  normal: string[]
}

function isVerygoodLocalPayLine(line: string): boolean {
  const s = line.trim()
  if (!s) return false
  if (/현지\s*지불|현지지불|현지에서\s*지불|현지\s*에서\s*지불/i.test(s)) return true
  if (/가이드\s*경비|가이드경비|기사\s*경비|기사경비|인솔가이드/i.test(s)) return true
  if (/\bEUR\b|\bUSD\b|\bGBP\b|\bCHF\b/i.test(s)) return true
  if (/유로|달러|파운드|£|€|\$/u.test(s)) return true
  return false
}

function isVerygoodAddonFeeLine(line: string): boolean {
  const s = line.trim()
  if (!s) return false
  if (/1인\s*1실|싱글룸|싱글|객실.*추가|추가\s*비용|추가비용|1인실|싱글차지|싱글\s*차지/i.test(s)) return true
  return false
}

/** 불포함 표시 문자열(줄 단위) → 현지지불 / 추가비용 / 일반 */
export function partitionVerygoodExcludedDisplay(excludedDisplay: string): PartitionedVerygoodExcluded {
  const lines = excludedDisplay
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
  const localPay: string[] = []
  const addon: string[] = []
  const normal: string[] = []
  for (const line of lines) {
    if (isVerygoodLocalPayLine(line)) localPay.push(line)
    else if (isVerygoodAddonFeeLine(line)) addon.push(line)
    else normal.push(line)
  }
  return { localPay, addon, normal }
}
