import CryptoJS from 'crypto-js'

/**
 * 솔라피 공식 명세: HMAC-SHA256 인증
 * - date: ISO 8601
 * - salt: unique random string, 12-64 bytes
 * - signature: CryptoJS.HmacSHA256(date + salt, API_SECRET) → hex
 * - Header: HMAC-SHA256 apiKey=..., date=..., salt=..., signature=...
 */
export function createSolapiAuthorizationHeader(apiKey: string, apiSecret: string): string {
  const date = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')
  const saltBytes = 16
  const salt = CryptoJS.lib.WordArray.random(saltBytes).toString(CryptoJS.enc.Hex)
  const data = date + salt
  const signature = CryptoJS.HmacSHA256(data, apiSecret).toString(CryptoJS.enc.Hex)
  return `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`
}
