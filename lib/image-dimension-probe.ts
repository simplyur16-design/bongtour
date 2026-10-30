/**
 * 이미지 가로·세로 측정 (파일 앞부분만 읽음) — WORK-ORDER 8 3단계 준비.
 * PNG·GIF·JPEG(SOF)·WebP(VP8/VP8L/VP8X) 헤더만 해석. 전체 파일을 받지 않는다(Range 요청 + 최대 바이트 제한).
 * REGRESSION-FREEZE[product-image-auto-register-gate]: 가로폭 미상 = 측정 후 판정 — manifest
 */

export type ImageDimensions = { width: number; height: number; format: 'png' | 'gif' | 'jpeg' | 'webp' }

function u16be(b: Uint8Array, o: number): number {
  return (b[o]! << 8) | b[o + 1]!
}
function u16le(b: Uint8Array, o: number): number {
  return b[o]! | (b[o + 1]! << 8)
}
function u24le(b: Uint8Array, o: number): number {
  return b[o]! | (b[o + 1]! << 8) | (b[o + 2]! << 16)
}
function u32be(b: Uint8Array, o: number): number {
  return ((b[o]! << 24) >>> 0) + (b[o + 1]! << 16) + (b[o + 2]! << 8) + b[o + 3]!
}

/** 헤더 바이트에서 크기 해석. 모르면 null */
export function parseImageDimensions(b: Uint8Array): ImageDimensions | null {
  if (b.length >= 24 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) {
    return { width: u32be(b, 16), height: u32be(b, 20), format: 'png' }
  }
  if (b.length >= 10 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) {
    return { width: u16le(b, 6), height: u16le(b, 8), format: 'gif' }
  }
  if (b.length >= 30 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) {
    const chunk = String.fromCharCode(b[12]!, b[13]!, b[14]!, b[15]!)
    if (chunk === 'VP8X') return { width: u24le(b, 24) + 1, height: u24le(b, 27) + 1, format: 'webp' }
    if (chunk === 'VP8L' && b[20] === 0x2f) {
      const bits = b[21]! | (b[22]! << 8) | (b[23]! << 16) | (b[24]! << 24)
      return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1, format: 'webp' }
    }
    if (chunk === 'VP8 ' && b[23] === 0x9d && b[24] === 0x01 && b[25] === 0x2a) {
      return { width: u16le(b, 26) & 0x3fff, height: u16le(b, 28) & 0x3fff, format: 'webp' }
    }
    return null
  }
  if (b.length >= 4 && b[0] === 0xff && b[1] === 0xd8) {
    let o = 2
    while (o + 9 < b.length) {
      if (b[o] !== 0xff) {
        o++
        continue
      }
      const marker = b[o + 1]!
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
        o += 2
        continue
      }
      const len = u16be(b, o + 2)
      const isSof = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc
      if (isSof) return { width: u16be(b, o + 7), height: u16be(b, o + 5), format: 'jpeg' }
      if (len < 2) return null
      o += 2 + len
    }
  }
  return null
}

export type ProbeOptions = { timeoutMs?: number; maxBytes?: number; fetchImpl?: typeof fetch }

/** URL 앞부분만 받아 크기 측정. 실패하면 null(= 여전히 '확인 필요') */
export async function probeImageDimensions(url: string, opts: ProbeOptions = {}): Promise<ImageDimensions | null> {
  const maxBytes = opts.maxBytes ?? 256 * 1024
  const f = opts.fetchImpl ?? fetch
  const ac = new AbortController()
  const t = setTimeout(() => ac.abort(), opts.timeoutMs ?? 15000)
  try {
    const res = await f(url, {
      headers: { Range: `bytes=0-${maxBytes - 1}`, 'User-Agent': 'bongtour-image-audit/1.0' },
      signal: ac.signal,
    })
    if (!res.ok || !res.body) return null
    const reader = res.body.getReader()
    const parts: Uint8Array[] = []
    let got = 0
    for (;;) {
      const { done, value } = await reader.read()
      if (done || !value) break
      parts.push(value)
      got += value.length
      const buf = concat(parts, got)
      const dim = parseImageDimensions(buf)
      if (dim) {
        await reader.cancel().catch(() => {})
        return dim
      }
      if (got >= maxBytes) break
    }
    await reader.cancel().catch(() => {})
    return parseImageDimensions(concat(parts, got))
  } catch {
    return null
  } finally {
    clearTimeout(t)
  }
}

function concat(parts: Uint8Array[], n: number): Uint8Array {
  const out = new Uint8Array(n)
  let o = 0
  for (const p of parts) {
    out.set(p, o)
    o += p.length
  }
  return out
}
