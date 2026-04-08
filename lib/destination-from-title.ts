/**
 * destination 누락 시 title에서 핵심 도시명 강제 추출.
 * Prisma destination 필수 오류 방지용.
 */
const CITY_PATTERNS = [
  /타이베이|대만/i,
  /다낭|베트남/i,
  /오사카|오키나와|도쿄|후쿠오카|삿포로|교토|일본/i,
  /방콕|치앙마이|태국|파타야/i,
  /세부|마닐라|보라카이|필리핀/i,
  /싱가포르|말레이시아|쿠알라룸푸르/i,
  /괌|사이판|하와이/i,
  /상해|상하이|베이징|북경|홍콩|마카오|중국/i,
  /유럽|파리|로마|런던|이탈리아|스페인|영국|프랑스/i,
  /호주|시드니|멜버른|뉴질랜드/i,
  /두바이|아랍에미리트|UAE/i,
  /제주|국내/i,
]

export function extractDestinationFromTitle(title: string): string {
  const t = String(title ?? '').trim()
  if (!t) return '미지정'
  for (const re of CITY_PATTERNS) {
    const m = t.match(re)
    if (m) {
      const word = m[0]
      if (/타이베이|대만/.test(word)) return '타이베이'
      if (/다낭|베트남/.test(word)) return '다낭'
      if (/오사카/.test(word)) return '오사카'
      if (/오키나와/.test(word)) return '오키나와'
      if (/도쿄/.test(word)) return '도쿄'
      if (/방콕|태국/.test(word)) return '방콕'
      if (/세부|필리핀/.test(word)) return '세부'
      if (/싱가포르/.test(word)) return '싱가포르'
      if (/괌/.test(word)) return '괌'
      if (/상해|상하이/.test(word)) return '상하이'
      if (/베이징|북경/.test(word)) return '베이징'
      if (/홍콩/.test(word)) return '홍콩'
      if (/파리/.test(word)) return '파리'
      if (/제주|국내/.test(word)) return '제주'
      return word.replace(/\s+/g, ' ').trim().slice(0, 30)
    }
  }
  return '미지정'
}
