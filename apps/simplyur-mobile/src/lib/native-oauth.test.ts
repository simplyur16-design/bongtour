import { describe, expect, it } from 'vitest'
import { GOOGLE_SIGNIN_SCOPES, pickGoogleOAuthClientId } from './google-oauth-ids'

describe('pickGoogleOAuthClientId', () => {
  it('prefers the first non-empty candidate (env over extra)', () => {
    expect(pickGoogleOAuthClientId('  env.apps.googleusercontent.com  ', 'extra')).toBe(
      'env.apps.googleusercontent.com',
    )
    expect(pickGoogleOAuthClientId('', undefined, 'extra.apps.googleusercontent.com')).toBe(
      'extra.apps.googleusercontent.com',
    )
    expect(pickGoogleOAuthClientId('', '  ')).toBe('')
  })
})

describe('GOOGLE_SIGNIN_SCOPES', () => {
  it('requests openid so Android returns an id_token', () => {
    expect(GOOGLE_SIGNIN_SCOPES).toEqual(['openid', 'profile', 'email'])
  })
})
