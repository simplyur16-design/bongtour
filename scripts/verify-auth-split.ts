/**
 * auth.config(Edge) vs auth.ts(Node) 분리 후 설정 불일치·로드 실패 조기 감지.
 * `npx tsx scripts/verify-auth-split.ts`
 */
import assert from 'node:assert/strict'
import NextAuth from 'next-auth'
import authConfig, { resolvedAuthSecret } from '../auth.config'
import { auth as nodeAuth } from '../auth'

// 1) 시크릿 — 미들웨어·API 동일 소스
assert.ok(resolvedAuthSecret && String(resolvedAuthSecret).length > 0, 'resolvedAuthSecret 비어 있음')

// 2) Edge용 NextAuth(authConfig) 인스턴스 생성 가능
const { auth: edgeAuth } = NextAuth(authConfig)
assert.equal(typeof edgeAuth, 'function', 'NextAuth(authConfig).auth 가 함수여야 함')

// 3) 풀 auth export
assert.equal(typeof nodeAuth, 'function', 'auth.ts의 auth 가 함수여야 함')

// 4) 프로바이더: config에는 카카오만(또는 0), 풀은 Credentials + config
const kakaoConfigured = Boolean(
  process.env.KAKAO_CLIENT_ID?.trim() && process.env.KAKAO_CLIENT_SECRET?.trim()
)
assert.equal(authConfig.providers.length, kakaoConfigured ? 1 : 0, 'auth.config providers 개수')

// 5) session 전략 일치
assert.equal(authConfig.session?.strategy, 'jwt')

console.log('verify-auth-split: ok', {
  edgeProviders: authConfig.providers.length,
  kakaoConfigured,
})
