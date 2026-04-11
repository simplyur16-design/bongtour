/** RFC4180-style CSV (quoted fields, `""` escape) for server-side imports. */

export function parseCsvRows(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let i = 0
  let inQuotes = false
  const s = text.replace(/^\uFEFF/, '')

  const flushRow = () => {
    row.push(field)
    if (row.some((x) => String(x).length > 0)) rows.push(row)
    row = []
    field = ''
  }

  while (i < s.length) {
    const c = s[i]!
    if (inQuotes) {
      if (c === '"' && s[i + 1] === '"') {
        field += '"'
        i += 2
        continue
      }
      if (c === '"') {
        inQuotes = false
        i++
        continue
      }
      field += c
      i++
      continue
    }
    if (c === '"') {
      inQuotes = true
      i++
      continue
    }
    if (c === ',') {
      row.push(field)
      field = ''
      i++
      continue
    }
    if (c === '\r') {
      i++
      continue
    }
    if (c === '\n') {
      flushRow()
      i++
      continue
    }
    field += c
    i++
  }
  if (field.length > 0 || row.length > 0) flushRow()
  return rows
}
