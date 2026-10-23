/**
 * destination 누락 시 title에서 핵심 도시명 강제 추출.
 * Prisma destination 필수 오류 방지용.
 */
const CITY_PATTERNS = [
  /타이베이|대만/i,
  /다낭|베트남/i,
  /규슈|큐슈|오사카|오키나와|도쿄|후쿠오카|벳부|나가사키|유후인|구마모토|삿포로|교토|일본/i,
  /방콕|치앙마이|태국|파타야/i,
  /세부|마닐라|보라카이|필리핀/i,
  /싱가포르|말레이시아|쿠알라룸푸르/i,
  /괌|사이판|하와이/i,
  /상해|상하이|베이징|북경|홍콩|마카오|심천|선전|중국/i,
  /인도(?!네시아)|델리|아그라|자이푸르/i,
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
      // 메가메뉴 city leaf 우선 — 규슈/홋카이도 등 중분류·관용 비메가 표기 금지
      if (/오사카/.test(word)) return '오사카'
      if (/오키나와/.test(word)) return '오키나와'
      if (/도쿄|동경/.test(word)) return '도쿄'
      if (/후쿠오카/.test(word)) return '후쿠오카'
      if (/벳부/.test(word)) return '벳부'
      if (/나가사키/.test(word)) return '나가사키'
      if (/구마모토/.test(word)) return '구마모토'
      if (/유후인/.test(word)) return '유후인'
      if (/삿포로/.test(word)) return '삿포로'
      if (/교토/.test(word)) return '교토'
      // 중분류·국가명만 매칭되면 leaf가 아님 → 스킵 (finalize/align이 cityKey·countryKey로 정합)
      if (/규슈|큐슈|일본|중국|베트남|태국|필리핀|대만|유럽|호주|뉴질랜드|국내/.test(word)) continue
      if (/치앙마이/.test(word)) return '치앙마이'
      if (/치앙라이/.test(word)) return '치앙라이'
      if (/방콕/.test(word)) return '방콕'
      if (/세부/.test(word)) return '세부'
      if (/싱가포르/.test(word)) return '싱가포르'
      if (/괌/.test(word)) return '괌'
      if (/상해|상하이/.test(word)) return '상해'
      if (/베이징|북경/.test(word)) return '북경'
      if (/청도|칭다오/.test(word)) return '청도'
      if (/홍콩/.test(word)) return '홍콩'
      if (/심천|선전/.test(word)) return '심천'
      if (/델리|아그라|자이푸르/.test(word)) return '델리'
      if (/인도(?!네시아)/.test(word)) continue
      if (/파리/.test(word)) return '파리'
      if (/제주/.test(word)) return '제주'
      // 국가·권역 토큰을 city로 쓰지 않음
      continue
    }
  }
  return '미지정'
}
